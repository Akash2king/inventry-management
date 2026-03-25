export function StatusBadge({ level }) {
  const l = (level || "green").toLowerCase();
  if (l === "completed") {
    return <span className="badge-completed">✅ Completed</span>;
  }
  if (l === "yellow") {
    return <span className="badge-yellow">🟡 Warning</span>;
  }
  if (l === "red") {
    return <span className="badge-red">🔴 Overdue</span>;
  }
  return <span className="badge-green">🟢 On Track</span>;
}
