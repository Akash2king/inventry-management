"""
A4 enterprise-style monthly inventory report PDF (lavender / purple theme).
Uses actual data from build_gm_monthly_report_payload().
Table cells use plain strings for compatibility with ReportLab table layout.
"""
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

LAVENDER_BG = colors.HexColor("#EDE7F6")
LHEADER = colors.HexColor("#D1C4E9")
ACCENT = colors.HexColor("#5E35B1")
TEXT_DARK = colors.HexColor("#1A1A2E")
ROW_ALT = colors.HexColor("#F3E5F5")


def _plain_para(text: str, style) -> Paragraph:
    """Paragraph from plain text (escape XML special chars only; no HTML tags)."""
    safe = (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return Paragraph(safe, style)


def _s(val, max_len: int = 120) -> str:
    t = str(val if val is not None else "")
    return t if len(t) <= max_len else t[: max_len - 1] + "…"


def _minutes_to_text(minutes) -> str:
    if minutes is None:
        return "0m"
    total = max(0, int(minutes))
    hours, mins = divmod(total, 60)
    if hours:
        return f"{hours}h {mins}m"
    return f"{mins}m"


def build_monthly_report_pdf_bytes(report: dict) -> bytes:
    """Return PDF bytes for the given report dict (same shape as API)."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="Chem-Solv Inventory Monthly Inventory Report",
    )
    styles = getSampleStyleSheet()
    section_style = ParagraphStyle(
        "RSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=ACCENT,
        spaceBefore=10,
        spaceAfter=6,
    )
    footer_style = ParagraphStyle(
        "RFoot",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        textColor=colors.HexColor("#64748b"),
    )

    story = []
    period = report.get("period") or {}
    kpis = report.get("kpis") or {}
    alerts = kpis.get("alerts") or {}

    report_title = report.get("report_title") or "Monthly Inventory Report"

    # Header card (strings only inside table)
    hdr = Table(
        [
            [f"CHEM-SOLV INVENTORY — {str(report_title).upper()}"],
            [
                f"Period: {period.get('from', '—')}  →  {period.get('to', '—')}",
            ],
        ],
        colWidths=[doc.width],
    )
    hdr.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LAVENDER_BG),
                ("BOX", (0, 0), (-1, -1), 1, LHEADER),
                ("TEXTCOLOR", (0, 0), (0, 0), ACCENT),
                ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (0, 0), 12),
                ("TEXTCOLOR", (0, 1), (0, 1), TEXT_DARK),
                ("FONTNAME", (0, 1), (0, 1), "Helvetica"),
                ("FONTSIZE", (0, 1), (0, 1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(hdr)
    story.append(Spacer(1, 10))

    # KPI strip (6 columns, string cells)
    kpi_tbl = Table(
        [
            [
                "Total records",
                "Completed",
                "Active",
                "Alert mix (G/Y/O/R)",
                "With packaging",
                "With driver/vehicle",
            ],
            [
                str(kpis.get("total_records", 0)),
                f"{kpis.get('completed', 0)}\n({kpis.get('completion_rate', 0)}%)",
                str(kpis.get("active_records", 0)),
                "{}/{}/{}/{}".format(
                    alerts.get("green", 0),
                    alerts.get("yellow", 0),
                    alerts.get("orange", 0),
                    alerts.get("red", 0),
                ),
                str(kpis.get("records_with_packaging", 0)),
                "{}/{}".format(
                    kpis.get("records_with_driver", 0),
                    kpis.get("records_with_vehicle", 0),
                ),
            ],
        ],
        colWidths=[doc.width / 6.0] * 6,
    )
    kpi_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), LHEADER),
                ("TEXTCOLOR", (0, 0), (-1, 0), TEXT_DARK),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("BACKGROUND", (0, 1), (-1, 1), colors.white),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 1), (-1, 1), 11),
                ("TEXTCOLOR", (0, 1), (-1, 1), ACCENT),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.8, LHEADER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, LHEADER),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(kpi_tbl)
    story.append(Spacer(1, 12))

    def add_table_section(
        heading: str,
        col_headers: list[str],
        rows: list[list],
        col_widths: list[float] | None = None,
    ):
        story.append(_plain_para(heading, section_style))
        if not rows:
            story.append(_plain_para("No data for this period.", footer_style))
            story.append(Spacer(1, 4))
            return
        data = [[_s(h) for h in col_headers]]
        for row in rows:
            data.append([_s(c) for c in row])
        w = col_widths or [doc.width / len(col_headers)] * len(col_headers)
        t = Table(data, colWidths=w, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), LHEADER),
                    ("TEXTCOLOR", (0, 0), (-1, 0), TEXT_DARK),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 8),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 1), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.4, LHEADER),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 6))

    stages = report.get("records_by_stage") or []
    add_table_section(
        "Records by workflow stage",
        ["Stage", "Count"],
        [[s.get("current_stage", ""), s.get("count", 0)] for s in stages],
        [doc.width * 0.35, doc.width * 0.65],
    )

    dept = report.get("department_workload") or []
    add_table_section(
        "Department workload (active vs completed)",
        ["Department", "Active", "Completed"],
        [
            [
                d.get("current_department__name") or "Unassigned",
                d.get("active", 0),
                d.get("completed_count", 0),
            ]
            for d in dept
        ],
        [doc.width * 0.5, doc.width * 0.25, doc.width * 0.25],
    )

    vendors = report.get("vendors") or []
    add_table_section(
        "Vendors (records in period)",
        ["Vendor", "Total records", "Red alerts"],
        [
            [
                v.get("vendor__name") or "—",
                v.get("total_records", 0),
                v.get("red_count", 0),
            ]
            for v in vendors
        ],
        [doc.width * 0.55, doc.width * 0.225, doc.width * 0.225],
    )

    by_product_type = report.get("records_by_product_type") or []
    add_table_section(
        "Product type summary",
        ["Product Type", "Count", "Total Quantity"],
        [
            [
                p.get("product_type") or "Unspecified",
                p.get("count", 0),
                p.get("total_quantity", 0),
            ]
            for p in by_product_type
        ],
        [doc.width * 0.5, doc.width * 0.2, doc.width * 0.3],
    )

    by_unit = report.get("records_by_unit") or []
    add_table_section(
        "Unit usage summary",
        ["Unit", "Count", "Total Quantity"],
        [
            [
                u.get("unit") or "Unspecified",
                u.get("count", 0),
                u.get("total_quantity", 0),
            ]
            for u in by_unit
        ],
        [doc.width * 0.4, doc.width * 0.2, doc.width * 0.4],
    )

    by_packaging = report.get("records_by_packaging") or []
    add_table_section(
        "Packaging mix",
        ["Packaging", "Count"],
        [[p.get("packaging") or "Unspecified", p.get("count", 0)] for p in by_packaging],
        [doc.width * 0.7, doc.width * 0.3],
    )

    by_driver = report.get("records_by_driver") or []
    add_table_section(
        "Driver usage",
        ["Driver", "Trips", "Total Quantity"],
        [
            [
                d.get("driver_name") or "Unspecified",
                d.get("count", 0),
                d.get("total_quantity", 0),
            ]
            for d in by_driver[:20]
        ],
        [doc.width * 0.5, doc.width * 0.2, doc.width * 0.3],
    )

    by_vehicle = report.get("records_by_vehicle") or []
    add_table_section(
        "Vehicle usage",
        ["Vehicle", "Trips"],
        [[v.get("vehicle_details") or "Unspecified", v.get("count", 0)] for v in by_vehicle[:20]],
        [doc.width * 0.75, doc.width * 0.25],
    )

    holding = report.get("holding_time_summary") or {}
    add_table_section(
        "Holding time summary",
        ["Sample Size", "Average", "Minimum", "Maximum"],
        [[
            holding.get("sample_size", 0),
            _minutes_to_text(holding.get("avg_minutes", 0)),
            _minutes_to_text(holding.get("min_minutes", 0)),
            _minutes_to_text(holding.get("max_minutes", 0)),
        ]],
        [doc.width * 0.2, doc.width * 0.25, doc.width * 0.25, doc.width * 0.3],
    )

    top_holding = report.get("holding_time_top_samples") or []
    add_table_section(
        "Longest handoff windows (sample)",
        ["Rank", "Duration"],
        [[idx + 1, _minutes_to_text(s.get("duration_minutes", 0))] for idx, s in enumerate(top_holding)],
        [doc.width * 0.2, doc.width * 0.8],
    )

    exc = report.get("exceptions") or []
    add_table_section(
        "Exceptions — critical / overdue (sample)",
        [
            "Record",
            "Vendor",
            "Dept",
            "Stage",
            "Packaging",
            "Driver",
            "Alert",
            "Due",
            "Days overdue",
        ],
        [
            [
                e.get("record_number", ""),
                e.get("vendor", ""),
                e.get("department", ""),
                e.get("stage", ""),
                e.get("packaging", ""),
                e.get("driver_name", ""),
                e.get("alert_level", ""),
                e.get("due_date", ""),
                e.get("days_overdue", 0),
            ]
            for e in exc
        ],
        [
            doc.width * 0.12,
            doc.width * 0.14,
            doc.width * 0.13,
            doc.width * 0.07,
            doc.width * 0.12,
            doc.width * 0.12,
            doc.width * 0.09,
            doc.width * 0.11,
            doc.width * 0.1,
        ],
    )

    story.append(Spacer(1, 8))
    story.append(
        _plain_para(
            "Chem-Solv Inventory — confidential operations report. "
            "Data is taken from live records for the selected entry-date range.",
            footer_style,
        )
    )

    doc.build(story)
    pdf = buf.getvalue()
    buf.close()
    return pdf
