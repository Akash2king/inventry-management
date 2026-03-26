import { useEffect, useState } from "react";
import { useRecordStore } from "@/store/recordStore.js";
import { useAuthStore } from "@/store/authStore.js";
import * as workflowApi from "@/api/workflow.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";

function getToken() {
  return useAuthStore.getState().accessToken;
}

export function ForwardModal({ recordId, nextStageName, currentStage = 1, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [selectedHolderId, setSelectedHolderId] = useState("");
  const [candidateError, setCandidateError] = useState("");

  const needsAssignee = currentStage < 5;

  useEffect(() => {
    if (!needsAssignee) {
      setLoadingCandidates(false);
      setCandidates([]);
      setSelectedHolderId("");
      setCandidateError("");
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingCandidates(true);
      setCandidateError("");
      try {
        const data = await workflowApi.getForwardCandidates(recordId, getToken());
        const list = Array.isArray(data) ? data : [];
        if (cancelled) return;
        setCandidates(list);
        if (list.length === 1) {
          setSelectedHolderId(String(list[0].id));
        } else {
          setSelectedHolderId("");
        }
      } catch (e) {
        if (!cancelled) {
          setCandidates([]);
          setCandidateError(e.message || "Could not load users for the next stage.");
        }
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId, needsAssignee]);

  async function submit(e) {
    e.preventDefault();
    if (needsAssignee) {
      if (candidates.length === 0) {
        showToast("No active users at the next stage. Add users in GM console.", "error");
        return;
      }
      if (!selectedHolderId) {
        showToast("Select the user who should receive this record.", "error");
        return;
      }
    }
    setBusy(true);
    try {
      const payload = { note };
      if (needsAssignee && selectedHolderId) {
        payload.next_holder_id = selectedHolderId;
      }
      const updated = await workflowApi.forward(recordId, payload, getToken());
      if (updated?.id) {
        useRecordStore.setState({ activeRecord: updated });
      }
      showToast("Record forwarded ✓", "success");
      onClose();
      const tok = getToken();
      workflowApi
        .getTransitions(recordId, tok)
        .then((rows) => {
          if (Array.isArray(rows)) {
            useWorkflowStore.setState({ transitions: rows });
          }
        })
        .catch(() => {});
      useRecordStore.getState().fetchOneQuiet(recordId);
    } catch (err) {
      showToast(err.message || "Forward failed", "error");
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
        <h3 style={{ marginTop: 0 }}>Forward to {nextStageName}</h3>
        <form onSubmit={submit}>
          {needsAssignee ? (
            <div className="field" style={{ marginBottom: "0.75rem" }}>
              <label>Assign to user (next stage)</label>
              {loadingCandidates ? (
                <p style={{ opacity: 0.85, marginTop: 6 }}>Loading users…</p>
              ) : candidates.length === 0 ? (
                <p style={{ marginTop: 6, color: "var(--clr-danger, #b42318)" }}>
                  {candidateError || "No eligible users at the next stage."}
                </p>
              ) : (
                <select
                  value={selectedHolderId}
                  onChange={(e) => setSelectedHolderId(e.target.value)}
                  required={candidates.length > 0}
                  style={{ width: "100%", marginTop: 6 }}
                >
                  {candidates.length > 1 ? (
                    <option value="">Choose a user…</option>
                  ) : null}
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.full_name || c.username).trim()} (@{c.username})
                      {c.department_name ? ` — ${c.department_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          <label className="field" style={{ display: "block", marginBottom: "0.75rem" }}>
            <span>Note (optional, max 500)</span>
            <textarea
              value={note}
              maxLength={500}
              rows={4}
              style={{ width: "100%", marginTop: 6 }}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                busy || (needsAssignee && (loadingCandidates || candidates.length === 0))
              }
            >
              {busy ? "Working…" : "Confirm Forward"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
