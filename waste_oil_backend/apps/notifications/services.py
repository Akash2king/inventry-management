import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from apps.records.models import WasteOilRecord

logger = logging.getLogger(__name__)
User = get_user_model()


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
    def _send_email(subject: str, body: str, recipients: list[str]) -> None:
        recipients = [r for r in recipients if r]
        if not recipients:
            return
        if not _email_configured():
            logger.info("email_notifications_disabled subject=%s recipients=%s", subject, recipients)
            return
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                fail_silently=True,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("email_notification_failed subject=%s exc=%s", subject, exc)

    @staticmethod
    def send_forwarded_notification(record: WasteOilRecord, next_holder: User | None) -> None:
        logger.info(
            "forwarded_notification record=%s next_holder=%s",
            record.record_number,
            getattr(next_holder, "username", None),
        )

    @staticmethod
    def send_return_notification(
        record: WasteOilRecord, prev_holder: User | None, reason: str
    ) -> None:
        logger.info(
            "return_notification record=%s prev_holder=%s reason=%s",
            record.record_number,
            getattr(prev_holder, "username", None),
            reason[:200] if reason else "",
        )

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

        subject = f"SLA alert ({level}) for record {record.record_number}"
        body = (
            f"Record: {record.record_number}\n"
            f"Vendor: {getattr(record.vendor, 'name', '')}\n"
            f"Stage: {record.current_stage}\n"
            f"Alert level: {level}\n"
            f"Entry date: {record.entry_date}\n"
            f"Due date: {record.due_date}\n"
        )
        NotificationService._send_email(subject, body, recipients)
