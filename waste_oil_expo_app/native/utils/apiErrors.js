/**
 * Turn DRF / JSON API error bodies into a short line for users.
 * Avoids raw objects and Django DEBUG HTML dumps in the UI.
 */

const MAX_MESSAGE_LEN = 280;

function truncate(msg) {
  const s = String(msg || "").trim();
  if (!s) return "Request failed";
  if (s.length <= MAX_MESSAGE_LEN) return s;
  return `${s.slice(0, MAX_MESSAGE_LEN - 1)}…`;
}

function looksLikeHtml(text) {
  const t = String(text || "").trim().toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    (t.includes("<html") && t.includes("</html>")) ||
    (t.includes("<head") && t.includes("<body"))
  );
}

/** Extract a short summary from Django's DEBUG HTML error page. */
function summarizeDjangoHtml(html) {
  const text = String(html || "");
  const exc =
    text.match(/Exception\s+Value:\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] ||
    text.match(/<pre class="exception_value">([\s\S]*?)<\/pre>/i)?.[1] ||
    text.match(/Exception Value:\s*([^\n<]+)/i)?.[1];
  const title =
    text.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ||
    text.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1];

  const clean = (s) =>
    String(s || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const excClean = clean(exc);
  const titleClean = clean(title);

  if (excClean && /10061|connection refused|redis|6379/i.test(excClean)) {
    return "Backend cannot reach Redis. Restart the API (dev uses in-memory cache) or start Redis.";
  }
  if (excClean) return truncate(excClean);
  if (titleClean && !/^django/i.test(titleClean)) return truncate(titleClean);
  return "Server error. Check the backend logs.";
}

export function humanizeApiErrorBody(data) {
  if (data == null || data === "") return "Request failed";

  if (typeof data === "string") {
    if (looksLikeHtml(data)) return summarizeDjangoHtml(data);
    return truncate(data);
  }

  if (typeof data.detail === "string") {
    if (looksLikeHtml(data.detail)) return summarizeDjangoHtml(data.detail);
    return truncate(data.detail);
  }
  if (Array.isArray(data.detail)) {
    return truncate(
      data.detail
        .map((d) => (typeof d === "string" ? d : String(d)))
        .filter(Boolean)
        .join(" ")
    );
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
  if (pieces.length) return truncate(pieces.join(" "));

  if (data.detail != null && typeof data.detail === "object") {
    return humanizeApiErrorBody(data.detail);
  }

  try {
    return truncate(JSON.stringify(data));
  } catch {
    return "Request failed";
  }
}

/** Map login/API failures to short copy for alerts. */
export function friendlyLoginMessage(raw) {
  const msg = String(raw || "").trim();
  if (!msg) return "Sign in failed";
  const lower = msg.toLowerCase();
  if (msg.includes("401") || lower.includes("no active account") || lower.includes("invalid")) {
    return "Invalid username or password.";
  }
  if (lower.includes("password") && lower.includes("blank")) {
    return "Please enter your password.";
  }
  if (lower.includes("username") && lower.includes("blank")) {
    return "Please enter your username.";
  }
  if (looksLikeHtml(msg)) return summarizeDjangoHtml(msg);
  return truncate(msg);
}
