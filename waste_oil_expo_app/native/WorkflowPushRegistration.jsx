import { useEffect } from "react";
import { useAuth } from "./AuthContext.jsx";
import { startOneSignalSession } from "./oneSignalService.js";

/**
 * Links the signed-in user to OneSignal (external user id) and registers the subscription with Django.
 */
export function WorkflowPushRegistration() {
  const { api, user } = useAuth();

  useEffect(() => {
    if (!api || !user) {
      return undefined;
    }
    return startOneSignalSession(api, user);
  }, [api, user]);

  return null;
}
