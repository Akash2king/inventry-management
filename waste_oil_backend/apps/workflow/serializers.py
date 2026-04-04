from rest_framework import serializers

from apps.accounts.models import CustomUser
from apps.workflow.models import StageTransition


class ForwardSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")
    next_holder_id = serializers.UUIDField(required=False, allow_null=True)


class ForwardCandidateSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name", read_only=True, allow_null=True
    )

    class Meta:
        model = CustomUser
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "department_name",
        )
        read_only_fields = fields


class ReturnSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, allow_blank=False)

    def validate_reason(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("This field may not be blank.")
        return value.strip()

