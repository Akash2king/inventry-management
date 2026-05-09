from rest_framework import serializers

from apps.notifications.models import UserNotification


class UserNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserNotification
        fields = (
            "id",
            "kind",
            "title",
            "body",
            "metadata",
            "read_at",
            "created_at",
        )
        read_only_fields = fields
