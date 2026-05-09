from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.notifications.models import UserNotification
from apps.notifications.serializers import UserNotificationSerializer


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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def user_notification_mark_all_read(request):
    wf = UserNotification.workflow_kind_values()
    UserNotification.objects.filter(
        user=request.user, read_at__isnull=True, kind__in=wf
    ).update(read_at=timezone.now())
    return Response({"detail": "Marked all as read."}, status=status.HTTP_200_OK)
