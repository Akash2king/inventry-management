import { create } from "zustand";

/** Must match `LS_ACCESS` / `LS_REFRESH` in `platform/installBrowserApi.js`. */
const LS_ACCESS = "wom_access_token";
const LS_REFRESH = "wom_refresh_token";
const LS_USER = "wom_user_profile";

function readCachedUser() {
  try {
    const raw = localStorage.getItem(LS_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persistCachedUser(user) {
  try {
    if (!user) {
      localStorage.removeItem(LS_USER);
      return;
    }
    localStorage.setItem(LS_USER, JSON.stringify(user));
  } catch {
    /* ignore localStorage failures */
  }
}

const bootAccess = localStorage.getItem(LS_ACCESS);
const bootRefresh = localStorage.getItem(LS_REFRESH);
const bootUser = readCachedUser();
const bootAuthenticated = Boolean(bootAccess && bootUser);

export const useAuthStore = create((set, get) => ({
  user: bootUser,
  accessToken: bootAccess,
  refreshToken: bootRefresh,
  isAuthenticated: bootAuthenticated,
  isLoading: false,

  setUser: (user) => set({ user }),

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const res = await window.api.auth.login({
        username,
        password,
        device_context: {
          client: "tauri",
          device_label: "Chem-Solv Desktop",
          app_version: import.meta.env?.VITE_APP_VERSION || "0.1.0",
          platform: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      });
      if (!res.ok) {
        throw new Error(res.error || "Login failed");
      }
      const d = res.data;
      persistCachedUser(d.user);
      set({
        user: d.user,
        accessToken: d.access_token,
        refreshToken: d.refresh_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    if (!window.api?.auth?.changePassword) {
      throw new Error("API not available");
    }
    const res = await window.api.auth.changePassword({
      old_password: oldPassword,
      new_password: newPassword,
    });
    if (!res.ok) {
      throw new Error(res.error || "Could not change password");
    }
    persistCachedUser(res.data);
    set({ user: res.data });
    return res.data;
  },

  updateProfile: async (payload) => {
    if (!window.api?.auth?.updateProfile) {
      throw new Error("API not available");
    }
    const res = await window.api.auth.updateProfile(payload || {});
    if (!res.ok) {
      throw new Error(res.error || "Could not update profile");
    }
    persistCachedUser(res.data);
    set({ user: res.data });
    return res.data;
  },

  logout: async () => {
    const rt = get().refreshToken;
    try {
      await window.api.auth.logout({ refresh_token: rt });
    } catch {
      /* ignore */
    }
    persistCachedUser(null);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  restoreSession: async () => {
    const hasBootSession = Boolean(get().accessToken && get().user);
    if (!hasBootSession) {
      set({ isLoading: true });
    }
    try {
      if (!window.api?.auth?.me) {
        persistCachedUser(null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }
      const res = await window.api.auth.me();
      if (res.ok) {
        persistCachedUser(res.data);
        set({
          user: res.data,
          accessToken: localStorage.getItem(LS_ACCESS),
          refreshToken: localStorage.getItem(LS_REFRESH),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        if (hasBootSession && res.status !== 401) {
          set({ isLoading: false });
          return;
        }
        persistCachedUser(null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      if (hasBootSession) {
        set({ isLoading: false });
        return;
      }
      persistCachedUser(null);
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("wom:tokens-refreshed", () => {
    try {
      useAuthStore.setState({
        accessToken: localStorage.getItem(LS_ACCESS),
        refreshToken: localStorage.getItem(LS_REFRESH),
      });
    } catch {
      /* ignore */
    }
  });
}
