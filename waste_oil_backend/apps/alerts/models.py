import uuid

from django.db import models

from apps.records.models import WasteOilRecord


class AlertNotification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey(
        WasteOilRecord,
        on_delete=models.CASCADE,
        related_name="alert_notifications",
        db_column="record_id",
    )
    level = models.CharField(max_length=10)
    sent_to = models.JSONField(blank=True, null=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    delivery_status = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        db_table = "alert_notifications"
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["record"]),
            models.Index(fields=["sent_at"]),
            models.Index(fields=["level"]),
        ]

    def __str__(self):
        return f"{self.level} for {self.record_id} @ {self.sent_at}"
