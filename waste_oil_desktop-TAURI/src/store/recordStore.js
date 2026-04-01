import { create } from "zustand";
import * as recordsApi from "@/api/records.js";
import { useAuthStore } from "./authStore.js";

function getToken() {
  return useAuthStore.getState().accessToken;
}

export const useRecordStore = create((set) => ({
  records: [],
  pagination: { count: 0, next: null, previous: null },
  activeRecord: null,
  filters: {},
  isLoading: false,
  error: null,

  fetchAll: async (filters = {}) => {
    set({ isLoading: true, error: null, filters });
    try {
      const data = await recordsApi.getAll(filters, getToken());
      const results = data.results ?? data;
      const normalized = (Array.isArray(results) ? results : []).map((r) => {
        const level = r.computed_alert_level || r.alert_level;
        return level && level !== r.alert_level
          ? { ...r, alert_level: level }
          : r;
      });
      set({
        records: normalized,
        pagination: {
          count: data.count ?? results?.length ?? 0,
          next: data.next ?? null,
          previous: data.previous ?? null,
        },
        isLoading: false,
      });
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  fetchOne: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const data = await recordsApi.getById(id, getToken());
      set({ activeRecord: data, isLoading: false });
      return data;
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  /** Refresh detail without toggling isLoading (avoids UI races during workflow modals). */
  fetchOneQuiet: async (id) => {
    try {
      const data = await recordsApi.getById(id, getToken());
      set({ activeRecord: data });
      return data;
    } catch {
      return null;
    }
  },

  createRecord: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const created = await recordsApi.create(data, getToken());
      set({ isLoading: false });
      return created;
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  updateRecord: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await recordsApi.update(id, data, getToken());
      set({ activeRecord: updated, isLoading: false });
      return updated;
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  clearActive: () => set({ activeRecord: null }),
}));
