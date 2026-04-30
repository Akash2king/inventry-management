from datetime import datetime, time

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import CustomUser
from apps.workflow.models import StageTransition

from .models import RecordOption, Vendor, WasteOilRecord
from .workflow_attention import correction_state_for_record


def stage_transitions_view_for_user(user) -> str:
    """Only GM and Manager see the full transition list; others get a narrow window."""
    if not user or not getattr(user, "is_authenticated", False):
        return "peer_window"
    role = getattr(user, "role", None)
    if role in (CustomUser.Role.MANAGER, CustomUser.Role.GM):
        return "full"
    return "peer_window"


def peer_stage_transition_window(transitions, record, user=None):
    """
    At most three StageTransition instances: adjacent to anchor by sequence index.
    Anchor = last transition whose to_department_id matches record.current_department_id,
    else latest transition in the ordered list.
    """
    if not transitions:
        return []
    anchor_idx = None
    cur = getattr(record, "current_department_id", None)
    if cur is not None:
        for i in range(len(transitions) - 1, -1, -1):
            if transitions[i].to_department_id == cur:
                anchor_idx = i
                break
    if anchor_idx is None:
        anchor_idx = len(transitions) - 1
    out_indices = sorted(
        set(
            j
            for j in (anchor_idx - 1, anchor_idx, anchor_idx + 1)
            if 0 <= j < len(transitions)
        )
    )
    # Keep the last forward made by this viewer visible so they can see who they sent to.
    if user and getattr(user, "is_authenticated", False):
        for i in range(len(transitions) - 1, -1, -1):
            tr = transitions[i]
            if (
                tr.transition_type == StageTransition.TransitionType.FORWARD
                and tr.transitioned_by_id == user.id
            ):
                out_indices = sorted(set(out_indices + [i]))
                break
    return [transitions[j] for j in out_indices]


def _cached_correction(serializer, obj):
    cache = serializer.context.setdefault("_correction_cache", {})
    pk = obj.pk
    if pk not in cache:
        cache[pk] = correction_state_for_record(obj)
    return cache[pk]


def _format_holding_duration_minutes(minutes):
    """Human-readable days, hours, minutes for automatic holding log."""
    if minutes is None:
        return None
    total = max(0, int(minutes))
    days, rem = divmod(total, 1440)
    hours, mins = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    if hours:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if mins or not parts:
        parts.append(f"{mins} minute{'s' if mins != 1 else ''}")
    return ", ".join(parts)


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ("id", "name", "notes", "created_at")
        read_only_fields = ("id", "created_at")


class VendorBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ("id", "name", "notes")
        read_only_fields = fields


class StageTransitionSerializer(serializers.ModelSerializer):
    from_department_name = serializers.CharField(
        source="from_department.name", read_only=True, allow_null=True
    )
    to_department_name = serializers.CharField(
        source="to_department.name", read_only=True, allow_null=True
    )
    from_department_layer = serializers.CharField(
        source="from_department.workflow_layer", read_only=True, allow_null=True
    )
    to_department_layer = serializers.CharField(
        source="to_department.workflow_layer", read_only=True, allow_null=True
    )
    transitioned_by_name = serializers.SerializerMethodField()
    transitioned_by_username = serializers.SerializerMethodField()
    to_holder_name = serializers.SerializerMethodField()
    to_holder_username = serializers.SerializerMethodField()

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
            "from_department_layer",
            "to_department_layer",
            "transitioned_by_id",
            "transitioned_by_name",
            "transitioned_by_username",
            "to_holder_id",
            "to_holder_name",
            "to_holder_username",
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

    def get_transitioned_by_username(self, obj):
        u = obj.transitioned_by
        return u.username if u else None

    def get_to_holder_name(self, obj):
        u = obj.to_holder
        if not u:
            return None
        name = u.get_full_name()
        if name and name.strip():
            return name
        return getattr(u, "full_name", None) or u.username

    def get_to_holder_username(self, obj):
        u = obj.to_holder
        return u.username if u else None


class RecordListSerializer(serializers.ModelSerializer):
    days_elapsed = serializers.SerializerMethodField()
    sla_total_days = serializers.SerializerMethodField()
    computed_alert_level = serializers.SerializerMethodField()
    current_department_name = serializers.CharField(
        source="current_department.name", read_only=True, allow_null=True
    )
    current_holder_name = serializers.SerializerMethodField()
    current_holder_username = serializers.SerializerMethodField()
    vendor_id = serializers.UUIDField(read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    needs_workflow_correction = serializers.SerializerMethodField()
    pending_return_feedback = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

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
            "packaging",
            "quantity",
            "entry_date",
            "due_date",
            "driver_name",
            "vehicle_details",
            "photo_path",
            "photo_url",
            "days_elapsed",
            "sla_total_days",
            "alert_level",
            "computed_alert_level",
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

    def get_sla_total_days(self, obj):
        return obj.sla_total_days

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

    def get_needs_workflow_correction(self, obj):
        return _cached_correction(self, obj)[0]

    def get_pending_return_feedback(self, obj):
        return _cached_correction(self, obj)[1]

    def get_photo_url(self, obj):
        if not obj.photo_path:
            return None
        request = self.context.get("request")
        if request is None:
            return obj.photo_path
        return request.build_absolute_uri(f"/media/{obj.photo_path}")


class RecordDetailSerializer(serializers.ModelSerializer):
    days_elapsed = serializers.SerializerMethodField()
    sla_total_days = serializers.SerializerMethodField()
    computed_alert_level = serializers.SerializerMethodField()
    current_department_name = serializers.CharField(
        source="current_department.name", read_only=True, allow_null=True
    )
    current_holder_name = serializers.SerializerMethodField()
    current_holder_username = serializers.SerializerMethodField()
    viewer_is_holder = serializers.SerializerMethodField()
    needs_workflow_correction = serializers.SerializerMethodField()
    pending_return_feedback = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    vendor_id = serializers.UUIDField(read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    vendor = VendorBriefSerializer(read_only=True)
    created_by_id = serializers.UUIDField(read_only=True)
    stage_transitions = serializers.SerializerMethodField()
    stage_transitions_view = serializers.SerializerMethodField()
    recent_audit = serializers.SerializerMethodField()
    holder_time_log = serializers.SerializerMethodField()

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
            "packaging",
            "quantity",
            "entry_date",
            "due_date",
            "driver_name",
            "vehicle_details",
            "photo_path",
            "photo_url",
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
            "sla_total_days",
            "created_by_id",
            "created_at",
            "updated_at",
            "stage_transitions",
            "stage_transitions_view",
            "holder_time_log",
            "recent_audit",
        )
        read_only_fields = fields

    def get_days_elapsed(self, obj):
        return obj.days_elapsed

    def get_sla_total_days(self, obj):
        return obj.sla_total_days

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

    def get_photo_url(self, obj):
        if not obj.photo_path:
            return None
        request = self.context.get("request")
        if request is None:
            return obj.photo_path
        return request.build_absolute_uri(f"/media/{obj.photo_path}")

    def get_stage_transitions_view(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        return stage_transitions_view_for_user(user)

    def get_stage_transitions(self, obj):
        qs = (
            obj.stage_transitions.select_related(
                "transitioned_by", "to_holder", "from_department", "to_department"
            ).order_by("sequence", "timestamp")
        )
        transitions = list(qs)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if stage_transitions_view_for_user(user) == "full":
            return StageTransitionSerializer(transitions, many=True).data
        window = peer_stage_transition_window(transitions, obj, user=user)
        return StageTransitionSerializer(window, many=True).data

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

    def get_holder_time_log(self, obj):
        """
        Per-holder holding windows derived automatically (no manual time fields).

        - Display time in: calendar entry date (start of day) for the first segment,
          then each workflow transition timestamp when the next holder receives the record.
        - Duration for the first segment uses max(created_at, entry start of day) so
          elapsed time matches wall-clock from record creation, not midnight alone.
        - Time out: timestamp of the forward/return on StageTransition.
        """
        transitions = list(
            obj.stage_transitions.select_related("transitioned_by").order_by(
                "sequence", "timestamp"
            )
        )
        entry_start = None
        if obj.entry_date:
            naive_start = datetime.combine(obj.entry_date, time.min)
            entry_start = timezone.make_aware(
                naive_start, timezone.get_current_timezone()
            )

        if entry_start is not None:
            start_display = entry_start
            start_duration = max(obj.created_at, entry_start)
        else:
            start_display = obj.created_at
            start_duration = obj.created_at

        rows = []
        if transitions:
            for tr in transitions:
                actor = tr.transitioned_by
                actor_name = None
                actor_username = None
                if actor:
                    name = actor.get_full_name()
                    actor_name = (
                        name
                        if name and name.strip()
                        else (getattr(actor, "full_name", None) or actor.username)
                    )
                    actor_username = actor.username
                end_at = tr.timestamp
                duration_mins = None
                if start_duration and end_at:
                    duration_mins = max(
                        0, int((end_at - start_duration).total_seconds() // 60)
                    )
                rows.append(
                    {
                        "holder_name": actor_name,
                        "holder_username": actor_username,
                        "time_in": start_display,
                        "time_out": end_at,
                        "duration_minutes": duration_mins,
                        "duration_display": _format_holding_duration_minutes(
                            duration_mins
                        ),
                        "released_via": tr.transition_type,
                    }
                )
                start_display = end_at
                start_duration = end_at

        if obj.current_holder:
            now = timezone.now()
            holder = obj.current_holder
            name = holder.get_full_name()
            holder_name = (
                name
                if name and name.strip()
                else (getattr(holder, "full_name", None) or holder.username)
            )
            duration_mins = None
            if start_duration:
                duration_mins = max(
                    0, int((now - start_duration).total_seconds() // 60)
                )
            rows.append(
                {
                    "holder_name": holder_name,
                    "holder_username": holder.username,
                    "time_in": start_display,
                    "time_out": None,
                    "duration_minutes": duration_mins,
                    "duration_display": _format_holding_duration_minutes(duration_mins),
                    "released_via": None,
                }
            )
        return rows


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
            "packaging",
            "quantity",
            "entry_date",
            "due_date",
            "driver_name",
            "vehicle_details",
            "remarks",
        )
        extra_kwargs = {
            "product_description": {"required": False, "allow_blank": True},
            "remarks": {"required": False, "allow_blank": True},
            "due_date": {"required": False, "allow_null": True},
            "packaging": {"required": False, "allow_blank": True},
            "driver_name": {"required": False, "allow_blank": True},
            "vehicle_details": {"required": False, "allow_blank": True},
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
            "packaging",
            "quantity",
            "entry_date",
            "due_date",
            "driver_name",
            "vehicle_details",
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
            "packaging": {"required": False},
            "driver_name": {"required": False},
            "vehicle_details": {"required": False},
        }

    def validate_quantity(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Quantity must be positive.")
        return value


class RecordOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecordOption
        fields = ("id", "category", "value", "created_at")
        read_only_fields = ("id", "created_at")
