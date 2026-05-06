import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeApi } from "./nativeApi.js";
import { loadSavedApiBase } from "./apiConfig.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [apiBase, setApiBase] = useState("");
  const [api, setApi] = useState(null);
  const [user, setUser] = useState(null);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState("");

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

  const applyApiBase = useCallback(async (nextBase) => {
    const b = String(nextBase || "").trim().replace(/\/+$/, "");
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
      const res = await api.auth.login({ username, password });
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
    await api.auth.logout();
    setUser(null);
  }, [api]);

  const refreshUser = useCallback(async () => {
    if (!api) return null;
    const me = await api.auth.me();
    if (me.ok && me.data) {
      await api.persistCachedUser(me.data);
      setUser(me.data);
      return me.data;
    }
    setUser(null);
    return null;
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
    }),
    [api, apiBase, user, hydrating, error, login, logout, applyApiBase, refreshUser],
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return children;
}
