import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from apps.records.models import WasteOilRecord

logger = logging.getLogger(__name__)
User = get_user_model()


def _actor_display(user: User | None) -> str | None:
    """Full name and username for emails (who forwarded / returned / completed)."""
    if user is None:
        return None
    name = (getattr(user, "full_name", None) or "").strip()
    un = (getattr(user, "username", None) or "").strip()
    if name and un:
        return f"{name} ({un})"
    return name or un or None


def _email_configured() -> bool:
    """
    Return True if SMTP/email settings are present enough that we should attempt
    to send email. If not, notification methods will simply log instead of failing.
    """
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True):
        return False
    if not getattr(settings, "EMAIL_HOST", None):
        return False
    if not getattr(settings, "DEFAULT_FROM_EMAIL", None):
        return False
    # Host user / password are optional for some setups, so we don't enforce them here.
    return True


class NotificationService:
    """Pluggable notifications (system log + optional email). Called from Celery tasks."""

    @staticmethod
    def _send_email(
        subject: str,
        body_text: str,
        recipients: list[str],
        *,
        html_body: str | None = None,
        attachments: list[tuple[str, bytes, str]] | None = None,
    ) -> None:
        recipients = [r for r in recipients if r]
        if not recipients:
            return
        if not _email_configured():
            logger.info(
                "email_notifications_disabled subject=%s recipients=%s",
                subject,
                recipients,
            )
            return
        try:
            message = EmailMultiAlternatives(
                subject=subject,
                body=body_text,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=recipients,
                headers={
                    "X-Priority": "1",
                    "X-MSMail-Priority": "High",
                    "Importance": "high",
                },
            )
            if html_body:
                message.attach_alternative(html_body, "text/html")
            if attachments:
                for filename, content, mimetype in attachments:
                    message.attach(filename, content, mimetype)
            # Do not swallow SMTP errors silently — logs help diagnose missing forwards/returns.
            sent = message.send(fail_silently=False)
            if not sent:
                logger.warning(
                    "email_notification_not_sent subject=%s recipients=%s",
                    subject,
                    recipients,
                )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("email_notification_failed subject=%s exc=%s", subject, exc)

    @staticmethod
    def send_forwarded_notification(
        record: WasteOilRecord,
        next_holder: User | None,
        acting_user: User | None = None,
    ) -> None:
        logger.info(
            "forwarded_notification record=%s next_holder=%s",
            record.record_number,
            getattr(next_holder, "username", None),
        )
        vendor_name = getattr(record.vendor, "name", "")
        dept_name = getattr(record.current_department, "name", "")
        from_line = _actor_display(acting_user)
        from_block = f"From: {from_line}\n\n" if from_line else ""
        completed_block = f"Completed by: {from_line}\n\n" if from_line else ""

        if next_holder is not None:
            email = (getattr(next_holder, "email", None) or "").strip()
            if not email:
                logger.info("forwarded_notification_no_email user=%s", next_holder.pk)
                return
            name = next_holder.full_name or next_holder.username
            subject = f"[Chem-Solv Inventory] Record {record.record_number} forwarded to you"
            body_text = (
                f"Hello {name},\n\n"
                "A record has been forwarded to you.\n\n"
                f"{from_block}"
                f"Record: {record.record_number}\n"
                f"Vendor: {vendor_name}\n"
                f"Your stage: {record.current_stage}\n"
                f"Department: {dept_name}\n"
                f"Due date: {record.due_date}\n"
                f"Alert level: {record.alert_level}\n\n"
                "Please open the Chem-Solv Inventory desktop app and review your queue.\n"
            )
            try:
                html_body = render_to_string(
                    "emails/record_forwarded.html",
                    {
                        "record": record,
                        "recipient_name": name,
                        "vendor_name": vendor_name,
                        "department_name": dept_name,
                        "from_user_display": from_line,
                    },
                )
            except Exception:  # pragma: no cover
                html_body = None
            NotificationService._send_email(
                subject, body_text, [email], html_body=html_body
            )
            return

        # Final-stage completion: notify GM / Manager distribution list
        recipients: list[str] = []
        mgr = getattr(settings, "MANAGER_EMAIL", "") or ""
        gm = getattr(settings, "GM_EMAIL", "") or ""
        if mgr:
            recipients.append(mgr)
        if gm:
            recipients.append(gm)
        if not recipients:
            return
        subject = f"[Chem-Solv Inventory] Record {record.record_number} completed (GM approval)"
        body_text = (
            "A record has been completed at the final stage.\n\n"
            f"{completed_block}"
            f"Record: {record.record_number}\n"
            f"Vendor: {vendor_name}\n"
            f"Entry date: {record.entry_date}\n"
            f"Due date: {record.due_date}\n"
        )
        try:
            html_body = render_to_string(
                "emails/record_completed.html",
                {
                    "record": record,
                    "vendor_name": vendor_name,
                    "from_user_display": from_line,
                },
            )
        except Exception:  # pragma: no cover
            html_body = None
        NotificationService._send_email(subject, body_text, recipients, html_body=html_body)

    @staticmethod
    def send_return_notification(
        record: WasteOilRecord,
        prev_holder: User | None,
        reason: str,
        acting_user: User | None = None,
    ) -> None:
        logger.info(
            "return_notification record=%s prev_holder=%s reason=%s",
            record.record_number,
            getattr(prev_holder, "username", None),
            reason[:200] if reason else "",
        )
        if prev_holder is None:
            return
        email = (getattr(prev_holder, "email", None) or "").strip()
        if not email:
            logger.info("return_notification_no_email user=%s", prev_holder.pk)
            return
        vendor_name = getattr(record.vendor, "name", "")
        dept_name = getattr(record.current_department, "name", "")
        name = prev_holder.full_name or prev_holder.username
        from_line = _actor_display(acting_user)
        from_block = f"Returned by: {from_line}\n\n" if from_line else ""
        subject = f"[Chem-Solv Inventory] Record {record.record_number} returned to your stage"
        body_text = (
            f"Hello {name},\n\n"
            f"A record has been returned to your department/stage for correction.\n\n"
            f"{from_block}"
            f"Record: {record.record_number}\n"
            f"Vendor: {vendor_name}\n"
            f"Current stage: {record.current_stage}\n"
            f"Department: {dept_name}\n\n"
            f"Reason:\n{reason.strip()}\n\n"
            "Please open the Chem-Solv Inventory desktop app to review and act on this record.\n"
        )
        try:
            html_body = render_to_string(
                "emails/record_returned.html",
                {
                    "record": record,
                    "recipient_name": name,
                    "vendor_name": vendor_name,
                    "department_name": dept_name,
                    "reason": reason.strip(),
                    "from_user_display": from_line,
                },
            )
        except Exception:  # pragma: no cover
            html_body = None
        NotificationService._send_email(subject, body_text, [email], html_body=html_body)

    @staticmethod
    def send_sla_alert(record: WasteOilRecord, level: str) -> None:
        """
        System-level SLA alert hook.

        Currently logs a structured message and, if SMTP is configured, sends a
        short email to the configured manager / GM addresses.
        """
        logger.warning(
            "sla_alert record=%s level=%s entry_date=%s due_date=%s holder=%s department=%s",
            record.record_number,
            level,
            record.entry_date,
            record.due_date,
            getattr(record.current_holder, "username", None),
            getattr(record.current_department, "name", None),
        )

        recipients: list[str] = []
        mgr = getattr(settings, "MANAGER_EMAIL", "") or ""
        gm = getattr(settings, "GM_EMAIL", "") or ""
        if mgr:
            recipients.append(mgr)
        if gm:
            recipients.append(gm)

        if not recipients:
            return

        subject = f"[Chem-Solv Inventory] SLA {level.upper()} for record {record.record_number}"

        vendor_name = getattr(record.vendor, "name", "")
        holder_name = getattr(record.current_holder, "full_name", None) or getattr(
            record.current_holder, "username", ""
        )
        department_name = getattr(record.current_department, "name", "")

        body_text = (
            "Chem-Solv Inventory – SLA Alert\n\n"
            f"Record: {record.record_number}\n"
            f"Vendor: {vendor_name}\n"
            f"Stage: {record.current_stage}\n"
            f"Alert level: {level}\n"
            f"Current holder: {holder_name}\n"
            f"Department: {department_name}\n"
            f"Entry date: {record.entry_date}\n"
            f"Due date: {record.due_date}\n"
        )

        try:
            html_body = render_to_string(
                "emails/sla_alert.html",
                {
                    "record": record,
                    "level": level,
                    "vendor_name": vendor_name,
                    "holder_name": holder_name,
                    "department_name": department_name,
                },
            )
        except Exception:  # pragma: no cover - defensive fallback
            html_body = None

        NotificationService._send_email(
            subject,
            body_text,
            recipients,
            html_body=html_body,
        )

    @staticmethod
    def send_monthly_report_email(report: dict, subject: str, recipients: list[str]) -> None:
        """
        Send a monthly GM/Manager report as a rich HTML email using the same
        analytics payload as the GM report API. This acts as an automated
        snapshot; the desktop app can still generate the full A4 PDF on demand.
        """
        kpis = report.get("kpis", {}) or {}
        alerts = kpis.get("alerts", {}) or {}
        body_text = (
            "Chem-Solv Inventory – Monthly GM Report\n\n"
            f"Period: {report.get('period', {}).get('from', '—')} to "
            f"{report.get('period', {}).get('to', '—')}\n\n"
            f"Total records: {kpis.get('total_records', 0)}\n"
            f"Completed: {kpis.get('completed', 0)} "
            f"({kpis.get('completion_rate', 0)}%)\n"
            f"Active: {kpis.get('active_records', 0)}\n"
            "Alerts:\n"
            f"  - Green: {alerts.get('green', 0)}\n"
            f"  - Yellow: {alerts.get('yellow', 0)}\n"
            f"  - Orange: {alerts.get('orange', 0)}\n"
            f"  - Red: {alerts.get('red', 0)}\n"
        )

        try:
            html_body = render_to_string(
                "emails/monthly_gm_report.html",
                {
                    "report": report,
                    "kpis": kpis,
                    "alerts": alerts,
                },
            )
        except Exception:  # pragma: no cover - defensive fallback
            html_body = None

        pdf_bytes: bytes | None = None
        try:
            from apps.admin_console.report_pdf import build_monthly_report_pdf_bytes

            pdf_bytes = build_monthly_report_pdf_bytes(report)
        except Exception as exc:  # pragma: no cover
            logger.warning("monthly_report_pdf_failed exc=%s", exc)

        attachments = None
        if pdf_bytes:
            p = report.get("period", {}) or {}
            fname = f"chemsolv_inventory_monthly_report_{p.get('from', '')}_{p.get('to', '')}.pdf"
            attachments = [(fname, pdf_bytes, "application/pdf")]

        NotificationService._send_email(
            subject,
            body_text,
            recipients,
            html_body=html_body,
            attachments=attachments,
        )

    @staticmethod
    def send_welcome_employee_email(user: User, initial_password: str) -> None:
        """Email new pipeline users with username + initial password (GM-created accounts)."""
        email = (getattr(user, "email", None) or "").strip()
        if not email:
            logger.info(
                "welcome_employee_skipped_no_email user_id=%s",
                getattr(user, "pk", None),
            )
            return
        display_name = (getattr(user, "full_name", None) or "").strip() or user.username
        subject = "[Chem-Solv Inventory] Your account — sign in and set a new password"
        app_hint = (
            getattr(settings, "FRONTEND_URL", None)
            or getattr(settings, "WELCOME_EMAIL_APP_HINT", None)
            or ""
        )
        app_hint = str(app_hint).strip()
        body_text = (
            f"Hello {display_name},\n\n"
            "A GM administrator created your Chem-Solv Inventory account.\n\n"
            f"Username: {user.username}\n"
            f"Initial password: {initial_password}\n\n"
            "Open the Chem-Solv Inventory desktop app and sign in with the credentials above. "
            "You will be asked to change your password before you can use the rest of the system.\n\n"
        )
        if app_hint:
            body_text += f"App / instructions: {app_hint}\n\n"
        body_text += "If you did not expect this message, contact your administrator.\n"

        try:
            html_body = render_to_string(
                "emails/welcome_employee.html",
                {
                    "user": user,
                    "display_name": display_name,
                    "initial_password": initial_password,
                    "app_hint": app_hint,
                },
            )
        except Exception:  # pragma: no cover - defensive fallback
            html_body = None

        NotificationService._send_email(
            subject,
            body_text,
            [email],
            html_body=html_body,
        )
