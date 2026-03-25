from rest_framework import serializers

from apps.workflow.models import StageTransition

from .models import Vendor, WasteOilRecord
from .workflow_attention import correction_state_for_record


def _cached_correction(serializer, obj):
    cache = serializer.context.setdefault("_correction_cache", {})
    pk = obj.pk
    if pk not in cache:
        cache[pk] = correction_state_for_record(obj)
    return cache[pk]


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ("id", "name", "contact", "address", "notes", "created_at")
        read_only_fields = ("id", "created_at")


class VendorBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ("id", "name", "contact", "address", "notes")
        read_only_fields = fields


class StageTransitionSerializer(serializers.ModelSerializer):
    from_department_name = serializers.CharField(
        source="from_department.name", read_only=True, allow_null=True
    )
    to_department_name = serializers.CharField(
        source="to_department.name", read_only=True, allow_null=True
    )
    transitioned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StageTransition
        fields = (
            "id",
            "sequence",
            "from_stage",
            "to_stage",
            "from_department_id",
            "to_department_id",
            "from_department_name",
            "to_department_name",
            "transitioned_by_id",
            "transitioned_by_name",
            "transition_type",
            "note",
            "timestamp",
        )
        read_only_fields = fields

    def get_transitioned_by_name(self, obj):
        u = obj.transitioned_by
        if not u:
            return None
        name = u.get_full_name()
        if name and name.strip():
            return name
        return getattr(u, "full_name", None) or u.username


class RecordListSerializer(serializers.ModelSerializer):
    days_elapsed = serializers.SerializerMethodField()
    current_department_name = serializers.CharField(
        source="current_department.name", read_only=True, allow_null=True
    )
    current_holder_name = serializers.SerializerMethodField()
    current_holder_username = serializers.SerializerMethodField()
    vendor_id = serializers.UUIDField(read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    needs_workflow_correction = serializers.SerializerMethodField()
    pending_return_feedback = serializers.SerializerMethodField()

    class Meta:
        model = WasteOilRecord
        fields = (
            "id",
            "record_number",
            "vendor_id",
            "vendor_name",
            "product_description",
            "product_type",
            "unit",
            "quantity",
            "entry_date",
            "due_date",
            "days_elapsed",
            "alert_level",
            "current_stage",
            "current_department_name",
            "current_holder_name",
            "current_holder_username",
            "needs_workflow_correction",
            "pending_return_feedback",
        )
        read_only_fields = fields

    def get_days_elapsed(self, obj):
        return obj.days_elapsed

    def get_current_holder_name(self, obj):
        u = obj.current_holder
        if not u:
            return None
        name = u.get_full_name()
        if name and name.strip():
            return name
        return u.full_name or u.username

    def get_current_holder_username(self, obj):
        u = obj.current_holder
        return u.username if u else None

    def get_needs_workflow_correction(self, obj):
        return _cached_correction(self, obj)[0]

    def get_pending_return_feedback(self, obj):
        return _cached_correction(self, obj)[1]


class RecordDetailSerializer(serializers.ModelSerializer):
    days_elapsed = serializers.SerializerMethodField()
    computed_alert_level = serializers.SerializerMethodField()
    current_department_name = serializers.CharField(
        source="current_department.name", read_only=True, allow_null=True
    )
    current_holder_name = serializers.SerializerMethodField()
    current_holder_username = serializers.SerializerMethodField()
    viewer_is_holder = serializers.SerializerMethodField()
    needs_workflow_correction = serializers.SerializerMethodField()
    pending_return_feedback = serializers.SerializerMethodField()
    vendor_id = serializers.UUIDField(read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    vendor = VendorBriefSerializer(read_only=True)
    created_by_id = serializers.UUIDField(read_only=True)
    stage_transitions = serializers.SerializerMethodField()
    recent_audit = serializers.SerializerMethodField()

    class Meta:
        model = WasteOilRecord
        fields = (
            "id",
            "record_number",
            "vendor_id",
            "vendor_name",
            "vendor",
            "product_description",
            "product_type",
            "unit",
            "quantity",
            "entry_date",
            "due_date",
            "remarks",
            "attachment_paths",
            "current_stage",
            "current_holder_id",
            "current_department_id",
            "current_department_name",
            "current_holder_name",
            "current_holder_username",
            "viewer_is_holder",
            "needs_workflow_correction",
            "pending_return_feedback",
            "is_locked",
            "alert_level",
            "computed_alert_level",
            "days_elapsed",
            "created_by_id",
            "created_at",
            "updated_at",
            "stage_transitions",
            "recent_audit",
        )
        read_only_fields = fields

    def get_days_elapsed(self, obj):
        return obj.days_elapsed

    def get_computed_alert_level(self, obj):
        return obj.computed_alert_level

    def get_current_holder_name(self, obj):
        u = obj.current_holder
        if not u:
            return None
        name = u.get_full_name()
        if name and name.strip():
            return name
        return u.full_name or u.username

    def get_current_holder_username(self, obj):
        u = obj.current_holder
        return u.username if u else None

    def get_viewer_is_holder(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_authenticated", False):
            return False
        if obj.current_holder_id is None:
            return False
        return str(obj.current_holder_id) == str(request.user.id)

    def get_needs_workflow_correction(self, obj):
        return _cached_correction(self, obj)[0]

    def get_pending_return_feedback(self, obj):
        return _cached_correction(self, obj)[1]

    def get_stage_transitions(self, obj):
        qs = obj.stage_transitions.order_by("sequence", "timestamp")
        return StageTransitionSerializer(qs, many=True).data

    def get_recent_audit(self, obj):
        entries = obj.audit_entries.order_by("-timestamp")[:5]
        return [
            {
                "id": str(e.id),
                "action": e.action,
                "description": e.description,
                "user_id": str(e.user_id) if e.user_id else None,
                "timestamp": e.timestamp,
                "previous_data": e.previous_data,
                "new_data": e.new_data,
            }
            for e in entries
        ]


class RecordCreateSerializer(serializers.ModelSerializer):
    vendor_id = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.all(),
        source="vendor",
    )

    class Meta:
        model = WasteOilRecord
        fields = (
            "vendor_id",
            "product_description",
            "product_type",
            "unit",
            "quantity",
            "entry_date",
            "due_date",
            "remarks",
        )
        extra_kwargs = {
            "product_description": {"required": False, "allow_blank": True},
            "remarks": {"required": False, "allow_blank": True},
            "due_date": {"required": False, "allow_null": True},
        }

    def validate_quantity(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Quantity must be positive.")
        return value


class RecordUpdateSerializer(serializers.ModelSerializer):
    vendor_id = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.all(),
        source="vendor",
        required=False,
    )

    class Meta:
        model = WasteOilRecord
        fields = (
            "vendor_id",
            "product_description",
            "product_type",
            "unit",
            "quantity",
            "entry_date",
            "due_date",
            "remarks",
        )
        extra_kwargs = {
            "product_description": {"required": False, "allow_blank": True},
            "remarks": {"required": False, "allow_blank": True},
            "due_date": {"required": False, "allow_null": True},
            "product_type": {"required": False},
            "unit": {"required": False},
            "quantity": {"required": False},
            "entry_date": {"required": False},
        }

    def validate_quantity(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Quantity must be positive.")
        return value
