import { create } from "zustand";
import * as recordsApi from "@/api/records.js";
import { useAuthStore } from "./authStore.js";

function getToken() {
  return useAuthStore.getState().accessToken;
}

/** Align displayed alert with server-computed SLA band (same as list view). */
export function normalizeRecordPayload(r) {
  if (!r || typeof r !== "object") return r;
  const level = r.computed_alert_level || r.alert_level;
  if (level && level !== r.alert_level) {
    return { ...r, alert_level: level };
  }
  return r;
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
      const normalized = (Array.isArray(results) ? results : []).map((r) => normalizeRecordPayload(r));
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
      const rec = normalizeRecordPayload(data);
      set({ activeRecord: rec, isLoading: false });
      return rec;
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  /** Refresh detail without toggling isLoading (avoids UI races during workflow modals). */
  fetchOneQuiet: async (id) => {
    try {
      const data = await recordsApi.getById(id, getToken());
      const rec = normalizeRecordPayload(data);
      set({ activeRecord: rec });
      return rec;
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
      const rec = normalizeRecordPayload(updated);
      set({ activeRecord: rec, isLoading: false });
      return rec;
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  clearActive: () => set({ activeRecord: null }),
}));
