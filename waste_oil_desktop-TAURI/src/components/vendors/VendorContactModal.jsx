import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore.js";
import * as vendorsApi from "@/api/vendors.js";

function getToken() {
  return useAuthStore.getState().accessToken;
}

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {object} [props.detail] Full vendor from list or record embed — shown immediately, no fetch
 * @param {string} [props.vendorId] Fetch this vendor (used when detail is missing or only id+name)
 * @param {string} [props.fallbackName] Label if fetch fails
 */
export function VendorContactModal({ onClose, detail, vendorId, fallbackName }) {
  const [v, setV] = useState(detail || null);
  const [loading, setLoading] = useState(Boolean(vendorId && !detail));

  useEffect(() => {
    if (detail) {
      setV(detail);
      setLoading(false);
      return undefined;
    }
    if (!vendorId) {
      setV(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    vendorsApi
      .get(vendorId, getToken())
      .then((data) => {
        if (!cancelled) setV(data);
      })
      .catch(() => {
        if (!cancelled) {
          setV({
            id: vendorId,
            name: fallbackName || "Vendor",
            contact: "—",
            address: "",
            notes: "",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail, vendorId, fallbackName]);

  const name = v?.name || fallbackName || "Vendor";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-contact-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="vendor-contact-title" style={{ marginTop: 0 }}>
          {name}
        </h3>
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", opacity: 0.8 }}>Vendor contact</p>
        {loading ? (
          <div style={{ padding: "1.5rem", textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto" }} />
          </div>
        ) : (
          <div className="grid-form" style={{ gap: "0.65rem" }}>
            <div className="field">
              <label>Contact</label>
              <div style={{ fontSize: "0.95rem" }}>{v?.contact?.trim() ? v.contact : "—"}</div>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Address</label>
              <div style={{ fontSize: "0.95rem", whiteSpace: "pre-wrap" }}>{v?.address?.trim() ? v.address : "—"}</div>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Notes</label>
              <div style={{ fontSize: "0.95rem", whiteSpace: "pre-wrap" }}>{v?.notes?.trim() ? v.notes : "—"}</div>
            </div>
          </div>
        )}
        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
