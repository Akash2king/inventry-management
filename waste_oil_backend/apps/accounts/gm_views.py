from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog

from .gm_serializers import (
    GmDepartmentSerializer,
    GmEmployeeReadSerializer,
    GmEmployeeWriteSerializer,
)
from .models import CustomUser, Department
from .permissions import IsGMOrSuperadmin

# Roles a GM may list, create, and edit (pipeline below GM / stage 5).
GM_MANAGED_ROLES = (
    CustomUser.Role.STOREMAN,
    CustomUser.Role.TREATMENT,
    CustomUser.Role.ADMIN,
    CustomUser.Role.MANAGER,
)


class GmDepartmentListView(generics.ListAPIView):
    """Pipeline departments for assigning employees (stages 1–4 for GM; all for superadmin)."""

    permission_classes = [IsAuthenticated, IsGMOrSuperadmin]
    serializer_class = GmDepartmentSerializer

    def get_queryset(self):
        qs = Department.objects.all().order_by("stage_order")
        if getattr(self.request.user, "role", None) == CustomUser.Role.GM:
            qs = qs.filter(stage_order__lte=4)
        return qs


class GmEmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsGMOrSuperadmin]

    def get_queryset(self):
        qs = CustomUser.objects.select_related("department").order_by(
            "department__stage_order", "username"
        )
        if getattr(self.request.user, "role", None) == CustomUser.Role.GM:
            qs = qs.filter(role__in=GM_MANAGED_ROLES)
        dept = self.request.query_params.get("department_id")
        if dept:
            qs = qs.filter(department_id=dept)
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(full_name__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return GmEmployeeWriteSerializer
        return GmEmployeeReadSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.Action.CREATE,
            description=f"GM created employee account: {user.username} ({user.role}).",
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read = GmEmployeeReadSerializer(serializer.instance)
        return Response(read.data, status=status.HTTP_201_CREATED)


class GmEmployeeDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsGMOrSuperadmin]
    lookup_field = "pk"

    def get_queryset(self):
        qs = CustomUser.objects.select_related("department").all()
        if getattr(self.request.user, "role", None) == CustomUser.Role.GM:
            qs = qs.filter(role__in=GM_MANAGED_ROLES)
        return qs

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return GmEmployeeWriteSerializer
        return GmEmployeeReadSerializer

    def perform_update(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.Action.EDIT,
            description=f"GM updated employee: {user.username} ({user.role}).",
        )
