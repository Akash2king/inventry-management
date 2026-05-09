import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class Department(models.Model):
    class WorkflowLayer(models.TextChoices):
        PEER = "peer", _("Peer")
        OVERSIGHT = "oversight", _("Oversight")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    stage_order = models.IntegerField()
    workflow_layer = models.CharField(
        max_length=20,
        choices=WorkflowLayer.choices,
        default=WorkflowLayer.PEER,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "departments"
        ordering = ["stage_order"]
        indexes = [
            models.Index(fields=["stage_order"]),
            models.Index(fields=["workflow_layer"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class CustomUser(AbstractUser):
    REQUIRED_FIELDS = ["email"]

    class Role(models.TextChoices):
        STOREMAN = "storeman", _("Storeman")
        TREATMENT = "treatment", _("Treatment")
        ADMIN = "admin", _("Admin")
        MANAGER = "manager", _("Manager")
        GM = "gm", _("GM")
        SUPERADMIN = "superadmin", _("Superadmin")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    password = models.CharField(_("password"), max_length=128, db_column="password_hash")
    email = models.EmailField(_("email address"), unique=True)
    date_joined = models.DateTimeField(
        _("date joined"),
        db_column="created_at",
        auto_now_add=True,
    )
    full_name = models.CharField(max_length=200, blank=True, null=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STOREMAN,
    )
    department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
        db_column="department_id",
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text="If true, API access is limited until the user changes password (GM-created accounts).",
    )

    class Meta:
        db_table = "users"
        verbose_name = _("user")
        verbose_name_plural = _("users")
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return self.username


class UserAuthSession(models.Model):
    """
    Server-side session row tied to the current refresh token JTI (rotates with SimpleJWT).
    Clients send X-Session-Id (this row's id) on authenticated requests for last_seen updates.
    """

    class ClientKind(models.TextChoices):
        TAURI = "tauri", _("Desktop (Tauri)")
        EXPO = "expo", _("Mobile (Expo)")
        WEB = "web", _("Web browser")
        UNKNOWN = "unknown", _("Unknown")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="auth_sessions",
        db_column="user_id",
    )
    refresh_jti = models.CharField(max_length=255, unique=True, db_index=True)
    client_kind = models.CharField(
        max_length=20,
        choices=ClientKind.choices,
        default=ClientKind.UNKNOWN,
    )
    device_label = models.CharField(max_length=200, blank=True)
    app_version = models.CharField(max_length=80, blank=True)
    platform = models.CharField(max_length=120, blank=True)
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_auth_sessions"
        indexes = [
            models.Index(fields=["user", "-last_seen_at"]),
            models.Index(fields=["user", "revoked_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} {self.client_kind} {self.id}"
