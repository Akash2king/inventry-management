from datetime import datetime

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsGMOrSuperadmin
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
    counts = {
        "green": 0,
        "yellow": 0,
        "orange": 0,
        "red": 0,
        "completed": 0,
    }
    for record in WasteOilRecord.objects.all().only(
        "alert_level", "is_locked", "entry_date", "due_date"
    ):
        level = record.computed_alert_level
        key = (level or "green").lower()
        if key in counts:
            counts[key] += 1

    data = [{"alert_level": k, "count": v} for k, v in counts.items()]
    data.sort(key=lambda row: row["count"], reverse=True)
    return Response(data)


def _parse_date_param(value: str | None, *, default=None):
    if not value:
        return default
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return default


def build_gm_monthly_report_payload(date_from, date_to):
    """
    Shared helper to build the GM monthly report payload for both the API
    endpoint and scheduled email tasks.
    """
    qs = WasteOilRecord.objects.filter(
        entry_date__gte=date_from,
        entry_date__lte=date_to,
    )

    total = qs.count()
    completed = qs.filter(alert_level=WasteOilRecord.AlertLevel.COMPLETED).count()
    completion_rate = (completed / total * 100) if total > 0 else 0

    red_alerts = qs.filter(alert_level=WasteOilRecord.AlertLevel.RED).count()
    yellow_alerts = qs.filter(alert_level=WasteOilRecord.AlertLevel.YELLOW).count()
    orange_alerts = qs.filter(alert_level=WasteOilRecord.AlertLevel.ORANGE).count()
    green_alerts = qs.filter(alert_level=WasteOilRecord.AlertLevel.GREEN).count()

    by_stage = (
        qs.values("current_stage")
        .annotate(count=Count("id"))
        .order_by("current_stage")
    )

    by_vendor = (
        qs.values("vendor__id", "vendor__name")
        .annotate(
            total_records=Count("id"),
            red_count=Count(
                "id", filter=Q(alert_level=WasteOilRecord.AlertLevel.RED)
            ),
        )
        .order_by("-total_records")
    )

    # Department workload snapshot.
    dept_workload = (
        qs.values("current_department__name")
        .annotate(
            active=Count(
                "id",
                filter=~Q(alert_level=WasteOilRecord.AlertLevel.COMPLETED),
            ),
            completed_count=Count(
                "id",
                filter=Q(alert_level=WasteOilRecord.AlertLevel.COMPLETED),
            ),
        )
        .order_by("current_department__name")
    )

    # Exceptions: top 25 red / overdue records for a detailed table.
    exceptions_qs = qs.filter(
        Q(alert_level=WasteOilRecord.AlertLevel.RED)
        | Q(due_date__lt=timezone.now().date())
    ).select_related("vendor", "current_department")[:25]

    exceptions = []
    today = timezone.now().date()
    for r in exceptions_qs:
        days_overdue = (today - r.due_date).days if r.due_date < today else 0
        exceptions.append(
            {
                "record_number": r.record_number,
                "vendor": getattr(r.vendor, "name", ""),
                "department": getattr(r.current_department, "name", ""),
                "stage": r.current_stage,
                "alert_level": r.alert_level,
                "entry_date": r.entry_date.isoformat(),
                "due_date": r.due_date.isoformat(),
                "days_overdue": days_overdue,
            }
        )

    return {
        "period": {
            "from": date_from.isoformat(),
            "to": date_to.isoformat(),
        },
        "kpis": {
            "total_records": total,
            "completed": completed,
            "completion_rate": round(completion_rate, 2),
            "active_records": total - completed,
            "alerts": {
                "green": green_alerts,
                "yellow": yellow_alerts,
                "orange": orange_alerts,
                "red": red_alerts,
            },
        },
        "records_by_stage": list(by_stage),
        "vendors": list(by_vendor),
        "department_workload": list(dept_workload),
        "exceptions": exceptions,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGMOrSuperadmin])
def gm_monthly_report(request):
    """
    GM-only analytical snapshot for PDF/Excel export.

    This endpoint does not itself render a file; it returns a structured JSON
    payload that the desktop client (or a future backend export view) can turn
    into an enterprise-ready PDF/Excel document.

    Query params:
    - from: ISO date (inclusive)
    - to:   ISO date (inclusive)
    """
    today = timezone.now().date()
    date_from = _parse_date_param(request.query_params.get("from"))
    date_to = _parse_date_param(request.query_params.get("to"), default=today)

    if date_from is None:
        # Default to current calendar month if no explicit from-date was given.
        date_from = date_to.replace(day=1)

    payload = build_gm_monthly_report_payload(date_from, date_to)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGMOrSuperadmin])
def gm_monthly_report_pdf(request):
    """
    Same data as JSON monthly report, rendered as A4 PDF on the server (ReportLab).
    Matches the PDF attached to the monthly GM/Manager email.
    """
    from apps.admin_console.report_pdf import build_monthly_report_pdf_bytes

    today = timezone.now().date()
    date_from = _parse_date_param(request.query_params.get("from"))
    date_to = _parse_date_param(request.query_params.get("to"), default=today)

    if date_from is None:
        date_from = date_to.replace(day=1)

    report = build_gm_monthly_report_payload(date_from, date_to)
    pdf_bytes = build_monthly_report_pdf_bytes(report)
    p = report.get("period", {}) or {}
    filename = f"waste_management_monthly_report_{p.get('from', '')}_{p.get('to', '')}.pdf"
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response

