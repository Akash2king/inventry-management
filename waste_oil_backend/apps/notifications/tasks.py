from celery import shared_task
from django.contrib.auth import get_user_model

from apps.records.models import WasteOilRecord

from .services import NotificationService

User = get_user_model()


@shared_task(name="notifications.send_forwarded_notification")
def send_forwarded_notification(record_id: str, next_holder_id: str | None):
    record = WasteOilRecord.objects.get(pk=record_id)
    next_holder = User.objects.get(pk=next_holder_id) if next_holder_id else None
    NotificationService.send_forwarded_notification(record, next_holder)
    return {"record_id": record_id, "next_holder_id": next_holder_id}


@shared_task(name="notifications.send_return_notification")
def send_return_notification(record_id: str, prev_holder_id: str, reason: str):
    record = WasteOilRecord.objects.get(pk=record_id)
    prev_holder = User.objects.get(pk=prev_holder_id)
    NotificationService.send_return_notification(record, prev_holder, reason)
    return {
        "record_id": record_id,
        "prev_holder_id": prev_holder_id,
        "reason": reason,
    }


@shared_task(name="notifications.send_sla_alert")
def send_sla_alert(record_id: str, level: str):
    """
    Triggered when a record crosses an SLA alert band (yellow / orange / red).
    Can be called from periodic jobs or workflow transitions.
    """
    record = WasteOilRecord.objects.get(pk=record_id)
    NotificationService.send_sla_alert(record, level)
    return {"record_id": record_id, "level": level}
