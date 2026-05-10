import mimetypes

from django.core.files.storage import default_storage
from django.db.models import Exists, OuterRef, Q
from django.db.models.deletion import ProtectedError
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import (
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CustomUser
from apps.accounts.permissions import (
    IsCurrentHolder,
    IsStoreman,
    IsStoremanGmOrSuperadmin,
)
from apps.workflow.models import StageTransition

from .models import RecordOption, Vendor, WasteOilRecord
from .serializers import (
    RecordCreateSerializer,
    RecordDetailSerializer,
    RecordListSerializer,
    RecordOptionSerializer,
    RecordUpdateSerializer,
    VendorSerializer,
)
from .services import RecordService
from .workflow_attention import annotate_workflow_attention_queryset

# Pipeline stage for queue + treatment/admin record visibility (role is source of truth).
_PIPELINE_ROLE_STAGE = {
    CustomUser.Role.STOREMAN: 1,
    CustomUser.Role.TREATMENT: 2,
    CustomUser.Role.ADMIN: 3,
    CustomUser.Role.MANAGER: 4,
    CustomUser.Role.GM: 5,
}


def workflow_queue_stage_for_user(user) -> int | None:
    """Stage used for workflow queue and treatment/admin queryset filtering."""
    if not user.is_authenticated:
        return None
    role = user.role
    if role == CustomUser.Role.SUPERADMIN:
        dept = getattr(user, "department", None)
        if dept:
            return dept.stage_order
        return _PIPELINE_ROLE_STAGE[CustomUser.Role.GM]
    return _PIPELINE_ROLE_STAGE.get(role)


class RecordPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def base_records_queryset():
    return WasteOilRecord.objects.select_related(
        "vendor", "current_holder", "current_department", "created_by"
    )


def records_visible_to_user(user):
    qs = base_records_queryset()
    if not user.is_authenticated:
        return qs.none()
    role = user.role
    if role in (CustomUser.Role.MANAGER, CustomUser.Role.GM, CustomUser.Role.SUPERADMIN):
        return qs
    # Below manager level, users can only see records they currently hold.
    # Once they forward a record away, it leaves their visible set.
    if role in (CustomUser.Role.STOREMAN, CustomUser.Role.TREATMENT, CustomUser.Role.ADMIN):
        return qs.filter(current_holder=user).exclude(
            alert_level=WasteOilRecord.AlertLevel.COMPLETED
        )
    return qs.none()


def _query_truthy(value) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def apply_list_filters(qs, request):
    p = request.query_params
    if stage := p.get("stage"):
        if str(stage).isdigit():
            qs = qs.filter(current_stage=int(stage))
    if al := p.get("alert_level"):
        # For completed records we can safely filter on the stored column.
        if al == WasteOilRecord.AlertLevel.COMPLETED:
            qs = qs.filter(alert_level=al)
        else:
            # Other alert levels are derived from SLA percentage (entry_date → due_date).
            # Filter using the model's computed_alert_level to ensure consistency with
            # the dashboard and badges, then constrain the queryset by ids.
            matching_ids = [r.id for r in qs if r.computed_alert_level == al]
            qs = qs.filter(id__in=matching_ids)
    if dept := p.get("department_id"):
        qs = qs.filter(current_department_id=dept)
    if df := p.get("date_from"):
        qs = qs.filter(entry_date__gte=df)
    if dt := p.get("date_to"):
        qs = qs.filter(entry_date__lte=dt)
    if search := p.get("search"):
        qs = qs.filter(
            Q(vendor__name__icontains=search)
            | Q(record_number__icontains=search)
            | Q(product_description__icontains=search)
            | Q(product_type__icontains=search)
        )
    if _query_truthy(p.get("exclude_completed")):
        qs = qs.exclude(alert_level=WasteOilRecord.AlertLevel.COMPLETED)
    if _query_truthy(p.get("overdue")):
        qs = qs.filter(due_date__lt=timezone.localdate()).exclude(
            alert_level=WasteOilRecord.AlertLevel.COMPLETED
        )
    return qs


class WasteOilRecordListCreateView(ListCreateAPIView):
    pagination_class = RecordPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsStoreman()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RecordCreateSerializer
        return RecordListSerializer

    def get_queryset(self):
        qs = records_visible_to_user(self.request.user)
        qs = apply_list_filters(qs, self.request)
        if self.request.method == "GET":
            qs = annotate_workflow_attention_queryset(qs)
        return qs.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = RecordService.create(
            request.user, serializer.validated_data, request=request
        )
        return Response(
            RecordDetailSerializer(record, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class WasteOilRecordDetailView(RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    lookup_field = "pk"

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsAuthenticated(), IsCurrentHolder()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return RecordUpdateSerializer
        return RecordDetailSerializer

    def get_queryset(self):
        qs = records_visible_to_user(self.request.user)
        return annotate_workflow_attention_queryset(qs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        record = RecordService.apply_patch(
            request.user, instance, serializer.validated_data, request=request
        )
        return Response(
            RecordDetailSerializer(record, context={"request": request}).data
        )


class VendorListCreateView(ListCreateAPIView):
    """Vendor master list (all authenticated) and create (storeman / GM / superadmin)."""

    serializer_class = VendorSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsStoremanGmOrSuperadmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Vendor.objects.all().order_by("name", "id")


class VendorDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = VendorSerializer
    lookup_field = "pk"

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT", "DELETE"):
            return [IsAuthenticated(), IsStoremanGmOrSuperadmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Vendor.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {
                    "detail": "Cannot delete this vendor because waste oil records still reference it.",
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WasteOilRecordAttachmentView(APIView):
    permission_classes = [IsAuthenticated, IsCurrentHolder]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk, *args, **kwargs):
        record = get_object_or_404(records_visible_to_user(request.user), pk=pk)
        self.check_object_permissions(request, record)
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "Multipart file field 'file' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        path = RecordService.save_attachment(
            record, upload, request.user, request=request
        )
        return Response({"path": path}, status=status.HTTP_201_CREATED)


class WasteOilRecordPhotoView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    max_photo_bytes = 200 * 1024

    def get_permissions(self):
        if self.request.method == "OPTIONS":
            return [AllowAny()]
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsCurrentHolder()]

    def get(self, request, pk, *args, **kwargs):
        """Serve entry photo with JWT (browser <img> cannot send Authorization to /media/)."""
        record = get_object_or_404(records_visible_to_user(request.user), pk=pk)
        if not record.photo_path:
            return Response(
                {"detail": "No photo for this record."},
                status=status.HTTP_404_NOT_FOUND,
            )
        rel = str(record.photo_path).replace("\\", "/").lstrip("/")
        if not default_storage.exists(rel):
            return Response(
                {"detail": "Photo file missing."},
                status=status.HTTP_404_NOT_FOUND,
            )
        content_type = (
            mimetypes.guess_type(rel)[0] or "application/octet-stream"
        )
        fh = default_storage.open(rel, "rb")
        return FileResponse(fh, content_type=content_type)

    def post(self, request, pk, *args, **kwargs):
        record = get_object_or_404(records_visible_to_user(request.user), pk=pk)
        self.check_object_permissions(request, record)
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "Multipart file field 'file' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > self.max_photo_bytes:
            return Response(
                {"detail": "Photo must be 200KB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content_type = (getattr(upload, "content_type", "") or "").lower()
        if not content_type.startswith("image/"):
            return Response(
                {"detail": "Only image files are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        path = RecordService.save_photo(record, upload, request.user, request=request)
        return Response({"path": path}, status=status.HTTP_201_CREATED)


class RecordOptionListCreateView(ListCreateAPIView):
    serializer_class = RecordOptionSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsStoremanGmOrSuperadmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = RecordOption.objects.all()
        if category := self.request.query_params.get("category"):
            qs = qs.filter(category=category)
        return qs.order_by("category", "value", "id")


class RecordOptionDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = RecordOptionSerializer
    lookup_field = "pk"

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT", "DELETE"):
            return [IsAuthenticated(), IsStoremanGmOrSuperadmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return RecordOption.objects.all()


@api_view(["GET"])
@permission_classes([AllowAny])
def api_health(_request):
    return Response(
        {
            "status": "ok",
            "version": "1.0.0",
            "timestamp": timezone.now().isoformat(),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def records_health(_request):
    return Response({"app": "records", "status": "ok"})
