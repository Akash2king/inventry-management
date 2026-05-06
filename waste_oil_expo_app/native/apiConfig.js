import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

export const STORAGE_API_BASE_KEY = "wom_native_api_base";

export function defaultApiBaseFromEnv() {
  const fromExtra = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;
  const fromEnv =
    typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_BASE_URL;
  const raw = fromExtra || fromEnv || "";
  return String(raw).trim();
}

/**
 * Emulator: host machine Django. Physical device: set EXPO_PUBLIC_ or Settings.
 */
export function suggestLanPlaceholder() {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000/api/v1";
  }
  return "http://127.0.0.1:8000/api/v1";
}

export async function loadSavedApiBase() {
  const saved = await AsyncStorage.getItem(STORAGE_API_BASE_KEY);
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, "");
  }
  const envDefault = defaultApiBaseFromEnv();
  if (envDefault) {
    return envDefault.replace(/\/+$/, "");
  }
  return "";
}

export async function saveApiBase(url) {
  const trimmed = String(url || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    await AsyncStorage.removeItem(STORAGE_API_BASE_KEY);
    return "";
  }
  await AsyncStorage.setItem(STORAGE_API_BASE_KEY, trimmed);
  return trimmed;
}
