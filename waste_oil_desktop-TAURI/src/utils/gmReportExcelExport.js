import * as XLSX from "xlsx";
import { safeSheetName } from "./excelExport.js";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function normalizeCell(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return v;
}

function normalizeRow(row) {
  return row.map(normalizeCell);
}

function addSheet(workbook, title, headers, rows) {
  const data = [headers.map(normalizeCell), ...rows.map(normalizeRow)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = headers.map((header) => ({
    wch: Math.max(14, String(header || "").length + 4),
  }));
  XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(title));
}

/**
 * Build a multi-sheet GM report workbook from the monthly report JSON.
 *
 * Sheets:
 * - Summary
 * - Stages
 * - Departments
 * - Vendors
 * - Exceptions
 */
export async function downloadGmReportExcel(report, filename) {
  const wb = XLSX.utils.book_new();
  const period = report?.period || {};
  const reportTitle = report?.report_title || "Monthly Inventory Report";
  const k = report?.kpis || {};
  const alerts = k.alerts || {};

  // Summary sheet
  addSheet(
    wb,
    "Monthly Inventory",
    ["Metric", "Value"],
    [
      ["Report title", reportTitle],
      ["Period from", period.from || ""],
      ["Period to", period.to || ""],
      ["Total records", k.total_records ?? 0],
      ["Completed", k.completed ?? 0],
      ["Completion rate (%)", k.completion_rate ?? 0],
      ["Active", k.active_records ?? 0],
      ["Alerts – Green", alerts.green ?? 0],
      ["Alerts – Yellow", alerts.yellow ?? 0],
      ["Alerts – Orange", alerts.orange ?? 0],
      ["Alerts – Red", alerts.red ?? 0],
      ["Records with packaging", k.records_with_packaging ?? 0],
      ["Records with driver", k.records_with_driver ?? 0],
      ["Records with vehicle", k.records_with_vehicle ?? 0],
      ["Records with photos", k.records_with_photos ?? 0],
    ],
  );

  // Stages sheet
  const stages = Array.isArray(report.records_by_stage)
    ? report.records_by_stage
    : [];
  addSheet(
    wb,
    "Stages",
    ["Stage", "Count"],
    stages.map((row) => [row.current_stage, row.count]),
  );

  const byProductType = Array.isArray(report.records_by_product_type)
    ? report.records_by_product_type
    : [];
  addSheet(
    wb,
    "Product Type Mix",
    ["Product type", "Count", "Total quantity"],
    byProductType.map((row) => [
      row.product_type || "Unspecified",
      row.count ?? 0,
      row.total_quantity ?? 0,
    ]),
  );

  const byUnit = Array.isArray(report.records_by_unit) ? report.records_by_unit : [];
  addSheet(
    wb,
    "Unit Mix",
    ["Unit", "Count", "Total quantity"],
    byUnit.map((row) => [row.unit || "Unspecified", row.count ?? 0, row.total_quantity ?? 0]),
  );

  const byPackaging = Array.isArray(report.records_by_packaging)
    ? report.records_by_packaging
    : [];
  addSheet(
    wb,
    "Packaging Mix",
    ["Packaging", "Count"],
    byPackaging.map((row) => [row.packaging || "Unspecified", row.count ?? 0]),
  );

  const byDriver = Array.isArray(report.records_by_driver) ? report.records_by_driver : [];
  addSheet(
    wb,
    "Driver Usage",
    ["Driver", "Trips", "Total quantity"],
    byDriver.map((row) => [
      row.driver_name || "Unspecified",
      row.count ?? 0,
      row.total_quantity ?? 0,
    ]),
  );

  const byVehicle = Array.isArray(report.records_by_vehicle) ? report.records_by_vehicle : [];
  addSheet(
    wb,
    "Vehicle Usage",
    ["Vehicle", "Trips"],
    byVehicle.map((row) => [row.vehicle_details || "Unspecified", row.count ?? 0]),
  );

  // Departments sheet
  const workload = Array.isArray(report.department_workload)
    ? report.department_workload
    : [];
  addSheet(
    wb,
    "Departments",
    ["Department", "Active", "Completed"],
    workload.map((row) => [
      row.current_department__name || "Unassigned",
      row.active ?? 0,
      row.completed_count ?? 0,
    ]),
  );

  // Vendors sheet
  const vendors = Array.isArray(report.vendors) ? report.vendors : [];
  addSheet(
    wb,
    "Vendors",
    ["Vendor", "Total records", "Red alerts"],
    vendors.map((v) => [
      v.vendor__name || "",
      v.total_records ?? 0,
      v.red_count ?? 0,
    ]),
  );

  // Exceptions sheet
  const exceptions = Array.isArray(report.exceptions)
    ? report.exceptions
    : [];
  addSheet(
    wb,
    "Exceptions",
    [
      "Record",
      "Vendor",
      "Department",
      "Stage",
      "Product type",
      "Unit",
      "Packaging",
      "Driver",
      "Vehicle",
      "Alert level",
      "Entry date",
      "Due date",
      "Days overdue",
    ],
    exceptions.map((r) => [
      r.record_number || "",
      r.vendor || "",
      r.department || "",
      r.stage ?? r.current_stage ?? "",
      r.product_type || "",
      r.unit || "",
      r.packaging || "",
      r.driver_name || "",
      r.vehicle_details || "",
      r.alert_level || "",
      r.entry_date || "",
      r.due_date || "",
      r.days_overdue ?? 0,
    ]),
  );

  const holdingSummary = report?.holding_time_summary || {};
  const topHolding = Array.isArray(report?.holding_time_top_samples)
    ? report.holding_time_top_samples
    : [];
  addSheet(
    wb,
    "Holding Time",
    ["Metric", "Value"],
    [
      ["Sample size", holdingSummary.sample_size ?? 0],
      ["Average minutes", holdingSummary.avg_minutes ?? 0],
      ["Minimum minutes", holdingSummary.min_minutes ?? 0],
      ["Maximum minutes", holdingSummary.max_minutes ?? 0],
      ...topHolding.map((row, idx) => [`Top ${idx + 1} window (minutes)`, row.duration_minutes ?? 0]),
    ],
  );

  const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const uint8 = new Uint8Array(raw);

  const triggerBrowserDownload = () => {
    const blob = new Blob([uint8], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
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
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (!path) return false;
      await writeFile(path, uint8);
      return true;
    } catch (e) {
      console.warn("[gmReportExcel] Tauri save/write failed, falling back to download", e);
      triggerBrowserDownload();
      return true;
    }
  }

  triggerBrowserDownload();
  return true;
}

