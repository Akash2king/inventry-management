from django.contrib import admin

from .models import AlertNotification


@admin.register(AlertNotification)
class AlertNotificationAdmin(admin.ModelAdmin):
    list_display = ("record", "level", "sent_at", "delivery_status")
    list_filter = ("level", "delivery_status", "sent_at")
    search_fields = ("record__record_number",)
    readonly_fields = ("sent_at",)
    raw_id_fields = ("record",)
