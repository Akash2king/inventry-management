from rest_framework import serializers

from .models import AuditLog


class AuditLogListSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    record_number = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "timestamp",
            "action",
            "description",
            "ip_address",
            "record_id",
            "record_number",
            "user_id",
            "username",
            "full_name",
        )

    def get_username(self, obj):
        user = getattr(obj, "user", None)
        return getattr(user, "username", None)

    def get_full_name(self, obj):
        user = getattr(obj, "user", None)
        return getattr(user, "full_name", None)

    def get_record_number(self, obj):
        record = getattr(obj, "record", None)
        return getattr(record, "record_number", None)
