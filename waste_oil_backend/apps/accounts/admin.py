from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import CustomUser, Department, UserAuthSession


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "stage_order", "created_at")
    list_filter = ("stage_order",)
    search_fields = ("name", "code")
    ordering = ("stage_order",)


@admin.register(UserAuthSession)
class UserAuthSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "client_kind", "device_label", "ip_address", "last_seen_at", "revoked_at")
    list_filter = ("client_kind", "revoked_at")
    raw_id_fields = ("user",)
    readonly_fields = ("id", "refresh_jti", "created_at", "last_seen_at", "revoked_at")
    search_fields = ("device_label", "user__username")


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    list_display = BaseUserAdmin.list_display + ("full_name", "role", "department")
    list_filter = BaseUserAdmin.list_filter + ("role", "department")
    search_fields = BaseUserAdmin.search_fields + ("full_name",)

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Waste oil profile", {"fields": ("full_name", "role", "department")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Waste oil profile", {"fields": ("full_name", "role", "department")}),
    )
