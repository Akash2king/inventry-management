from celery import shared_task
from django.contrib.auth import get_user_model

from apps.records.models import WasteOilRecord

from .services import NotificationService

User = get_user_model()

import logging
from django.conf import settings
from .models import NotificationDevice
import requests

logger = logging.getLogger(__name__)


@shared_task(name="notifications.send_pushes")
def send_pushes_task(user_ids, title, body, metadata=None):
    """Celery task to send push notifications to users' registered devices.

    user_ids: list of user PKs
    title/body: strings
    metadata: optional dict
    """
    try:
        if not user_ids:
            return {"sent": 0}
        tokens = list(
            NotificationDevice.objects.filter(user__id__in=user_ids)
            .values_list("token", flat=True)
            .distinct()
        )
        if not tokens:
            return {"sent": 0}

        url = getattr(settings, "EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send")
        chunk_size = 100
        sent = 0
        sent = 0
        for i in range(0, len(tokens), chunk_size):
            batch = tokens[i : i + chunk_size]
            messages = [
                {
                    "to": t,
                    "title": title or "Chem-Solv Inventory",
                    "body": body or "",
                    "data": metadata or {},
                    "sound": "default",
                    "priority": "high",
                }
                for t in batch
            ]
            resp = requests.post(url, json=messages, timeout=30)
            try:
                text = resp.text
            except Exception:
                text = ""
            if resp.status_code >= 400:
                logger.warning("push_send_failed status=%s resp=%s", resp.status_code, text[:500])
                continue

            # Attempt to parse ticket IDs from Expo response for receipts
            try:
                data = resp.json()
            except Exception:
                data = None

            ticket_ids = []
            if isinstance(data, dict) and data.get("data"):
                # Some proxies wrap the response. Try to find ticket ids.
                entries = data.get("data")
            else:
                entries = data

            if isinstance(entries, list):
                for entry in entries:
                    # entry may be { "status": "ok", "id": "..." } or similar
                    tid = entry.get("id") or entry.get("ticket_id")
                    if tid:
                        ticket_ids.append(tid)

            # If we got ticket ids, try fetching receipts
            if ticket_ids:
                receipts_url = getattr(
                    settings, "EXPO_PUSH_RECEIPT_URL", "https://exp.host/--/api/v2/push/getReceipts"
                )
                try:
                    # short pause to allow receipts to appear
                    import time

                    time.sleep(1)
                    receipts_resp = requests.post(receipts_url, json={"ids": ticket_ids}, timeout=20)
                    try:
                        receipts = receipts_resp.json()
                    except Exception:
                        receipts = None
                    if receipts_resp.status_code >= 400:
                        logger.warning(
                            "push_receipts_failed status=%s resp=%s",
                            receipts_resp.status_code,
                            receipts_resp.text[:500],
                        )
                    else:
                        # receipts is expected as a dict mapping id -> receipt
                        if isinstance(receipts, dict):
                            for tid, receipt in receipts.items():
                                if not receipt:
                                    continue
                                if receipt.get("status") == "ok":
                                    logger.info("push_receipt_ok id=%s", tid)
                                else:
                                    logger.warning(
                                        "push_receipt_error id=%s details=%s",
                                        tid,
                                        receipt,
                                    )
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("push_receipt_exception %s", exc)

            sent += len(batch)
        return {"sent": sent}
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("send_pushes_task failed: %s", exc)
        return {"sent": 0, "error": str(exc)}


@shared_task(name="notifications.send_forwarded_notification")
def send_forwarded_notification(
    record_id: str,
    next_holder_id: str | None,
    from_user_id: str | None = None,
):
    record = WasteOilRecord.objects.select_related(
        "vendor", "current_department", "current_holder"
    ).get(pk=record_id)
    next_holder = (
        User.objects.select_related("department").get(pk=next_holder_id)
        if next_holder_id
        else None
    )
    acting = (
        User.objects.only("id", "username", "full_name").get(pk=from_user_id)
        if from_user_id
        else None
    )
    NotificationService.send_forwarded_notification(record, next_holder, acting)
    return {"record_id": record_id, "next_holder_id": next_holder_id}


@shared_task(name="notifications.send_return_notification")
def send_return_notification(
    record_id: str,
    prev_holder_id: str,
    reason: str,
    from_user_id: str | None = None,
):
    record = WasteOilRecord.objects.select_related(
        "vendor", "current_department", "current_holder"
    ).get(pk=record_id)
    prev_holder = User.objects.select_related("department").get(pk=prev_holder_id)
    acting = (
        User.objects.only("id", "username", "full_name").get(pk=from_user_id)
        if from_user_id
        else None
    )
    NotificationService.send_return_notification(record, prev_holder, reason, acting)
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
