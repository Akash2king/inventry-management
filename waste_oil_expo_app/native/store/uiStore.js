import { create } from "zustand";

let _id = 0;

export const useUiStore = create((set, get) => ({
  /** Increment to remount `<Outlet />` and reload the current route’s data. */
  pageRefreshNonce: 0,
  bumpPageRefresh: () =>
    set((s) => ({ pageRefreshNonce: s.pageRefreshNonce + 1 })),

  toasts: [],
  showToast: (message, type = "success") => {
    const id = ++_id;
    set((s) => ({
      toasts: [...s.toasts, { id, message, type }],
    }));
    const ms = type === "error" ? 9000 : 4500;
    setTimeout(() => get().dismissToast(id), ms);
  },
  dismissToast: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),

  /** Branded modal dialog (replaces Alert.alert on native). */
  dialog: null,
  showDialog: (opts) => {
    const id = ++_id;
    set({
      dialog: {
        id,
        title: opts.title || "",
        message: opts.message || "",
        icon: opts.icon || null,
        variant: opts.variant || "default",
        cancelable: opts.cancelable !== false,
        buttons: Array.isArray(opts.buttons) ? opts.buttons : [{ text: "OK" }],
      },
    });
    return id;
  },
  dismissDialog: () => set({ dialog: null }),

  sidebarOpen: false,
  setSidebarOpen: (isOpen) => set({ sidebarOpen: Boolean(isOpen) }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
