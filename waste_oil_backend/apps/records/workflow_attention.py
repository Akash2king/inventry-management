"""Detect when a record was last moved by a return (needs correction at current stage)."""

from django.db.models import Exists, OuterRef, Subquery

from apps.workflow.models import StageTransition


def annotate_workflow_attention_queryset(qs, user=None):
    """
    Attach latest-transition fields (and optional viewer_forward Exists) so list/queue
    serializers avoid per-row StageTransition queries.
    """
    latest = StageTransition.objects.filter(record_id=OuterRef("pk")).order_by(
        "-sequence"
    )
    qs = qs.annotate(
        _att_transition_type=Subquery(latest.values("transition_type")[:1]),
        _att_to_stage=Subquery(latest.values("to_stage")[:1]),
        _att_note=Subquery(latest.values("note")[:1]),
    )
    if user is not None and getattr(user, "is_authenticated", False):
        forwarded = StageTransition.objects.filter(
            record_id=OuterRef("pk"),
            transition_type=StageTransition.TransitionType.FORWARD,
            transitioned_by_id=user.id,
        )
        qs = qs.annotate(_viewer_has_forward=Exists(forwarded))
    return qs


def correction_state_for_record(obj):
    """
    Returns (needs_correction: bool, feedback: str | None).
    True when the latest transition is a return into the record's current stage.
    Prefer annotated fields from annotate_workflow_attention_queryset when present.
    """
    t_type = getattr(obj, "_att_transition_type", None)
    t_stage = getattr(obj, "_att_to_stage", None)
    t_note = getattr(obj, "_att_note", None)
    if t_type is None and not hasattr(obj, "_att_transition_type"):
        t = (
            StageTransition.objects.filter(record_id=obj.pk)
            .order_by("-sequence")
            .only("transition_type", "to_stage", "note")
            .first()
        )
        if not t:
            return False, None
        t_type = t.transition_type
        t_stage = t.to_stage
        t_note = t.note

    if not t_type:
        return False, None
    needs = (
        t_type == StageTransition.TransitionType.RETURN
        and t_stage == obj.current_stage
    )
    if not needs:
        return False, None
    out = (t_note or "").strip()
    return True, out or None
