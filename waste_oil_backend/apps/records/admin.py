from django.contrib import admin

from .models import Vendor, WasteOilRecord


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name", "notes")
    ordering = ("name",)


@admin.register(WasteOilRecord)
class WasteOilRecordAdmin(admin.ModelAdmin):
    list_display = (
        "record_number",
        "vendor",
        "product_type",
        "entry_date",
        "due_date",
        "current_stage",
        "alert_level",
        "is_locked",
        "created_at",
    )
    list_filter = ("current_stage", "alert_level", "is_locked", "entry_date")
    search_fields = ("record_number", "product_type", "product_description", "vendor__name")
    readonly_fields = ("created_at", "updated_at")
    raw_id_fields = ("vendor", "current_holder", "current_department", "created_by")
    date_hierarchy = "entry_date"
