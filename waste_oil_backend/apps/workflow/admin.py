from django.contrib import admin

from .models import StageTransition


@admin.register(StageTransition)
class StageTransitionAdmin(admin.ModelAdmin):
    list_display = (
        "record",
        "from_stage",
        "to_stage",
        "transition_type",
        "transitioned_by",
        "timestamp",
    )
    list_filter = ("transition_type", "from_stage", "to_stage")
    search_fields = ("record__record_number", "note")
    readonly_fields = ("timestamp",)
    raw_id_fields = ("record", "from_department", "to_department", "transitioned_by")
