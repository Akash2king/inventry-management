/**
 * OS-scheduled background checks for workflow inbox (supplements FCM when the app is swiped away).
 * Task must be defined at module load (Expo / TaskManager requirement).
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

const TASK_NAME = "wom-workflow-inbox-sync";
const LS_LAST_BG_UNREAD = "wom_bg_last_unread_count";

const g = typeof globalThis !== "undefined" ? globalThis : {};
if (!g.__WOM_BG_TASK_DEFINED__) {
  g.__WOM_BG_TASK_DEFINED__ = true;

  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const [{ loadSavedApiBase }, { createNativeApi }, sn] = await Promise.all([
        import("./apiConfig.js"),
        import("./nativeApi.js"),
        import("./systemNotifications.js"),
      ]);
      const { configureWorkflowNotifications, presentWorkflowLocalNotification } = sn;
      const base = await loadSavedApiBase();
      if (!base) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      const api = createNativeApi(base);
      const me = await api.auth.me();
      if (!me.ok) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      const countRes = await api.notifications.unreadCount();
      if (!countRes.ok) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
      const n = Number(countRes.data?.unread_count ?? 0);
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const prevRaw = await AsyncStorage.getItem(LS_LAST_BG_UNREAD);
      const prev = prevRaw != null ? Number(prevRaw) : 0;
      await AsyncStorage.setItem(LS_LAST_BG_UNREAD, String(n));
      if (n <= 0 || n <= prev) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      const listRes = await api.notifications.list({ unread: true, page_size: 1, page: 1 });
      const row = listRes?.ok && Array.isArray(listRes.data?.results) ? listRes.data.results[0] : null;
      const title = row?.title || "Chem-Solv Inventory";
      const body =
        row?.body ||
        (n === 1 ? "New workflow notification." : `${n} unread workflow notifications.`);
      await configureWorkflowNotifications();
      await presentWorkflowLocalNotification({ title, body });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerWorkflowBackgroundFetchSafe() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
      return;
    }
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (registered) {
      return;
    }
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    /* Expo Go / unsupported */
  }
}
