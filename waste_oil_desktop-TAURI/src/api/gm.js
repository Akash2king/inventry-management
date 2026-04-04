import { unwrap } from "./_unwrap.js";

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export function getDepartments(token) {
  return unwrap(window.api.gm.getDepartments(token)).then(asList);
}

export function getEmployees(filters, token) {
  return unwrap(window.api.gm.getEmployees(filters, token)).then(asList);
}

export function createEmployee(data, token) {
  return unwrap(window.api.gm.createEmployee(data, token));
}

export function updateEmployee(id, data, token) {
  return unwrap(window.api.gm.updateEmployee(id, data, token));
}

export function deleteEmployee(id, token) {
  return unwrap(window.api.gm.deleteEmployee(id, token));
}

export function getMonthlyReport(params, token) {
  // token is currently unused because the browser API already attaches it,
  // but we accept it for symmetry / future native bridges.
  return unwrap(window.api.gm.getMonthlyReport(params, token));
}

/**
 * Server-rendered PDF (ReportLab) — same file as monthly email attachment.
 * @returns {Promise<{ data: Uint8Array, filename: string }>}
 */
export async function fetchMonthlyReportPdf(params, token) {
  const res = await window.api.gm.getMonthlyReportPdf(params, token);
  if (!res?.ok) {
    const err = res?.error;
    if (typeof err === "string") throw new Error(err);
    throw new Error(err ? JSON.stringify(err) : "Request failed");
  }
  return { data: res.data, filename: res.filename || "gm_monthly_report.pdf" };
}
