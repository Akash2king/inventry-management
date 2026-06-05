import { unwrap } from "./_unwrap.js";

export function listNotifications(params, token) {
  return unwrap(window.api.notifications.list(params || {}, token));
}

export function unreadCount(token) {
  return unwrap(window.api.notifications.unreadCount(token));
}

export function broadcastNotification(data, token) {
  return unwrap(window.api.notifications.broadcast(data || {}, token));
}

export function markRead(id, token) {
  return unwrap(window.api.notifications.markRead(id, token));
}

export function markAllRead(token) {
  return unwrap(window.api.notifications.markAllRead(token));
}
