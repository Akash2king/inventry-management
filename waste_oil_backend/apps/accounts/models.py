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
