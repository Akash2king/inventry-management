import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRecordStore } from "@/store/recordStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import { useAuthStore } from "@/store/authStore.js";
import { formatDate, formatQty, slaTotalDays, diffDays } from "@/utils/formatters.js";
import { StatusBadge } from "@/components/records/StatusBadge.jsx";
import { WorkflowTimeline } from "@/components/workflow/WorkflowTimeline.jsx";
import { ForwardModal } from "@/components/workflow/ForwardModal.jsx";
import { ReturnModal } from "@/components/workflow/ReturnModal.jsx";
import { canActForward, canActReturn, canActEdit, isCurrentHolder } from "@/utils/permissions.js";
import { nextStageName, prevStageName } from "@/utils/stageLabels.js";
import { formatHolderLine } from "@/utils/holderDisplay.js";
import { VendorContactModal } from "@/components/vendors/VendorContactModal.jsx";

export function RecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fetchOne = useRecordStore((s) => s.fetchOne);
  const activeRecord = useRecordStore((s) => s.activeRecord);
  const fetchTransitions = useWorkflowStore((s) => s.fetchTransitions);
  const transitions = useWorkflowStore((s) => s.transitions);
  const [fwdOpen, setFwdOpen] = useState(false);
  const [retOpen, setRetOpen] = useState(false);
  const [vendorModal, setVendorModal] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetchOne(id).catch(() => {});
    fetchTransitions(id).catch(() => {});
  }, [id, fetchOne, fetchTransitions]);

  useEffect(() => {
    if (!id) return undefined;
    const tick = () => {
      if (fwdOpen || retOpen) return;
      const cur = useRecordStore.getState().activeRecord;
      if (!cur || String(cur.id) !== String(id) || cur.is_locked) return;
      fetchOne(id).catch(() => {});
      fetchTransitions(id).catch(() => {});
    };
    const iv = setInterval(tick, 15000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [id, fetchOne, fetchTransitions, fwdOpen, retOpen]);

  const r = activeRecord;
  if (!r || String(r.id) !== String(id)) {
    return (
      <div className="fullscreen-center">
        <div className="spinner" />
      </div>
    );
  }

  const mustChangePassword = Boolean(user?.must_change_password);
  const showFwd = canActForward(r, user) && !mustChangePassword;
  const showRet = canActReturn(r, user) && !mustChangePassword;
  const showEdit = canActEdit(r, user) && !mustChangePassword;
  const holderIsViewer =
    r.viewer_is_holder !== undefined && r.viewer_is_holder !== null
      ? Boolean(r.viewer_is_holder)
      : isCurrentHolder(r, user);
  const holderLabel = formatHolderLine(r);
  const readOnlyViewer =
    !r.is_locked && !holderIsViewer && user && ["storeman", "treatment", "admin", "manager", "gm", "superadmin"].includes(user.role);
  const attachments = Array.isArray(r.attachment_paths) ? r.attachment_paths : [];
  const slaTotal =
    typeof r.sla_total_days === "number" ? r.sla_total_days : slaTotalDays(r.entry_date, r.due_date);
  const daysSinceEntry =
    typeof r.days_elapsed === "number" ? r.days_elapsed : diffDays(r.entry_date);
  const effectiveAlert = r.computed_alert_level || r.alert_level;
  const needsCorrection = Boolean(r.needs_workflow_correction);
  const returnFeedback =
    typeof r.pending_return_feedback === "string" && r.pending_return_feedback.trim()
      ? r.pending_return_feedback.trim()
      : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, color: "var(--clr-text-bright)" }}>{r.record_number}</h2>
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/records")}>
          Back to list
        </button>
      </div>

      {needsCorrection && !r.is_locked ? (
        <div
          className={`record-return-banner ${holderIsViewer ? "record-return-banner-holder" : "record-return-banner-muted"}`}
          role="alert"
        >
          <strong>Returned to this stage — corrections requested</strong>
          {returnFeedback ? (
            <div className="record-return-feedback">{returnFeedback}</div>
          ) : (
            <p style={{ margin: "0.5rem 0 0", opacity: 0.9 }}>No detailed reason was provided.</p>
          )}
          {holderIsViewer ? (
            <p className="record-return-cta">
              Update the record to address this feedback, then forward when it is ready for the next department.
            </p>
          ) : (
            <p style={{ margin: "0.65rem 0 0", fontSize: "0.88rem", opacity: 0.9 }}>
              Only the current holder can edit and forward. The issue above is what the next stage asked to be corrected.
            </p>
          )}
        </div>
      ) : null}

      {readOnlyViewer ? (
        <div className="record-readonly-hint" role="status">
          <strong>View only.</strong> You can open this record because you worked on it or it is in your pipeline.
          Actions belong to the current holder: <strong>{holderLabel}</strong>.
        </div>
      ) : null}
      {mustChangePassword ? (
        <div className="record-readonly-hint" role="status">
          <strong>View only until you change your password.</strong> Forward, return, and edit stay disabled for
          everyone until you complete a password update from the sidebar or sign-in flow.
        </div>
      ) : null}
      {holderIsViewer && !r.is_locked && !mustChangePassword ? (
        <div className="record-holder-hint" role="status">
          You are the <strong>current holder</strong> — you can forward, return, or edit (when your stage matches).
        </div>
      ) : null}

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="grid-form">
          <div className="field">
            <label>Vendor</label>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
              <span>{r.vendor?.name ?? r.vendor_name ?? "—"}</span>
              {r.vendor || r.vendor_id ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (r.vendor) setVendorModal({ detail: r.vendor });
                    else if (r.vendor_id) {
                      setVendorModal({
                        vendorId: String(r.vendor_id),
                        fallbackName: r.vendor_name || "Vendor",
                      });
                    }
                  }}
                >
                  Contact card
                </button>
              ) : null}
            </div>
          </div>
          <Field label="Vendor contact" value={r.vendor?.contact || "—"} />
          <Field label="Vendor address" value={r.vendor?.address || "—"} />
          <Field label="Product description" value={r.product_description || "—"} />
          <Field label="Product type" value={r.product_type || "—"} />
          <Field label="Quantity" value={formatQty(r.quantity, r.unit)} />
          <Field label="Entry date" value={formatDate(r.entry_date)} />
          <Field label="Due date" value={formatDate(r.due_date)} />
          <Field
            label="SLA window"
            value={
              slaTotal != null
                ? `${slaTotal} day${slaTotal === 1 ? "" : "s"} (entry → due)`
                : "—"
            }
          />
          <Field
            label="Days since entry"
            value={typeof daysSinceEntry === "number" ? String(daysSinceEntry) : "—"}
          />
          <Field label="Stage" value={String(r.current_stage)} />
          <Field label="Current holder" value={holderLabel} />
          <Field label="Department" value={r.current_department_name || "—"} />
          <Field label="Alert" value={<StatusBadge level={effectiveAlert} />} />
          <Field label="Locked" value={r.is_locked ? "Yes" : "No"} />
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Remarks</label>
            <div>{r.remarks || "—"}</div>
          </div>
          {attachments.length > 0 ? (
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Attachments</label>
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {attachments.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        <WorkflowTimeline record={r} transitions={transitions} />
        <div className="card">
          <h3 style={{ marginTop: 0, color: "var(--clr-text-bright)" }}>Actions</h3>
          {showFwd ? (
            <button type="button" className="btn btn-primary" style={{ marginRight: 8 }} onClick={() => setFwdOpen(true)}>
              Forward
            </button>
          ) : null}
          {showRet ? (
            <button type="button" className="btn btn-danger" onClick={() => setRetOpen(true)}>
              Return
            </button>
          ) : null}
          {!showFwd && !showRet ? (
            <p style={{ opacity: 0.85, fontSize: "0.9rem", lineHeight: 1.45 }}>
              {r.is_locked
                ? "This record is completed and locked."
                : holderIsViewer
                  ? "No forward/return from this stage, or your role does not match the current stage."
                  : `Only the current holder (${holderLabel}) can forward or return.`}
            </p>
          ) : null}
          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!showEdit}
              title={!showEdit ? "Only the current holder at the active stage can edit" : undefined}
              onClick={() => navigate(`/records/${id}/edit`)}
            >
              Edit record
            </button>
            {!showEdit && !r.is_locked ? (
              <p style={{ marginTop: 8, fontSize: "0.82rem", opacity: 0.8 }}>
                Editing requires you to be the holder when your role matches stage {r.current_stage}.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {fwdOpen ? (
        <ForwardModal
          recordId={id}
          nextStageName={nextStageName(r.current_stage)}
          currentStage={r.current_stage}
          onClose={() => setFwdOpen(false)}
        />
      ) : null}
      {retOpen ? (
        <ReturnModal
          recordId={id}
          prevStageName={prevStageName(r.current_stage)}
          onClose={() => setRetOpen(false)}
        />
      ) : null}
      {vendorModal ? (
        <VendorContactModal
          onClose={() => setVendorModal(null)}
          detail={vendorModal.detail}
          vendorId={vendorModal.vendorId}
          fallbackName={vendorModal.fallbackName}
        />
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ color: "var(--clr-text-bright)" }}>{value}</div>
    </div>
  );
}

