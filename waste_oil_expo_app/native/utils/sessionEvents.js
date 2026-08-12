const expiredListeners = new Set();
const refreshedListeners = new Set();

export function onSessionExpired(listener) {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function emitSessionExpired(detail = {}) {
  expiredListeners.forEach((fn) => {
    try {
      fn(detail);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function onTokensRefreshed(listener) {
  refreshedListeners.add(listener);
  return () => refreshedListeners.delete(listener);
}

export function emitTokensRefreshed() {
  refreshedListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}
