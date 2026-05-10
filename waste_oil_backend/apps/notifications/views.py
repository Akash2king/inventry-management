from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.notifications.models import UserNotification
from apps.notifications.serializers import UserNotificationSerializer
from apps.notifications.serializers import NotificationDeviceSerializer, BroadcastNotificationSerializer
from apps.notifications.models import NotificationDevice
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from apps.notifications.in_app import broadcast_user_notification, mirror_email_as_user_notification
from apps.accounts.models import CustomUser
from apps.accounts.permissions import IsManagerOrAbove


class NotificationDeviceRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = NotificationDeviceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        token = serializer.validated_data.get("token")
        platform = serializer.validated_data.get("platform") or ""
        obj, created = NotificationDevice.objects.update_or_create(
            user=request.user, token=token, defaults={"platform": platform, "last_seen_at": timezone.now()},
        )
        return Response(NotificationDeviceSerializer(obj).data, status=status.HTTP_200_OK)

    def delete(self, request):
        token = request.data.get("token") or request.query_params.get("token")
        if not token:
            return Response({"detail": "token required"}, status=status.HTTP_400_BAD_REQUEST)
        NotificationDevice.objects.filter(user=request.user, token=token).delete()
        return Response({"detail": "deleted"}, status=status.HTTP_200_OK)


class UserNotificationPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"app": "notifications", "status": "ok"})


class UserNotificationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserNotificationSerializer
    pagination_class = UserNotificationPagination

    def get_queryset(self):
        wf = UserNotification.workflow_kind_values()
        qs = UserNotification.objects.filter(user=self.request.user, kind__in=wf)
        unread = self.request.query_params.get("unread")
        if str(unread).lower() in ("1", "true", "yes"):
            qs = qs.filter(read_at__isnull=True)
        return qs.order_by("-created_at")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_notification_unread_count(request):
    wf = UserNotification.workflow_kind_values()
    n = UserNotification.objects.filter(
        user=request.user, read_at__isnull=True, kind__in=wf
    ).count()
    return Response({"unread_count": n})


class UserNotificationMarkReadView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_queryset(self):
        wf = UserNotification.workflow_kind_values()
        return UserNotification.objects.filter(user=self.request.user, kind__in=wf)

    def post(self, request, *args, **kwargs):
        note = self.get_object()
        if note.read_at is None:
            note.read_at = timezone.now()
            note.save(update_fields=["read_at"])
        return Response(UserNotificationSerializer(note).data)



class SendTestPushView(APIView):
    """Send a test push to the current user's registered devices.

    POST body (optional): { "title": "...", "body": "..." }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        title = request.data.get("title") or "Test notification"
        body = request.data.get("body") or "This is a test push from the server."
        try:
            note = mirror_email_as_user_notification(
                request.user,
                kind=UserNotification.Kind.WELCOME_EMPLOYEE,
                email_subject=title,
                email_body_text=body,
                metadata={"test": True},
            )
            if note is None:
                return Response({"detail": "unable to create notification"}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": "notification created", "id": str(note.id)}, status=status.HTTP_201_CREATED)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BroadcastNotificationView(APIView):
    """Send a custom notification to all active users.

    Managers and above only.
    """

    permission_classes = [IsAuthenticated, IsManagerOrAbove]

    def post(self, request):
        serializer = BroadcastNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        title = serializer.validated_data["title"].strip()
        body = serializer.validated_data.get("body", "").strip()
        users = list(CustomUser.objects.filter(is_active=True).only("id", "username", "full_name"))
        notes = broadcast_user_notification(
            users,
            kind=UserNotification.Kind.CUSTOM_BROADCAST,
            title=title,
            body=body,
            metadata={"broadcast": True, "sent_by": str(request.user.id)},
        )
        return Response(
            {
                "detail": f"Created {len(notes)} notification(s).",
                "sent": len(notes),
            },
            status=status.HTTP_201_CREATED,
        )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def user_notification_mark_all_read(request):
    wf = UserNotification.workflow_kind_values()
    UserNotification.objects.filter(
        user=request.user, read_at__isnull=True, kind__in=wf
    ).update(read_at=timezone.now())
    return Response({"detail": "Marked all as read."}, status=status.HTTP_200_OK)
