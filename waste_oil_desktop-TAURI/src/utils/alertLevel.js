export const THRESHOLDS = { yellow: 21, red: 26, sla: 30 };

export function getLevel(days) {
  if (days < THRESHOLDS.yellow) return "green";
  if (days < THRESHOLDS.red) return "yellow";
  return "red";
}

export function getColour(level) {
  switch (level) {
    case "green":
      return "#22d47a";
    case "yellow":
      return "#f5c842";
    case "red":
      return "#f04a5a";
    case "completed":
      return "#8fd4ff";
    default:
      return "#b8cfe0";
  }
}

export function getDaysRemaining(collectionDateStr) {
  return THRESHOLDS.sla - diffDaysLocal(collectionDateStr);
}

function diffDaysLocal(dateStr) {
  if (!dateStr) return 0;
  const s = String(dateStr);
  const d = new Date(s.includes("T") ? s : `${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today - d) / 86400000);
}
