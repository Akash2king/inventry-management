from django.contrib import admin

from .models import SystemConfig


@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_by", "updated_at")
    search_fields = ("key", "value")
    readonly_fields = ("updated_at",)
    raw_id_fields = ("updated_by",)
