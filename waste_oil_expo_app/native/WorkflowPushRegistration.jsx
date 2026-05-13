import { useEffect } from "react";
import { useAuth } from "./AuthContext.jsx";
import { startWorkflowPushRegistration } from "./systemNotifications.js";

/**
 * Registers the Expo push token with the backend and keeps it updated after login.
 * Follows the Expo push setup flow (permissions, channel, token, listeners).
 */
export function WorkflowPushRegistration() {
  const { api, user } = useAuth();

  useEffect(() => {
    if (!api || !user) {
      return undefined;
    }
    let cancelled = false;
    let stop = () => {};

    void (async () => {
      const cleanup = await startWorkflowPushRegistration(api);
      if (cancelled) {
        cleanup();
        return;
      }
      stop = cleanup;
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [api, user]);

  return null;
}
