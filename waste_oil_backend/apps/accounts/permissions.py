from rest_framework.permissions import BasePermission

from .models import CustomUser


def _role(request):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return None
    return getattr(user, "role", None)


class IsStoreman(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == CustomUser.Role.STOREMAN


class IsTreatment(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == CustomUser.Role.TREATMENT


class IsAdminDept(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == CustomUser.Role.ADMIN


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == CustomUser.Role.MANAGER


class IsGM(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == CustomUser.Role.GM


class IsStoremanGmOrSuperadmin(BasePermission):
    """Storeman, GM, or Superadmin — manage vendor master data."""

    def has_permission(self, request, view):
        return _role(request) in (
            CustomUser.Role.STOREMAN,
            CustomUser.Role.GM,
            CustomUser.Role.SUPERADMIN,
        )


class IsGMOrSuperadmin(BasePermission):
    """General Manager or Superadmin — employee & department management."""

    def has_permission(self, request, view):
        return _role(request) in (
            CustomUser.Role.GM,
            CustomUser.Role.SUPERADMIN,
        )


class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return _role(request) in (
            CustomUser.Role.MANAGER,
            CustomUser.Role.GM,
            CustomUser.Role.SUPERADMIN,
        )


class IsCurrentHolder(BasePermission):
    message = "Only the current holder can perform this action."

    def has_object_permission(self, request, view, obj):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        holder_id = getattr(obj, "current_holder_id", None)
        return holder_id is not None and holder_id == user.id
