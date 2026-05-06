/**
 * Save an image served as a blob: URL (e.g. from authenticated fetch).
 * Uses a temporary <a download> click in browser/WebView.
 *
 * @param {string} objectUrl from URL.createObjectURL(blob)
 * @param {string} filename suggested file name including extension
 * @returns {Promise<boolean>} true if download triggered
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

  triggerBrowserDownload();
  return true;
}
