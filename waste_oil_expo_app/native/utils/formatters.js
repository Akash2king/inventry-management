const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDate(isoStr) {
  if (!isoStr) return "—";
  const s = String(isoStr);
  const d = new Date(s.includes("T") ? s : `${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTHS[d.getMonth()];
  const y = d.getFullYear();
  return `${day} ${mon} ${y}`;
}

export function formatQty(n, unit) {
  if (n == null || n === "") return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n), 10);
  if (Number.isNaN(num)) return String(n);
  const base = num.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${base} ${unit}` : base;
}

export function diffDays(dateStr) {
  if (!dateStr) return 0;
  const s = String(dateStr);
  const d = new Date(s.includes("T") ? s : `${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today - d) / 86400000);
}

/** Calendar days from entry date to due date (SLA window length). Matches backend `sla_total_days`. */
export function slaTotalDays(entryStr, dueStr) {
  if (!entryStr || !dueStr) return null;
  const e = new Date(String(entryStr).includes("T") ? entryStr : `${entryStr}T00:00:00`);
  const du = new Date(String(dueStr).includes("T") ? dueStr : `${dueStr}T00:00:00`);
  if (Number.isNaN(e.getTime()) || Number.isNaN(du.getTime())) return null;
  e.setHours(0, 0, 0, 0);
  du.setHours(0, 0, 0, 0);
  return Math.round((du - e) / 86400000);
}

export function truncate(str, n) {
  if (str == null) return "";
  const t = String(str);
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}
