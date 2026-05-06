import { unwrap } from "./_unwrap.js";

export function getLogs(filters, token) {
  const p = new URLSearchParams();
  if (filters?.page) p.set("page", String(filters.page));
  if (filters?.page_size) p.set("page_size", String(filters.page_size));
  if (filters?.action) p.set("action", filters.action);
  if (filters?.user_id) p.set("user_id", String(filters.user_id));
  if (filters?.record_id) p.set("record_id", String(filters.record_id));
  if (filters?.date_from) p.set("date_from", filters.date_from);
  if (filters?.date_to) p.set("date_to", filters.date_to);
  if (filters?.search) p.set("search", filters.search);
  const q = p.toString();
  return unwrap(window.api.audit.getLogs(q ? `?${q}` : "", token));
}
