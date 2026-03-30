/**
 * Build `?...` for /records links from dashboard date scope + extra API params.
 */
export function buildRecordsSearch(scope, extra = {}) {
  const p = new URLSearchParams();
  const { dateFrom, dateTo, lookbackDays, todayStart } = scope;

  if (dateFrom && dateTo) {
    p.set("date_from", dateFrom);
    p.set("date_to", dateTo);
  } else if (lookbackDays && lookbackDays > 0 && todayStart) {
    const end = new Date(todayStart);
    const start = new Date(todayStart);
    start.setDate(start.getDate() - lookbackDays);
    p.set("date_from", start.toISOString().slice(0, 10));
    p.set("date_to", end.toISOString().slice(0, 10));
  }

  Object.entries(extra).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (v === true) p.set(k, "1");
    else p.set(k, String(v));
  });

  const q = p.toString();
  return q ? `?${q}` : "";
}
