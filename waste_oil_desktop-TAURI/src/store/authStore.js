import { create } from "zustand";

/** Must match `LS_ACCESS` / `LS_REFRESH` in `platform/installBrowserApi.js`. */
const LS_ACCESS = "wom_access_token";
const LS_REFRESH = "wom_refresh_token";

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user }),

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const res = await window.api.auth.login({ username, password });
      if (!res.ok) {
        throw new Error(res.error || "Login failed");
      }
      const d = res.data;
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
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      if (!window.api?.auth?.me) {
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
        set({
          user: res.data,
          accessToken: localStorage.getItem(LS_ACCESS),
          refreshToken: localStorage.getItem(LS_REFRESH),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
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
