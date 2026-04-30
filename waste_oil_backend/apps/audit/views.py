from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsManagerOrAbove

from .models import AuditLog
from .serializers import AuditLogListSerializer


class AuditLogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class AuditLogListView(ListAPIView):
    permission_classes = [IsAuthenticated, IsManagerOrAbove]
    serializer_class = AuditLogListSerializer
    pagination_class = AuditLogPagination

    def get_queryset(self):
        qs = AuditLog.objects.select_related("user", "record")
        user = self.request.user
        # User requested manager + GM scope for audit tab.
        if getattr(user, "role", None) not in ("manager", "gm"):
            return qs.none()

        p = self.request.query_params

        action = (p.get("action") or "").strip()
        if action:
            qs = qs.filter(action=action)

        if user_id := (p.get("user_id") or "").strip():
            qs = qs.filter(user_id=user_id)

        if record_id := (p.get("record_id") or "").strip():
            qs = qs.filter(record_id=record_id)

        if date_from := (p.get("date_from") or "").strip():
            qs = qs.filter(timestamp__date__gte=date_from)

        if date_to := (p.get("date_to") or "").strip():
            qs = qs.filter(timestamp__date__lte=date_to)

        if search := (p.get("search") or "").strip():
            qs = qs.filter(
                Q(description__icontains=search)
                | Q(action__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__full_name__icontains=search)
                | Q(record__record_number__icontains=search)
            )

        return qs.order_by("-timestamp")


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"app": "audit", "status": "ok"})
