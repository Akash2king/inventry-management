import * as XLSX from "xlsx";

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

export function safeSheetName(name) {
  const s = String(name || "Sheet1").replace(/[:\\/?*[\]]/g, "_");
  return s.length > 31 ? s.slice(0, 31) : s;
}

/**
 * Build an .xlsx and save it via browser download.
 *
 * @param {string} filename Suggested file name, e.g. export.xlsx
 * @param {string} sheetName Worksheet title (Excel max 31 chars; sanitized)
 * @param {string[]} headers Column headers
 * @param {unknown[][]} rows Data rows (same length as headers)
 * @returns {Promise<boolean>} true if a file was written or download triggered; false if user cancelled the save dialog (Tauri only)
 */
export async function downloadExcelFile(filename, sheetName, headers, rows) {
  const data = [headers.map(normalizeCell), ...rows.map(normalizeRow)];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
  const raw = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
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

  triggerBrowserDownload();
  return true;
}
