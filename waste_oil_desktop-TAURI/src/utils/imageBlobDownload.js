function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Save an image served as a blob: URL (e.g. from authenticated fetch).
 * In Tauri: native Save dialog + writeFile (anchor download is unreliable in WebView2).
 * In browser: temporary <a download> click.
 *
 * @param {string} objectUrl from URL.createObjectURL(blob)
 * @param {string} filename suggested file name including extension
 * @returns {Promise<boolean>} true if saved or download triggered; false if user cancelled (Tauri dialog only)
 */
export async function saveImageObjectUrl(objectUrl, filename) {
  const triggerBrowserDownload = () => {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (isTauriRuntime()) {
    try {
      const res = await fetch(objectUrl);
      if (!res.ok) throw new Error(`Could not read image (${res.status})`);
      const buf = await res.arrayBuffer();
      const uint8 = new Uint8Array(buf);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: filename,
        filters: [
          {
            name: "Images",
            extensions: ["jpg", "jpeg", "png", "webp", "gif"],
          },
        ],
      });
      if (!path) return false;
      await writeFile(path, uint8);
      return true;
    } catch (e) {
      console.warn("[imageBlobDownload] Tauri save failed, falling back to browser download", e);
      triggerBrowserDownload();
      return true;
    }
  }

  triggerBrowserDownload();
  return true;
}
