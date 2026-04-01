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
            "alert_yellow_percent": settings.ALERT_YELLOW_PERCENT,
            "alert_orange_percent": settings.ALERT_ORANGE_PERCENT,
            "alert_red_percent": settings.ALERT_RED_PERCENT,
        }
    )
