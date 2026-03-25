from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response(
        {
            "app": "alerts",
            "status": "ok",
            "sla_days": settings.SLA_DAYS,
            "yellow_threshold": settings.YELLOW_THRESHOLD,
            "red_threshold": settings.RED_THRESHOLD,
        }
    )
