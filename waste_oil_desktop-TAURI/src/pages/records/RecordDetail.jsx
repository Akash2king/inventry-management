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
import { RecordEntryPhoto } from "@/components/records/RecordEntryPhoto.jsx";

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
  const canSeeHoldingTimeline = user?.role === "manager" || user?.role === "gm";

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

      <div style={{ marginTop: "1rem" }}>
        <WorkflowTimeline record={r} transitions={transitions} horizontal />
      </div>

      <div className="card record-detail-card" style={{ marginTop: "1rem" }}>
        <div className="record-detail-hero">
          <div>
            <p className="record-detail-hero__eyebrow">Record overview</p>
            <h3 className="record-detail-hero__title">{r.record_number}</h3>
          </div>
          <div className="record-detail-hero__right">
            <div className="record-detail-actions-inline">
              {showFwd ? (
                <button type="button" className="btn btn-primary" onClick={() => setFwdOpen(true)}>
                  Forward
                </button>
              ) : null}
              {showRet ? (
                <button type="button" className="btn btn-danger" onClick={() => setRetOpen(true)}>
                  Return
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!showEdit}
                title={!showEdit ? "Only the current holder at the active stage can edit" : undefined}
                onClick={() => navigate(`/records/${id}/edit`)}
              >
                Edit record
              </button>
            </div>
          </div>
        </div>

        <Section title="Material details">
          <div className="record-material-layout">
            <div className="grid-form record-detail-grid">
              <div className="field">
                <label>Vendor</label>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                  <span className="field-value">{r.vendor?.name ?? r.vendor_name ?? "—"}</span>
                </div>
              </div>
              <Field label="Product description" value={r.product_description || "—"} />
              <Field label="Product type" value={r.product_type || "—"} />
              <Field label="Packaging" value={r.packaging || "—"} />
              <Field label="Quantity" value={formatQty(r.quantity, r.unit)} />
              <Field label="Driver name" value={r.driver_name || "—"} />
              <Field label="Vehicle details" value={r.vehicle_details || "—"} />
              <div className="field record-detail-span-full">
                <label>Remarks</label>
                <div className="field-value">{r.remarks || "—"}</div>
              </div>
            </div>
            <div className="record-material-status-col">
              <div className="record-detail-hero__chips">
                <div className="record-chip">
                  <span className="record-chip__label">Stage</span>
                  <span className="record-chip__value">{r.current_stage}</span>
                </div>
                <div className="record-chip">
                  <span className="record-chip__label">Alert</span>
                  <span className="record-chip__value"><StatusBadge level={effectiveAlert} /></span>
                </div>
                <div className="record-chip">
                  <span className="record-chip__label">Locked</span>
                  <span className="record-chip__value">{r.is_locked ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Entry evidence">
          <div className="grid-form record-detail-grid record-evidence-grid">
            {r.photo_path ? (
              <div className="field record-evidence-card">
                <label>Entry photo</label>
                <RecordEntryPhoto
                  recordId={r.id}
                  variant="detail"
                  enablePreviewModal
                  downloadBaseName={r.record_number}
                />
              </div>
            ) : (
              <Field label="Entry photo" value="No photo uploaded" />
            )}
            <div className="field record-evidence-card record-evidence-summary">
              <label>SLA and ownership</label>
              <div className="record-evidence-summary__grid">
                <div>
                  <span className="record-evidence-summary__k">Entry date</span>
                  <span className="record-evidence-summary__v">{formatDate(r.entry_date)}</span>
                </div>
                <div>
                  <span className="record-evidence-summary__k">Due date</span>
                  <span className="record-evidence-summary__v">{formatDate(r.due_date)}</span>
                </div>
                <div>
                  <span className="record-evidence-summary__k">SLA window</span>
                  <span className="record-evidence-summary__v">
                    {slaTotal != null
                      ? `${slaTotal} day${slaTotal === 1 ? "" : "s"} (entry → due)`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="record-evidence-summary__k">Days since entry</span>
                  <span className="record-evidence-summary__v">
                    {typeof daysSinceEntry === "number" ? String(daysSinceEntry) : "—"}
                  </span>
                </div>
                <div>
                  <span className="record-evidence-summary__k">Current holder</span>
                  <span className="record-evidence-summary__v">{holderLabel}</span>
                </div>
                <div>
                  <span className="record-evidence-summary__k">Department</span>
                  <span className="record-evidence-summary__v">{r.current_department_name || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {canSeeHoldingTimeline && Array.isArray(r.holder_time_log) && r.holder_time_log.length > 0 ? (
          <Section title="Holding timeline (automatic)">
            <p className="record-detail-help">
              For the first holder, <strong>in</strong> uses the record <strong>entry date</strong> (calendar day,
              not clock time from creation). Later holders use the receive time from each forward/return.{" "}
              <strong>Out</strong> is set automatically when they forward or return.
            </p>
            <div className="record-holding-table-wrap">
              <table className="record-holding-table">
                <thead>
                  <tr>
                    <th>Holder</th>
                    <th>Username</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Hold time</th>
                    <th>Released via</th>
                  </tr>
                </thead>
                <tbody>
                  {r.holder_time_log.map((row, idx) => (
                    <tr key={`${row.holder_username || "na"}-${idx}`}>
                      <td>
                        <span className="record-detail-holding-name">
                          {row.holder_name || row.holder_username || "Unassigned"}
                        </span>
                      </td>
                      <td>{row.holder_username ? `@${row.holder_username}` : "—"}</td>
                      <td>{row.time_in ? formatDate(row.time_in) : "—"}</td>
                      <td>{row.time_out ? formatDate(row.time_out) : "still holding"}</td>
                      <td>{row.duration_display ?? "—"}</td>
                      <td>
                        {row.released_via === "forward"
                          ? "Forward"
                          : row.released_via === "return"
                            ? "Return"
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}
      </div>

      {!showFwd && !showRet ? (
        <div className="record-readonly-hint" style={{ marginTop: "1rem" }} role="status">
          {r.is_locked
            ? "This record is completed and locked."
            : holderIsViewer
              ? "No forward/return from this stage, or your role does not match the current stage."
              : `Only the current holder (${holderLabel}) can forward or return.`}
        </div>
      ) : null}
      {!showEdit && !r.is_locked ? (
        <div className="record-readonly-hint" style={{ marginTop: "0.6rem" }} role="status">
          Editing requires you to be the holder when your role matches stage {r.current_stage}.
        </div>
      ) : null}

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
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-value">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="record-detail-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

