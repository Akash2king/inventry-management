import { create } from "zustand";
import * as workflowApi from "@/api/workflow.js";
import { useAuthStore } from "./authStore.js";

function token() {
  return useAuthStore.getState().accessToken;
}

export const useWorkflowStore = create((set, get) => ({
  queue: [],
  transitions: [],
  isLoading: false,
  error: null,

  fetchQueue: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await workflowApi.getQueue(token());
      set({ queue: Array.isArray(data) ? data : [], isLoading: false });
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  fetchTransitions: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const data = await workflowApi.getTransitions(id, token());
      set({ transitions: Array.isArray(data) ? data : [], isLoading: false });
    } catch (e) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  forward: async (id, options) => {
    set({ error: null });
    try {
      return await workflowApi.forward(id, options, token());
    } catch (e) {
      set({ error: e.message });
      throw e;
    }
  },

  returnRecord: async (id, reason) => {
    set({ error: null });
    try {
      return await workflowApi.returnRecord(id, reason, token());
    } catch (e) {
      set({ error: e.message });
      throw e;
    }
  },

  clearTransitions: () => set({ transitions: [] }),
}));
