from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.records.models import WasteOilRecord


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"app": "admin_console", "status": "ok"})


@api_view(["GET"])
@permission_classes([AllowAny])
def summary_kpis(_request):
    """
    Return key performance indicators for the dashboard.
    """
    total = WasteOilRecord.objects.count()
    completed = WasteOilRecord.objects.filter(alert_level="completed").count()
    completion_rate = (completed / total * 100) if total > 0 else 0
    
    red_alerts = WasteOilRecord.objects.filter(alert_level="red").count()
    yellow_alerts = WasteOilRecord.objects.filter(alert_level="yellow").count()
    green_count = WasteOilRecord.objects.filter(alert_level="green").count()
    
    return Response({
        "total_records": total,
        "completed": completed,
        "completion_rate": round(completion_rate, 2),
        "red_alerts": red_alerts,
        "yellow_alerts": yellow_alerts,
        "green_alerts": green_count,
        "active_records": total - completed,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def records_by_stage(_request):
    """
    Return count of records in each workflow stage.
    """
    data = (
        WasteOilRecord.objects.values("current_stage")
        .annotate(count=Count("id"))
        .order_by("current_stage")
    )
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def records_by_alert_level(_request):
    """
    Return distribution of records by alert level.
    """
    data = (
        WasteOilRecord.objects.values("alert_level")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    return Response(data)
