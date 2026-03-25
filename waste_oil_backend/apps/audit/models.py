import uuid

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import models

from apps.records.models import WasteOilRecord


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        EDIT = "EDIT", "Edit"
        FORWARD = "FORWARD", "Forward"
        RETURN = "RETURN", "Return"
        APPROVE = "APPROVE", "Approve"
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        EXPORT = "EXPORT", "Export"
        ALERT_SENT = "ALERT_SENT", "Alert sent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_entries",
        db_column="user_id",
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    record = models.ForeignKey(
        WasteOilRecord,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_entries",
        db_column="record_id",
    )
    description = models.TextField(blank=True, null=True)
    previous_data = models.JSONField(blank=True, null=True)
    new_data = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True, unpack_ipv4=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_log"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["record"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"{self.action} @ {self.timestamp}"

    def save(self, *args, **kwargs):
        if self.pk is not None and not self._state.adding:
            raise PermissionDenied("Audit log entries cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        raise PermissionDenied("Audit log entries cannot be deleted.")
