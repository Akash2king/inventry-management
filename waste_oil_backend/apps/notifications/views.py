from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.notifications.models import UserNotification
from apps.notifications.serializers import UserNotificationSerializer
from apps.notifications.serializers import NotificationDeviceSerializer
from apps.notifications.models import NotificationDevice
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone


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
            NotificationService.send_push_to_users([request.user], title, body, metadata={"test": True})
            return Response({"detail": "push queued"}, status=status.HTTP_202_ACCEPTED)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def user_notification_mark_all_read(request):
    wf = UserNotification.workflow_kind_values()
    UserNotification.objects.filter(
        user=request.user, read_at__isnull=True, kind__in=wf
    ).update(read_at=timezone.now())
    return Response({"detail": "Marked all as read."}, status=status.HTTP_200_OK)
