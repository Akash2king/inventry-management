from django.db.models import Case, IntegerField, When
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CustomUser
from apps.accounts.permissions import IsCurrentHolder
from apps.records.serializers import RecordDetailSerializer, StageTransitionSerializer
from apps.records.views import records_visible_to_user, workflow_queue_stage_for_user
from apps.records.workflow_attention import (
    annotate_workflow_attention_queryset,
    correction_state_for_record,
)
from apps.workflow.constants import ALERT_LEVEL_ORDER
from apps.workflow.serializers import (
    ForwardCandidateSerializer,
    ForwardSerializer,
    ReturnSerializer,
)
from apps.workflow.services import WorkflowService


def _record_for_user(user, record_id):
    return get_object_or_404(records_visible_to_user(user), pk=record_id)


class RecordForwardView(APIView):
    permission_classes = [IsAuthenticated, IsCurrentHolder]

    def post(self, request, record_id, *args, **kwargs):
        record = _record_for_user(request.user, record_id)
        self.check_object_permissions(request, record)

        ser = ForwardSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        nh_id = ser.validated_data.get("next_holder_id")
        explicit = None
        if nh_id is not None:
            explicit = (
                CustomUser.objects.select_related("department")
                .filter(pk=nh_id)
                .first()
            )
            if explicit is None:
                raise ValidationError(
                    {"next_holder_id": "User not found."},
                    code="invalid",
                )
        record = WorkflowService.forward(
            record,
            request.user,
            ser.validated_data.get("note", ""),
            next_holder=explicit,
            request=request,
        )
        return Response(
            RecordDetailSerializer(record, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class RecordForwardCandidatesView(APIView):
    """Active users at the next pipeline stage (for choosing who receives the record)."""

    permission_classes = [IsAuthenticated, IsCurrentHolder]

    def get(self, request, record_id, *args, **kwargs):
        record = _record_for_user(request.user, record_id)
        self.check_object_permissions(request, record)
        if record.current_stage >= 5:
            return Response([])
        next_stage = record.current_stage + 1
        qs = (
            CustomUser.objects.filter(
                is_active=True,
                department__stage_order=next_stage,
            )
            .select_related("department")
            .order_by("full_name", "username")
        )
        return Response(ForwardCandidateSerializer(qs, many=True).data)


class RecordReturnView(APIView):
    permission_classes = [IsAuthenticated, IsCurrentHolder]

    def post(self, request, record_id, *args, **kwargs):
        record = _record_for_user(request.user, record_id)
        self.check_object_permissions(request, record)

        ser = ReturnSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        record = WorkflowService.return_record(
            record,
            request.user,
            ser.validated_data["reason"],
            request=request,
        )
        return Response(
            RecordDetailSerializer(record, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class RecordTransitionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, record_id, *args, **kwargs):
        record = _record_for_user(request.user, record_id)
        qs = (
            record.stage_transitions.select_related(
                "transitioned_by", "from_department", "to_department"
            )
            .order_by("sequence", "timestamp")
        )
        return Response(StageTransitionSerializer(qs, many=True).data)


class WorkflowQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        stage = workflow_queue_stage_for_user(user)
        if stage is None:
            return Response([])

        whens = [
            When(alert_level=k, then=v) for k, v in ALERT_LEVEL_ORDER.items()
        ]
        rank = Case(*whens, default=99, output_field=IntegerField())

        qs = (
            annotate_workflow_attention_queryset(
                records_visible_to_user(user).filter(
                    current_stage=stage,
                    is_locked=False,
                )
            )
            .annotate(_alert_rank=rank)
            .order_by("_alert_rank", "entry_date")
        )

        out = []
        for r in qs:
            needs_fix, return_fb = correction_state_for_record(r)
            out.append(
                {
                    "id": r.id,
                    "record_number": r.record_number,
                    "vendor_name": r.vendor.name if r.vendor_id else "",
                    "quantity": r.quantity,
                    "unit": r.unit,
                    "days_elapsed": r.days_elapsed,
                    "sla_total_days": r.sla_total_days,
                    "alert_level": r.alert_level,
                    "computed_alert_level": r.computed_alert_level,
                    "due_date": r.due_date,
                    "entry_date": r.entry_date,
                    "needs_workflow_correction": needs_fix,
                    "pending_return_feedback": return_fb,
                }
            )
        return Response(out)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"app": "workflow", "status": "ok"})
