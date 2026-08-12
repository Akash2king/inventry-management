export function formatTs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function formatRelativeTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatTs(iso);
}

export function clientLabel(kind) {
  const m = { tauri: "Desktop", expo: "Mobile", web: "Web", unknown: "Unknown" };
  return m[kind] || kind || "—";
}

export function clientIcon(kind) {
  const m = {
    tauri: "desktop-outline",
    expo: "phone-portrait-outline",
    web: "globe-outline",
    unknown: "help-circle-outline",
  };
  return m[kind] || "hardware-chip-outline";
}
