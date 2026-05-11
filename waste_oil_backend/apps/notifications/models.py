import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserNotification(models.Model):
    """
    In-app notifications: workflow/business mail parity (forward, return, SLA, welcome, …).
    Session/sign-in alerts are intentionally not stored here — use Devices + audit logs if needed.
    """

    class Kind(models.TextChoices):
        RECORD_FORWARDED = "record_forwarded", _("Record forwarded")
        RECORD_RETURNED = "record_returned", _("Record returned")
        RECORD_COMPLETED = "record_completed", _("Record completed")
        SLA_ALERT = "sla_alert", _("SLA alert")
        MONTHLY_REPORT = "monthly_report", _("Monthly report")
        WELCOME_EMPLOYEE = "welcome_employee", _("Welcome")
        CUSTOM_BROADCAST = "custom_broadcast", _("Broadcast")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="in_app_notifications",
    )
    kind = models.CharField(max_length=40, choices=Kind.choices)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def workflow_kind_values(cls) -> frozenset[str]:
        return frozenset(c.value for c in cls.Kind)

    class Meta:
        db_table = "user_notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "read_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} {self.kind} {self.created_at}"


class NotificationDevice(models.Model):
    """Device push tokens registered for a user (FCM on Android; iOS reserved for future APNs)."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="devices"
    )
    token = models.CharField(max_length=512, db_index=True)
    platform = models.CharField(max_length=16, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notification_devices"
        unique_together = ("user", "token")

    def __str__(self):
        return f"{self.user_id} {self.platform} {self.token[:12]}"
