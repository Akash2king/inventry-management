from django.contrib import admin

from apps.notifications.models import UserNotification


@admin.register(UserNotification)
class UserNotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "kind", "title", "read_at", "created_at")
    list_filter = ("kind", "read_at")
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)
