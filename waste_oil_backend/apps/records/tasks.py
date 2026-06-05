from datetime import date

from celery import shared_task
from django.utils import timezone

from apps.notifications.tasks import send_sla_alert
from apps.records.models import WasteOilRecord


@shared_task(name="records.scan_sla_alerts")
def scan_sla_alerts() -> dict:
    """
    Periodic task that scans all active records and sends SLA emails when
    the dynamically computed alert level crosses into a higher band
    (green → yellow → orange → red).

    It then syncs the stored ``alert_level`` with the computed value so the
    same transition is not emailed repeatedly on subsequent runs.
    """
    today: date = timezone.now().date()
    updated = 0
    notified = 0

    qs = WasteOilRecord.objects.filter(is_locked=False)

    for record in qs.iterator():
        # Skip completed records; they are already at the final stage.
        if record.alert_level == WasteOilRecord.AlertLevel.COMPLETED:
            continue

        current = record.alert_level
        computed = record.computed_alert_level

        if current == computed:
            continue

        # Only escalate upwards; do not send notifications when going backwards.
        order = {
            WasteOilRecord.AlertLevel.GREEN: 1,
            WasteOilRecord.AlertLevel.YELLOW: 2,
            WasteOilRecord.AlertLevel.ORANGE: 3,
            WasteOilRecord.AlertLevel.RED: 4,
            WasteOilRecord.AlertLevel.COMPLETED: 5,
        }
        if order.get(computed, 0) > order.get(current, 0):
            send_sla_alert.delay(str(record.id), computed)
            notified += 1

        record.alert_level = computed
        record.updated_at = timezone.now()
        record.save(update_fields=["alert_level", "updated_at"])
        updated += 1

    return {
        "date": today.isoformat(),
        "records_checked": qs.count(),
        "records_updated": updated,
        "notifications_sent": notified,
    }

