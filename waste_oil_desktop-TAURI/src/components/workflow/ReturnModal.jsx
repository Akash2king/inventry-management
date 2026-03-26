import { useState } from "react";
import { z } from "zod";
import { useAuthStore } from "@/store/authStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import { useRecordStore } from "@/store/recordStore.js";
import * as workflowApi from "@/api/workflow.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";

const reasonSchema = z
  .string()
  .trim()
  .min(10, "At least 10 characters required");

export function ReturnModal({ recordId, prevStageName, onClose }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid reason");
      return;
    }
    setBusy(true);
    try {
      const token = useAuthStore.getState().accessToken;
      const updated = await workflowApi.returnRecord(recordId, parsed.data, token);
      if (updated?.id) {
        useRecordStore.setState({ activeRecord: updated });
      }
      showToast("Record returned ✓", "success");
      onClose();
      workflowApi
        .getTransitions(recordId, token)
        .then((rows) => {
          if (Array.isArray(rows)) {
            useWorkflowStore.setState({ transitions: rows });
          }
        })
        .catch(() => {});
      useRecordStore.getState().fetchOneQuiet(recordId);
    } catch (err) {
      showToast(err.message || "Return failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Return to {prevStageName}</h3>
        <p style={{ fontSize: "0.85rem", opacity: 0.9 }}>
          The previous holder will be notified.
        </p>
        <form onSubmit={submit}>
          <label className="field" style={{ display: "block", marginBottom: "0.75rem" }}>
            <span>Reason (required)</span>
            <textarea
              value={reason}
              rows={4}
              style={{ width: "100%", marginTop: 6 }}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error ? <div className="field-error" style={{ marginBottom: 8 }}>{error}</div> : null}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              {busy ? "Working…" : "Confirm Return"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
