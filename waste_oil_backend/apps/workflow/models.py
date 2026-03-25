import uuid

from django.conf import settings
from django.db import models

from apps.accounts.models import Department
from apps.records.models import WasteOilRecord


class StageTransition(models.Model):
    class TransitionType(models.TextChoices):
        FORWARD = "forward", "Forward"
        RETURN = "return", "Return"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey(
        WasteOilRecord,
        on_delete=models.CASCADE,
        related_name="stage_transitions",
        db_column="record_id",
    )
    from_stage = models.IntegerField()
    to_stage = models.IntegerField()
    from_department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transitions_from",
        db_column="from_department_id",
    )
    to_department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transitions_to",
        db_column="to_department_id",
    )
    transitioned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stage_transitions_made",
        db_column="transitioned_by_id",
    )
    transition_type = models.CharField(
        max_length=10,
        choices=TransitionType.choices,
    )
    note = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    sequence = models.PositiveIntegerField(
        default=0,
        help_text="Monotonic per record — defines true chronological order of transitions.",
    )

    class Meta:
        db_table = "stage_transitions"
        ordering = ["sequence"]
        indexes = [
            models.Index(fields=["record"]),
            models.Index(fields=["timestamp"]),
            models.Index(fields=["record", "sequence"]),
        ]

    def __str__(self):
        return f"{self.record_id}: {self.from_stage} → {self.to_stage} ({self.transition_type})"
