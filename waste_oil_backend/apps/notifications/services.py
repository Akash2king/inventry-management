import logging

from django.contrib.auth import get_user_model

from apps.records.models import WasteOilRecord

logger = logging.getLogger(__name__)
User = get_user_model()


class NotificationService:
    """Pluggable notifications (email, in-app). Called from Celery tasks."""

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
