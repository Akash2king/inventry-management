import * as FileSystem from "expo-file-system/legacy";

/**
 * Ensure the downloads directory exists inside the app's document directory.
 * Returns the directory path (with trailing slash).
 */
export async function ensureDocsDir() {
  const dir = `${FileSystem.documentDirectory}downloads/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}
