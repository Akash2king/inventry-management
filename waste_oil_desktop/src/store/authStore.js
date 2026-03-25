import { create } from "zustand";

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

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
