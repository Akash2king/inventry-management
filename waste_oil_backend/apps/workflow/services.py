from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import CustomUser, Department
from apps.audit.models import AuditLog
from apps.audit.services import AuditService
from apps.notifications.tasks import (
    send_forwarded_notification,
    send_return_notification,
)
from apps.records.models import WasteOilRecord
from apps.workflow.models import StageTransition


class WorkflowService:
    @staticmethod
    def _next_transition_sequence(record: WasteOilRecord) -> int:
        m = StageTransition.objects.filter(record=record).aggregate(
            Max("sequence")
        )
        return (m["sequence__max"] or 0) + 1

    @staticmethod
    def _assert_stage_actor(user, record: WasteOilRecord) -> None:
        dept = getattr(user, "department", None)
        if dept is None or dept.stage_order != record.current_stage:
            raise PermissionDenied(
                "Your department does not match this record's current stage."
            )

    @staticmethod
    def _first_holder_for_stage(stage_order: int) -> CustomUser | None:
        return (
            CustomUser.objects.filter(
                is_active=True,
                department__stage_order=stage_order,
            )
            .order_by("date_joined", "id")
            .first()
        )

    @staticmethod
    def _resolve_next_holder(
        next_stage: int, explicit: CustomUser | None
    ) -> CustomUser:
        if explicit is not None:
            if not explicit.is_active:
                raise ValidationError(
                    {
                        "next_holder_id": "Selected user is not active.",
                    },
                    code="invalid",
                )
            dept = getattr(explicit, "department", None)
            if dept is None or dept.stage_order != next_stage:
                raise ValidationError(
                    {
                        "next_holder_id": (
                            "Selected user must belong to the next pipeline stage."
                        ),
                    },
                    code="invalid",
                )
            return explicit
        picked = WorkflowService._first_holder_for_stage(next_stage)
        if picked is None:
            raise ValidationError(
                {
                    "detail": f"No active user found for stage {next_stage}.",
                },
                code="invalid",
            )
        return picked

    @staticmethod
    @transaction.atomic
    def forward(
        record: WasteOilRecord,
        user: CustomUser,
        note: str = "",
        *,
        next_holder: CustomUser | None = None,
        request=None,
    ) -> WasteOilRecord:
        WorkflowService._assert_stage_actor(user, record)

        if record.is_locked:
            raise ValidationError(
                {"detail": "Record is locked; it cannot be forwarded."},
                code="invalid",
            )

        note = (note or "").strip()
        from_stage = record.current_stage
        from_dept = record.current_department
        from_holder = record.current_holder

        if record.current_stage == 5:
            record.is_locked = True
            record.alert_level = WasteOilRecord.AlertLevel.COMPLETED
            record.updated_at = timezone.now()
            record.save(
                update_fields=["is_locked", "alert_level", "updated_at"]
            )

            StageTransition.objects.create(
                record=record,
                sequence=WorkflowService._next_transition_sequence(record),
                from_stage=from_stage,
                to_stage=5,
                from_department=from_dept,
                to_department=from_dept,
                transitioned_by=user,
                transition_type=StageTransition.TransitionType.FORWARD,
                note=note or None,
            )

            AuditService.log(
                user,
                AuditLog.Action.APPROVE,
                record,
                description="Record completed at final stage.",
                request=request,
            )

            # Run in-process after commit so mail is sent without a Celery worker.
            rid_final = str(record.id)
            from_uid = str(user.id)
            transaction.on_commit(
                lambda: send_forwarded_notification.apply(
                    args=(rid_final, None, from_uid)
                )
            )
            record.refresh_from_db()
            return record

        next_stage = record.current_stage + 1
        next_holder = WorkflowService._resolve_next_holder(next_stage, next_holder)
        next_dept = getattr(next_holder, "department", None)
        if next_dept is None:
            raise ValidationError(
                {"detail": "Next holder has no department assigned."},
                code="invalid",
            )

        StageTransition.objects.create(
            record=record,
            sequence=WorkflowService._next_transition_sequence(record),
            from_stage=from_stage,
            to_stage=next_stage,
            from_department=from_dept,
            to_department=next_dept,
            transitioned_by=user,
            transition_type=StageTransition.TransitionType.FORWARD,
            note=note or None,
        )

        record.current_stage = next_stage
        record.current_holder = next_holder
        record.current_department = next_dept
        record.updated_at = timezone.now()
        record.save(
            update_fields=[
                "current_stage",
                "current_holder",
                "current_department",
                "updated_at",
            ]
        )

        AuditService.log(
            user,
            AuditLog.Action.FORWARD,
            record,
            description=f"Forwarded to stage {next_stage}.",
            request=request,
        )

        nh_id = str(next_holder.id)
        rid_fwd = str(record.id)
        from_uid = str(user.id)
        transaction.on_commit(
            lambda: send_forwarded_notification.apply(
                args=(rid_fwd, nh_id, from_uid)
            )
        )

        record.refresh_from_db()
        return record

    @staticmethod
    def _resolve_previous_holder_on_return(
        record: WasteOilRecord,
    ) -> tuple[CustomUser | None, Department | None]:
        prev_stage = record.current_stage - 1
        last_forward = (
            StageTransition.objects.filter(
                record=record,
                to_stage=record.current_stage,
                transition_type=StageTransition.TransitionType.FORWARD,
            )
            .order_by("-sequence")
            .first()
        )
        if last_forward and last_forward.transitioned_by_id:
            prev_holder = last_forward.transitioned_by
            prev_dept = last_forward.from_department or getattr(
                prev_holder, "department", None
            )
            return prev_holder, prev_dept

        prev_holder = WorkflowService._first_holder_for_stage(prev_stage)
        prev_dept = Department.objects.filter(stage_order=prev_stage).first()
        return prev_holder, prev_dept

    @staticmethod
    @transaction.atomic
    def return_record(
        record: WasteOilRecord,
        user: CustomUser,
        reason: str,
        *,
        request=None,
    ) -> WasteOilRecord:
        WorkflowService._assert_stage_actor(user, record)

        reason_clean = (reason or "").strip()
        if not reason_clean:
            raise ValidationError(
                {"reason": ["This field may not be blank."]},
                code="blank",
            )

        if record.current_stage <= 1:
            raise ValidationError(
                {"detail": "Cannot return a record from stage 1."},
                code="invalid",
            )

        if record.is_locked:
            raise ValidationError(
                {"detail": "Record is locked; it cannot be returned."},
                code="invalid",
            )

        from_stage = record.current_stage
        from_dept = record.current_department
        to_stage = from_stage - 1

        prev_holder, prev_dept = WorkflowService._resolve_previous_holder_on_return(
            record
        )
        if prev_holder is None:
            raise ValidationError(
                {"detail": "Could not resolve previous holder from history."},
                code="invalid",
            )

        StageTransition.objects.create(
            record=record,
            sequence=WorkflowService._next_transition_sequence(record),
            from_stage=from_stage,
            to_stage=to_stage,
            from_department=from_dept,
            to_department=prev_dept,
            transitioned_by=user,
            transition_type=StageTransition.TransitionType.RETURN,
            note=reason_clean,
        )

        record.current_stage = to_stage
        record.current_holder = prev_holder
        record.current_department = prev_dept
        record.updated_at = timezone.now()
        record.save(
            update_fields=[
                "current_stage",
                "current_holder",
                "current_department",
                "updated_at",
            ]
        )

        AuditService.log(
            user,
            AuditLog.Action.RETURN,
            record,
            description=f"Returned to stage {to_stage}: {reason_clean[:500]}",
            request=request,
        )

        ph_id = str(prev_holder.id)
        rid_ret = str(record.id)
        reason_copy = reason_clean
        from_uid = str(user.id)
        transaction.on_commit(
            lambda: send_return_notification.apply(
                args=(rid_ret, ph_id, reason_copy, from_uid)
            )
        )

        record.refresh_from_db()
        return record
