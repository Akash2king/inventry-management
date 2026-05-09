import { unwrap } from "./_unwrap.js";

export function listSessions(active, token) {
  return unwrap(window.api.auth.listSessions({ active: active !== false }, token));
}

export function revokeSession(id, token) {
  return unwrap(window.api.auth.revokeSession(id, token));
}
