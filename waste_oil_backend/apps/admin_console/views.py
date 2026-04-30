from datetime import datetime

from django.db.models import Count, Q, Sum
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
    Shared helper to build the monthly inventory payload for both the API
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

    by_product_type = (
        qs.values("product_type")
        .annotate(
            count=Count("id"),
            total_quantity=Sum("quantity"),
        )
        .order_by("-count", "product_type")
    )

    by_unit = (
        qs.values("unit")
        .annotate(
            count=Count("id"),
            total_quantity=Sum("quantity"),
        )
        .order_by("-count", "unit")
    )

    by_packaging = (
        qs.values("packaging")
        .annotate(count=Count("id"))
        .order_by("-count", "packaging")
    )

    by_driver = (
        qs.exclude(driver_name="")
        .values("driver_name")
        .annotate(
            count=Count("id"),
            total_quantity=Sum("quantity"),
        )
        .order_by("-count", "driver_name")
    )

    by_vehicle = (
        qs.exclude(vehicle_details="")
        .values("vehicle_details")
        .annotate(count=Count("id"))
        .order_by("-count", "vehicle_details")
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
                "product_type": r.product_type,
                "unit": r.unit,
                "packaging": r.packaging,
                "driver_name": r.driver_name,
                "vehicle_details": r.vehicle_details,
                "entry_date": r.entry_date.isoformat(),
                "due_date": r.due_date.isoformat(),
                "days_overdue": days_overdue,
            }
        )

    transitions_qs = (
        qs.prefetch_related("stage_transitions")
        .only("id", "record_number", "created_at", "time_in", "time_out")
        .order_by("entry_date", "record_number")
    )
    holding_samples = []
    holding_minutes = []
    for rec in transitions_qs:
        transition_times = sorted(
            [tr.timestamp for tr in rec.stage_transitions.all() if tr.timestamp]
        )
        if rec.created_at and transition_times:
            first_minutes = max(
                0, int((transition_times[0] - rec.created_at).total_seconds() // 60)
            )
            holding_minutes.append(first_minutes)
        for i in range(1, len(transition_times)):
            minutes = max(
                0,
                int((transition_times[i] - transition_times[i - 1]).total_seconds() // 60),
            )
            holding_minutes.append(minutes)
        if rec.time_in and rec.time_out and rec.time_out >= rec.time_in:
            open_window = max(0, int((rec.time_out - rec.time_in).total_seconds() // 60))
            holding_minutes.append(open_window)

    if holding_minutes:
        avg_minutes = round(sum(holding_minutes) / len(holding_minutes), 2)
        max_minutes = max(holding_minutes)
        min_minutes = min(holding_minutes)
    else:
        avg_minutes = 0
        max_minutes = 0
        min_minutes = 0

    for mins in sorted(holding_minutes, reverse=True)[:10]:
        holding_samples.append({"duration_minutes": mins})

    return {
        "report_title": "Monthly Inventory Report",
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
            "records_with_photos": qs.exclude(photo_path="").count(),
            "records_with_driver": qs.exclude(driver_name="").count(),
            "records_with_vehicle": qs.exclude(vehicle_details="").count(),
            "records_with_packaging": qs.exclude(packaging="").count(),
        },
        "records_by_stage": list(by_stage),
        "records_by_product_type": list(by_product_type),
        "records_by_unit": list(by_unit),
        "records_by_packaging": list(by_packaging),
        "records_by_driver": list(by_driver),
        "records_by_vehicle": list(by_vehicle),
        "holding_time_summary": {
            "sample_size": len(holding_minutes),
            "avg_minutes": avg_minutes,
            "min_minutes": min_minutes,
            "max_minutes": max_minutes,
        },
        "holding_time_top_samples": holding_samples,
        "vendors": list(by_vendor),
        "department_workload": list(dept_workload),
        "exceptions": exceptions,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGMOrSuperadmin])
def gm_monthly_report(request):
    """
    GM-only monthly inventory snapshot for PDF/Excel export.

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
    Same data as JSON monthly inventory report, rendered as A4 PDF on the server (ReportLab).
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
    filename = (
        f"chemsolv_inventory_monthly_inventory_{p.get('from', '')}_{p.get('to', '')}.pdf"
    )
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response

