import { create } from "zustand";

let _id = 0;

export const useUiStore = create((set, get) => ({
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
}));
