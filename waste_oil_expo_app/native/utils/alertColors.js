import { theme } from "../theme.js";

export function normalizeAlertLevel(level) {
  const k = String(level || "green").toLowerCase();
  if (k === "completed") return "completed";
  if (k === "red" || k === "orange" || k === "yellow" || k === "green") return k;
  return "green";
}

export function alertPalette(level) {
  const key = normalizeAlertLevel(level);
  return theme.colors.alert[key] || theme.colors.alert.green;
}
