import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore.js";
import * as recordsApi from "@/api/records.js";
import {
  EntryPhotoPreviewModal,
  safeEntryPhotoFilename,
} from "@/components/records/EntryPhotoPreviewModal.jsx";

const thumbImg = {
  width: 38,
  height: 38,
  objectFit: "cover",
  borderRadius: 6,
  border: "1px solid var(--clr-border)",
};

const detailImg = {
  width: "100%",
  maxWidth: "420px",
  height: "auto",
  aspectRatio: "16 / 10",
  objectFit: "cover",
  borderRadius: 8,
  border: "1px solid var(--clr-border)",
};

export function RecordEntryPhoto({
  recordId,
  variant = "thumb",
  /** When true, clicking the thumbnail opens a modal with download (detail view). */
  enablePreviewModal = false,
  /** Used for download filename, e.g. record_number */
  downloadBaseName = "",
}) {
  const token = useAuthStore((s) => s.accessToken);
  const [src, setSrc] = useState(null);
  const [blobMime, setBlobMime] = useState("");
  const [status, setStatus] = useState("idle");
  const [previewOpen, setPreviewOpen] = useState(false);

  const imgStyle = variant === "detail" ? detailImg : thumbImg;
  const placeholderStyle =
    variant === "detail"
      ? {
          width: "100%",
          maxWidth: 420,
          height: 260,
          borderRadius: 8,
          border: "1px solid var(--clr-border)",
          background: "var(--clr-surface-alt, #e8e8e8)",
        }
      : {
          width: 38,
          height: 38,
          borderRadius: 6,
          border: "1px solid var(--clr-border)",
          background: "var(--clr-surface-alt, #e8e8e8)",
        };

  useEffect(() => {
    if (!recordId) {
      setSrc(null);
      setStatus("idle");
      return undefined;
    }
    if (!token) {
      setSrc(null);
      setStatus("idle");
      return undefined;
    }
    if (typeof window.api?.records?.getEntryPhoto !== "function") {
      setStatus("error");
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setStatus("loading");
    setSrc(null);
    setBlobMime("");

    (async () => {
      const res = await recordsApi.getEntryPhoto(recordId, token);
      if (cancelled) return;
      if (!res?.ok) {
        setStatus("error");
        return;
      }
      setBlobMime(res.blob?.type || "");
      objectUrl = URL.createObjectURL(res.blob);
      setSrc(objectUrl);
      setStatus("ok");
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recordId, token]);

  if (!recordId) return null;

  if (status === "error") {
    return (
      <span style={{ fontSize: "0.75rem", color: "var(--clr-text-muted, #888)" }} title="Photo could not be loaded">
        —
      </span>
    );
  }

  if (status !== "ok" || !src) {
    return <div aria-hidden style={placeholderStyle} />;
  }

  const downloadName = safeEntryPhotoFilename(downloadBaseName, blobMime);

  const thumb = <img src={src} alt="Entry" style={imgStyle} />;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem",
          alignItems: variant === "thumb" ? "center" : "flex-start",
        }}
      >
        {enablePreviewModal ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            style={{
              padding: 0,
              margin: 0,
              border: "none",
              background: "none",
              cursor: "zoom-in",
              borderRadius: imgStyle.borderRadius,
              lineHeight: 0,
              minWidth: 44,
              minHeight: 44,
            }}
            aria-label="Open entry photo preview"
          >
            {thumb}
          </button>
        ) : (
          thumb
        )}
        {enablePreviewModal ? (
          <span style={{ fontSize: "0.78rem", opacity: 0.75 }}>Click image to enlarge or download</span>
        ) : null}
      </div>
      {previewOpen && src ? (
        <EntryPhotoPreviewModal
          imageUrl={src}
          onClose={() => setPreviewOpen(false)}
          downloadFilename={downloadName}
        />
      ) : null}
    </>
  );
}
