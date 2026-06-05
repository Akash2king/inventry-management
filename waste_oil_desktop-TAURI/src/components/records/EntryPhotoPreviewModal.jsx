import { useEffect, useState } from "react";
import { saveImageObjectUrl } from "@/utils/imageBlobDownload.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";

function extFromMime(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  return ".jpg";
}

export function safeEntryPhotoFilename(base, mime) {
  const safe = String(base || "record")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim() || "record";
  return `${safe}-entry-photo${extFromMime(mime)}`;
}

export function EntryPhotoPreviewModal({ imageUrl, onClose, downloadFilename }) {
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    const name = downloadFilename || "entry-photo.jpg";
    setDownloadBusy(true);
    try {
      await saveImageObjectUrl(imageUrl, name);
    } catch (e) {
      showToast(e?.message || "Could not save the image.", "error");
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-photo-preview-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <h3 id="entry-photo-preview-title" style={{ margin: 0, color: "var(--clr-text-bright)" }}>
            Entry photo
          </h3>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={downloadBusy}
              onClick={handleDownload}
            >
              {downloadBusy ? "Saving…" : "Download"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "200px",
            background: "var(--clr-surface-alt, #f0f0f0)",
            borderRadius: 8,
            padding: "0.75rem",
          }}
        >
          <img
            src={imageUrl}
            alt="Entry photo"
            style={{
              maxWidth: "100%",
              maxHeight: "min(70vh, 720px)",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
}
