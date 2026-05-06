import { useEffect, useMemo, useState } from "react";
import { useRecordStore, normalizeRecordPayload } from "@/store/recordStore.js";
import { useAuthStore } from "@/store/authStore.js";
import * as workflowApi from "@/api/workflow.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";

function getToken() {
  return useAuthStore.getState().accessToken;
}

export function ForwardModal({ recordId, onClose }) {
  const activeRecord = useRecordStore((s) => s.activeRecord);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [selectedHolderId, setSelectedHolderId] = useState("");
  const [candidateError, setCandidateError] = useState("");
  const [search, setSearch] = useState("");

  const currentStage =
    activeRecord && String(activeRecord.id) === String(recordId)
      ? Number(activeRecord.current_stage || 1)
      : 1;
  const needsAssignee = currentStage < 5;

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const name = (c.full_name || "").toLowerCase();
      const username = (c.username || "").toLowerCase();
      const dept = (c.department_name || "").toLowerCase();
      return (
        name.includes(q) ||
        username.includes(q) ||
        dept.includes(q)
      );
    });
  }, [candidates, search]);

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
          showToast("No eligible active users found. Add or activate users in GM console.", "error");
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
        useRecordStore.setState({ activeRecord: normalizeRecordPayload(updated) });
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
        <h3 style={{ marginTop: 0 }}>Forward Record</h3>
        <form onSubmit={submit}>
          {needsAssignee ? (
            <div className="field" style={{ marginBottom: "0.75rem" }}>
              <label>Assign to user (any department under manager scope)</label>
              {loadingCandidates ? (
                <p style={{ opacity: 0.85, marginTop: 6 }}>Loading users…</p>
              ) : candidates.length === 0 ? (
                <p style={{ marginTop: 6, color: "var(--clr-danger, #b42318)" }}>
                  {candidateError || "No eligible users found for forwarding."}
                </p>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search by name, username, or department…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      marginBottom: 6,
                    }}
                  />
                  <select
                    value={selectedHolderId}
                    onChange={(e) => setSelectedHolderId(e.target.value)}
                    required={filteredCandidates.length > 0}
                    style={{ width: "100%" }}
                  >
                    {filteredCandidates.length !== 1 ? (
                      <option value="">Choose a user…</option>
                    ) : null}
                    {filteredCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c.full_name || c.username).trim()} (@{c.username})
                        {c.department_name ? ` — ${c.department_name}` : ""}
                      </option>
                    ))}
                  </select>
                  {filteredCandidates.length === 0 && (
                    <p style={{ marginTop: 4, fontSize: "0.8rem", opacity: 0.75 }}>
                      No matches for this search in eligible users.
                    </p>
                  )}
                </>
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
