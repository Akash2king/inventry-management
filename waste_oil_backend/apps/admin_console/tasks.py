from calendar import monthrange
from datetime import date

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.admin_console.views import build_gm_monthly_report_payload
from apps.notifications.services import NotificationService


@shared_task(name="admin_console.send_monthly_gm_report_email")
def send_monthly_gm_report_email():
    """
    Once a day, check if we should send the previous month's GM report.

    The task is idempotent across the month because it only sends when
    called on the first day of a month (server date).
    """
    today = timezone.now().date()
    if today.day != 1:
        return {"sent": False, "reason": "not_first_of_month"}

    year = today.year
    month = today.month - 1
    if month == 0:
        month = 12
        year -= 1

    start = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end = date(year, month, last_day)

    report = build_gm_monthly_report_payload(start, end)

    recipients = []
    mgr = getattr(settings, "MANAGER_EMAIL", "") or ""
    gm = getattr(settings, "GM_EMAIL", "") or ""
    if mgr:
        recipients.append(mgr)
    if gm:
        recipients.append(gm)

    if not recipients:
        return {"sent": False, "reason": "no_recipients"}

    subject = (
        f"[Waste Management] Monthly GM report "
        f"({report['period']['from']} → {report['period']['to']})"
    )

    NotificationService.send_monthly_report_email(report, subject, recipients)
    return {
        "sent": True,
        "period": report["period"],
        "recipients": recipients,
    }
