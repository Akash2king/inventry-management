/**
 * Turn DRF / JSON API error bodies into a single line for users.
 * Avoids showing raw objects like {"password":["This field may not be blank."]}.
 */
export function humanizeApiErrorBody(data) {
  if (data == null || data === "") return "Request failed";
  if (typeof data === "string") return data;

  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => (typeof d === "string" ? d : String(d)))
      .filter(Boolean)
      .join(" ");
  }

  const pieces = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === "detail") continue;
    const msgs = Array.isArray(val) ? val : val != null ? [val] : [];
    const text = msgs
      .map((m) => (typeof m === "string" ? m : String(m)))
      .filter(Boolean)
      .join(" ");
    if (!text) continue;
    const label =
      key === "non_field_errors"
        ? ""
        : key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    pieces.push(label ? `${label}: ${text}` : text);
  }
  if (pieces.length) return pieces.join(" ");

  if (data.detail != null && typeof data.detail === "object") {
    return humanizeApiErrorBody(data.detail);
  }

  try {
    return JSON.stringify(data);
  } catch {
    return "Request failed";
  }
}
