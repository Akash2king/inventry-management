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


class NotificationDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__("apps.notifications.models", fromlist=["NotificationDevice"]).NotificationDevice
        fields = ("id", "token", "platform", "created_at", "last_seen_at")
        read_only_fields = ("id", "created_at", "last_seen_at")


class BroadcastNotificationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(allow_blank=True, required=False)
