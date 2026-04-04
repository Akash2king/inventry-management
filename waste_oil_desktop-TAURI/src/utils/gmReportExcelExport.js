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
  const k = report?.kpis || {};
  const alerts = k.alerts || {};

  // Summary sheet
  addSheet(
    wb,
    "Summary",
    ["Metric", "Value"],
    [
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
      r.alert_level || "",
      r.entry_date || "",
      r.due_date || "",
      r.days_overdue ?? 0,
    ]),
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

