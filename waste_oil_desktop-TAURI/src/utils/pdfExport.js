import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function buildGmReportPdfBytes(report) {
  const pdfDoc = await PDFDocument.create();
  // A4 portrait ~ 595x842 points
  let page = pdfDoc.addPage([595, 842]);
  const margin = 40;
  const { width, height } = page.getSize();

  const fontTitle = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontBody = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = height - margin;

  const newPage = () => {
    page = pdfDoc.addPage([595, 842]);
    y = height - margin;
  };

  const ensureSpace = (needed) => {
    if (y - needed < margin) {
      newPage();
    }
  };

  const drawText = (text, size, options = {}) => {
    const {
      x = margin,
      color = rgb(0.1, 0.1, 0.1),
      font = fontBody,
    } = options;
    ensureSpace(size + 10);
    page.drawText(String(text ?? ""), {
      x,
      y,
      size,
      font,
      color,
    });
    y -= size + 6;
  };

  // Header
  drawText("Waste Oil Management – GM Monthly Report", 20, {
    font: fontTitle,
    color: rgb(0.09, 0.2, 0.5),
  });
  const period = report?.period || {};
  drawText(`Period: ${period.from || "—"} to ${period.to || "—"}`, 11);
  y -= 8;

  // Executive summary
  const k = report?.kpis || {};
  const alerts = k.alerts || {};
  drawText("Executive summary", 14, {
    font: fontTitle,
    color: rgb(0.15, 0.25, 0.5),
  });
  drawText(`Total records: ${k.total_records ?? 0}`, 11);
  drawText(
    `Completed: ${k.completed ?? 0} (${k.completion_rate ?? 0}%); Active: ${
      k.active_records ?? 0
    }`,
    11,
  );
  drawText(
    `Alert mix – Green: ${alerts.green ?? 0}, Yellow: ${
      alerts.yellow ?? 0
    }, Orange: ${alerts.orange ?? 0}, Red: ${alerts.red ?? 0}`,
    11,
  );

  y -= 12;

  // Records by stage
  drawText("Records by workflow stage", 13, {
    font: fontTitle,
    color: rgb(0.12, 0.32, 0.52),
  });
  const stages = Array.isArray(report.records_by_stage)
    ? report.records_by_stage
    : [];
  const col1X = margin;
  const col2X = margin + 150;

  drawText("Stage", 11, { x: col1X, font: fontTitle });
  drawText("Count", 11, { x: col2X, font: fontTitle });
  stages.forEach((row) => {
    drawText(String(row.current_stage ?? "—"), 10, { x: col1X });
    drawText(String(row.count ?? 0), 10, { x: col2X });
  });

  y -= 8;

  // Department workload
  const workload = Array.isArray(report.department_workload)
    ? report.department_workload
    : [];
  if (workload.length) {
    drawText("Department workload (active vs completed)", 13, {
      font: fontTitle,
      color: rgb(0.12, 0.32, 0.52),
    });
    const dCol1 = margin;
    const dCol2 = margin + 220;
    const dCol3 = margin + 330;
    drawText("Department", 11, { x: dCol1, font: fontTitle });
    drawText("Active", 11, { x: dCol2, font: fontTitle });
    drawText("Completed", 11, { x: dCol3, font: fontTitle });
    workload.forEach((row) => {
      const name = row["current_department__name"] || "Unassigned";
      drawText(String(name), 10, { x: dCol1 });
      drawText(String(row.active ?? 0), 10, { x: dCol2 });
      drawText(String(row.completed_count ?? 0), 10, { x: dCol3 });
    });
  }

  // New page for vendors / exceptions if needed
  ensureSpace(160);
  if (y < margin + 160) {
    newPage();
  }

  // Top vendors
  drawText("Vendors (by volume in period)", 13, {
    font: fontTitle,
    color: rgb(0.12, 0.32, 0.52),
  });

  const vendors = Array.isArray(report.vendors) ? report.vendors.slice(0, 10) : [];
  const vCol1 = margin;
  const vCol2 = margin + 260;
  const vCol3 = margin + 380;

  drawText("Vendor", 11, { x: vCol1, font: fontTitle });
  drawText("Total records", 11, { x: vCol2, font: fontTitle });
  drawText("Red alerts", 11, { x: vCol3, font: fontTitle });
  vendors.forEach((v) => {
    const name = v["vendor__name"] || "—";
    const total = v.total_records ?? v.count ?? 0;
    const reds = v.red_count ?? 0;
    drawText(String(name), 10, { x: vCol1 });
    drawText(String(total), 10, { x: vCol2 });
    drawText(String(reds), 10, { x: vCol3 });
  });

  // Exceptions table: critical / overdue records
  const exceptions = Array.isArray(report.exceptions)
    ? report.exceptions
    : [];
  if (exceptions.length) {
    ensureSpace(220);
    if (y < margin + 220) {
      newPage();
    }
    drawText("Exceptions – critical / overdue records (sample)", 13, {
      font: fontTitle,
      color: rgb(0.55, 0.16, 0.16),
    });
    const eCol1 = margin;
    const eCol2 = margin + 120;
    const eCol3 = margin + 280;
    const eCol4 = margin + 410;

    drawText("Record", 11, { x: eCol1, font: fontTitle });
    drawText("Vendor", 11, { x: eCol2, font: fontTitle });
    drawText("Dept / Stage", 11, { x: eCol3, font: fontTitle });
    drawText("Alert / Days overdue", 11, { x: eCol4, font: fontTitle });

    exceptions.forEach((r) => {
      const stage = r.stage ?? r.current_stage ?? "–";
      const dept = r.department || "—";
      const alert = (r.alert_level || "").toUpperCase();
      const overdue =
        typeof r.days_overdue === "number" && r.days_overdue > 0
          ? `${r.days_overdue}d`
          : "—";
      drawText(String(r.record_number || "—"), 10, { x: eCol1 });
      drawText(String(r.vendor || "—"), 10, { x: eCol2 });
      drawText(`${dept} / ${stage}`, 10, { x: eCol3 });
      drawText(`${alert} / ${overdue}`, 10, { x: eCol4 });
    });
  }

  return pdfDoc.save();
}

/**
 * Save PDF bytes (e.g. from backend ReportLab) via download or Tauri save dialog.
 * @param {Uint8Array} uint8
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
export async function savePdfBytes(uint8, filename) {
  const triggerBrowserDownload = () => {
    const blob = new Blob([uint8], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isTauriRuntime()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: filename,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return false;
      await writeFile(path, uint8);
      return true;
    } catch (e) {
      console.warn("[pdfExport] Tauri save/write failed, falling back to browser download", e);
      triggerBrowserDownload();
      return true;
    }
  }

  triggerBrowserDownload();
  return true;
}

/**
 * Generate and download a GM monthly report PDF locally (pdf-lib).
 * Prefer {@link savePdfBytes} with the backend `/reports/gm/monthly/pdf/` for the same PDF as email.
 *
 * @param {object} report Structured report JSON
 * @param {string} filename Suggested file name, e.g. gm_monthly_report_2026-04-01_2026-04-30.pdf
 */
export async function downloadGmReportPdf(report, filename) {
  const bytes = await buildGmReportPdfBytes(report);
  const uint8 = new Uint8Array(bytes);
  return savePdfBytes(uint8, filename);
}

