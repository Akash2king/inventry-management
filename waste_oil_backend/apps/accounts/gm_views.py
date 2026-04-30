from django.db.models import Q
from rest_framework import generics, status

from apps.workflow.models import StageTransition
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.notifications.services import NotificationService

from .gm_serializers import (
    GmDepartmentSerializer,
    GmDepartmentWriteSerializer,
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


class GmDepartmentListCreateView(generics.ListCreateAPIView):
    """List and create departments for peer/oversight hierarchy management."""

    permission_classes = [IsAuthenticated, IsGMOrSuperadmin]

    def get_queryset(self):
        return Department.objects.all().order_by("workflow_layer", "stage_order", "name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return GmDepartmentWriteSerializer
        return GmDepartmentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dept = serializer.save()
        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.CREATE,
            description=f"GM created department {dept.name} ({dept.code}) stage {dept.stage_order}.",
        )
        read = GmDepartmentSerializer(dept)
        return Response(read.data, status=status.HTTP_201_CREATED)


class GmDepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve / update / delete a department."""

    permission_classes = [IsAuthenticated, IsGMOrSuperadmin]
    lookup_field = "pk"

    def get_queryset(self):
        return Department.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return GmDepartmentWriteSerializer
        return GmDepartmentSerializer

    def perform_update(self, serializer):
        dept = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.Action.EDIT,
            description=f"GM updated department {dept.name} ({dept.code}).",
        )

    def perform_destroy(self, instance):
        if instance.members.exists():
            raise PermissionDenied(
                "Remove or reassign all users assigned to this department before deleting."
            )
        if StageTransition.objects.filter(
            Q(from_department_id=instance.id) | Q(to_department_id=instance.id)
        ).exists():
            raise PermissionDenied(
                "Cannot delete: workflow history references this department."
            )
        name = instance.name
        code = instance.code
        instance.delete()
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            description=f"GM deleted department {name} ({code}).",
        )


class GmEmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsGMOrSuperadmin]

    def get_queryset(self):
        qs = CustomUser.objects.select_related("department").order_by(
            "department__workflow_layer", "department__stage_order", "username"
        )
        qs = qs.filter(department__isnull=False)
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

    def create(self, request, *args, **kwargs):
        plain_password = (request.data.get("password") or "").strip()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.CREATE,
            description=f"GM created employee account: {user.username} ({user.role}).",
        )
        if plain_password and (user.email or "").strip():
            NotificationService.send_welcome_employee_email(user, plain_password)
        read = GmEmployeeReadSerializer(user)
        return Response(read.data, status=status.HTTP_201_CREATED)


class GmEmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
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

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise PermissionDenied("You cannot delete your own account.")
        username = instance.username
        role = instance.role
        instance.delete()
        AuditLog.objects.create(
            user=self.request.user,
            action=AuditLog.Action.DELETE,
            description=f"GM removed employee account: {username} ({role}).",
        )
