import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { createNativeApi } from "./nativeApi.js";
import { loadSavedApiBase } from "./apiConfig.js";
import { clearOneSignalUser } from "./oneSignalService.js";
import { onSessionExpired, onPasswordChangeRequired } from "./utils/sessionEvents.js";
import { navigationRef } from "./navigationRef.js";
import { theme } from "./theme.js";
import { showError } from "./utils/feedback.js";

const AuthCtx = createContext(null);

function resetToLogin() {
  if (!navigationRef.isReady()) return;
  navigationRef.reset({
    index: 0,
    routes: [{ name: "Login" }],
  });
}

export function AuthProvider({ children }) {
  const [apiBase, setApiBase] = useState("");
  const [api, setApi] = useState(null);
  const [user, setUser] = useState(null);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState("");
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      const base = await loadSavedApiBase();
      if (cancelled) return;
      setApiBase(base);
      if (base) {
        try {
          setApi(createNativeApi(base));
        } catch {
          setApi(null);
        }
      }
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!api) {
      setUser(null);
      return undefined;
    }
    (async () => {
      const me = await api.auth.me();
      if (cancelled) return;
      if (me.ok && me.data) {
        await api.persistCachedUser(me.data);
        setUser(me.data);
      } else if (me.status === 401) {
        setUser(null);
      } else {
        const cached = await api.readCachedUser();
        if (!cancelled) setUser(cached);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const clearLocalSession = useCallback(() => {
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!api) return null;
    const me = await api.auth.me();
    if (me.ok && me.data) {
      await api.persistCachedUser(me.data);
      setUser(me.data);
      return me.data;
    }
    if (me.status === 401) {
      setUser(null);
    }
    return null;
  }, [api]);

  useEffect(() => {
    return onSessionExpired(() => {
      if (!userRef.current) return;
      setUser(null);
      showError("Your session ended. Please sign in again.");
      resetToLogin();
    });
  }, []);

  useEffect(() => {
    return onPasswordChangeRequired(async () => {
      if (!userRef.current) return;
      setUser((prev) => (prev ? { ...prev, must_change_password: true } : null));
      if (api) {
        const cached = await api.readCachedUser();
        if (cached) {
          cached.must_change_password = true;
          await api.persistCachedUser(cached);
        }
      }
      showError("Your password must be changed before proceeding.");
      if (navigationRef.isReady()) {
        navigationRef.navigate("ChangePassword");
      }
    });
  }, [api]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" || !api || !userRef.current) return;
      void refreshUser();
    });
    return () => sub.remove();
  }, [api, refreshUser]);

  const applyApiBase = useCallback(async (nextBase) => {
    const b = String(nextBase || "")
      .trim()
      .replace(/\/+$/, "");
    setApiBase(b);
    setError("");
    if (!b) {
      setApi(null);
      setUser(null);
      return;
    }
    try {
      const instance = createNativeApi(b);
      setApi(instance);
      const me = await instance.auth.me();
      if (me.ok && me.data) {
        await instance.persistCachedUser(me.data);
        setUser(me.data);
      } else {
        setUser(null);
      }
    } catch (e) {
      setApi(null);
      setUser(null);
      setError(e?.message || "Invalid API URL");
    }
  }, []);

  const login = useCallback(
    async (username, password) => {
      if (!api) {
        throw new Error("Set API base URL first.");
      }
      setError("");
      const res = await api.auth.login({
        username,
        password,
        device_context: {
          client: "expo",
          device_label: Constants.deviceName || `${Platform.OS} device`,
          app_version:
            Constants.expoConfig?.version ||
            String(Constants.nativeAppVersion || "") ||
            "1.0.0",
          platform: `${Platform.OS} ${String(Platform.Version ?? "")}`,
        },
      });
      if (!res.ok) {
        throw new Error(res.error || "Login failed");
      }
      const me = await api.auth.me();
      if (me.ok && me.data) {
        await api.persistCachedUser(me.data);
        setUser(me.data);
      } else {
        setUser(res.data?.user || null);
      }
    },
    [api],
  );

  const logout = useCallback(async () => {
    if (!api) {
      setUser(null);
      return;
    }
    try {
      await clearOneSignalUser(api);
    } catch {
      /* non-fatal */
    }
    await api.auth.logout();
    setUser(null);
  }, [api]);

  const value = useMemo(
    () => ({
      api,
      apiBase,
      user,
      isAuthenticated: Boolean(user),
      hydrating,
      error,
      login,
      logout,
      applyApiBase,
      refreshUser,
      clearLocalSession,
    }),
    [
      api,
      apiBase,
      user,
      hydrating,
      error,
      login,
      logout,
      applyApiBase,
      refreshUser,
      clearLocalSession,
    ],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) {
    throw new Error("useAuth must be inside AuthProvider");
  }
  return v;
}

export function AuthGate({ children }) {
  const { hydrating } = useAuth();
  if (hydrating) {
    return (
      <View style={gateStyles.wrap}>
        <View style={gateStyles.card}>
          <Text style={gateStyles.brand}>Chem-Solv Inventory</Text>
          <Text style={gateStyles.sub}>Restoring your session…</Text>
          <ActivityIndicator size="large" color={theme.colors.accent} style={gateStyles.spinner} />
        </View>
      </View>
    );
  }
  return children;
}

const gateStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.bg,
    padding: theme.space.xl,
  },
  card: {
    alignItems: "center",
    gap: theme.space.xs,
    maxWidth: 320,
  },
  brand: {
    ...theme.type.title,
    textAlign: "center",
  },
  sub: {
    ...theme.type.body,
    textAlign: "center",
    marginBottom: theme.space.md,
  },
  spinner: {
    marginTop: theme.space.sm,
  },
});
