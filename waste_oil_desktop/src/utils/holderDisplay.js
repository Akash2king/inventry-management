/** Format API record list/detail holder fields for UI. */
export function formatHolderLine(record) {
  if (!record) return "—";
  const u = record.current_holder_username;
  const n = record.current_holder_name;
  if (!u && !n) return "—";
  if (u && n && n !== u) return `${n} (@${u})`;
  if (u) return `@${u}`;
  return n || "—";
}
