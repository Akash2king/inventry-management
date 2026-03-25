import uuid
from datetime import date

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.accounts.models import Department


class Vendor(models.Model):
    """Supplier / vendor master data — selected when creating inventory records."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    contact = models.CharField(max_length=200, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vendors"
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class WasteOilRecord(models.Model):
    class AlertLevel(models.TextChoices):
        GREEN = "green", "Green"
        YELLOW = "yellow", "Yellow"
        RED = "red", "Red"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record_number = models.CharField(max_length=30, unique=True)
    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.PROTECT,
        related_name="records",
        db_column="vendor_id",
    )
    product_description = models.TextField(blank=True)
    product_type = models.CharField(max_length=120)
    unit = models.CharField(max_length=40)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    entry_date = models.DateField()
    due_date = models.DateField()
    remarks = models.TextField(blank=True, null=True)
    attachment_paths = models.JSONField(default=list)
    current_stage = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    current_holder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="held_waste_oil_records",
        db_column="current_holder_id",
    )
    current_department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="current_waste_oil_records",
        db_column="current_department_id",
    )
    is_locked = models.BooleanField(default=False)
    alert_level = models.CharField(
        max_length=10,
        choices=AlertLevel.choices,
        default=AlertLevel.GREEN,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_waste_oil_records",
        db_column="created_by_id",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "waste_oil_records"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["current_stage"]),
            models.Index(fields=["alert_level"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["entry_date"]),
            models.Index(fields=["due_date"]),
        ]

    def __str__(self):
        return self.record_number

    @property
    def days_elapsed(self) -> int:
        today: date = timezone.now().date()
        return (today - self.entry_date).days

    @property
    def computed_alert_level(self) -> str:
        from apps.admin_console.models import SystemConfig

        if self.is_locked or self.alert_level == self.AlertLevel.COMPLETED:
            return self.AlertLevel.COMPLETED

        days = self.days_elapsed
        yellow = SystemConfig.get_value(
            "YELLOW_THRESHOLD",
            default=getattr(settings, "YELLOW_THRESHOLD", 21),
            cast=int,
        )
        red = SystemConfig.get_value(
            "RED_THRESHOLD",
            default=getattr(settings, "RED_THRESHOLD", 26),
            cast=int,
        )
        if days >= red:
            return self.AlertLevel.RED
        if days >= yellow:
            return self.AlertLevel.YELLOW
        return self.AlertLevel.GREEN
