"""Detect when a record was last moved by a return (needs correction at current stage)."""

from apps.workflow.models import StageTransition


def annotate_workflow_attention_queryset(qs):
    """Reserved for future DB-level optimization; list/detail use ORM lookup for correctness."""
    return qs


def correction_state_for_record(obj):
    """
    Returns (needs_correction: bool, feedback: str | None).
    True when the latest transition is a return into the record's current stage.
    """
    t = (
        StageTransition.objects.filter(record_id=obj.pk)
        .order_by("-sequence")
        .only("transition_type", "to_stage", "note")
        .first()
    )
    if not t:
        return False, None
    needs = (
        t.transition_type == StageTransition.TransitionType.RETURN
        and t.to_stage == obj.current_stage
    )
    if not needs:
        return False, None
    out = (t.note or "").strip()
    return True, out or None
