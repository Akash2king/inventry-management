import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";
import { formatDate, formatQty, diffDays } from "@/utils/formatters.js";
import { StatusBadge } from "@/components/records/StatusBadge.jsx";
import { ForwardModal } from "@/components/workflow/ForwardModal.jsx";
import { ReturnModal } from "@/components/workflow/ReturnModal.jsx";
import { nextStageName, prevStageName } from "@/utils/stageLabels.js";
import { stageForRole } from "@/utils/permissions.js";
import { StageAckBanner } from "@/components/workflow/StageAckBanner.jsx";
import { CorrectionBadge } from "@/components/records/CorrectionBadge.jsx";

export function WorkflowQueue() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === "storeman") return <StorManQueue />;
  if (role === "treatment") return <TreatmentQueue />;
  if (role === "admin") return <AdminQueue />;
  if (role === "manager") return <ManagerQueue />;
  if (role === "gm" || role === "superadmin") return <GMQueue />;
  return (
    <div className="card">
      <p>Queue view is not mapped for role: {role || "unknown"}</p>
    </div>
  );
}

function QueueShell({ title, forwardLabel, returnLabel, showReturn }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const myStage = stageForRole(user?.role) ?? 1;
  const fetchQueue = useWorkflowStore((s) => s.fetchQueue);
  const queue = useWorkflowStore((s) => s.queue);
  const isLoading = useWorkflowStore((s) => s.isLoading);
  const [fwd, setFwd] = useState(null);
  const [ret, setRet] = useState(null);

  useEffect(() => {
    fetchQueue().catch(() => {});
  }, [fetchQueue]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchQueue().catch(() => {});
    }, 20000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchQueue().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchQueue]);

  return (
    <div>
      <h2 style={{ color: "var(--clr-text-bright)", marginTop: 0 }}>{title}</h2>
      <StageAckBanner user={user} />
      {isLoading ? (
        <div className="fullscreen-center" style={{ minHeight: 120 }}>
          <div className="spinner" />
        </div>
      ) : null}
      {!isLoading && queue.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          Your queue is clear
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {queue.map((r) => {
          const days = r.days_elapsed != null ? r.days_elapsed : diffDays(r.entry_date);
          return (
            <div key={r.id} className="card">
              <div
                role="presentation"
                onClick={() => navigate(`/records/${r.id}`)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ fontWeight: 700, color: "var(--clr-text-bright)" }}>
                  {r.record_number}
                  {r.needs_workflow_correction ? <CorrectionBadge /> : null}
                </div>
                {r.needs_workflow_correction && r.pending_return_feedback ? (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      marginTop: 6,
                      padding: "0.45rem 0.55rem",
                      background: "rgba(255, 232, 160, 0.35)",
                      borderRadius: 6,
                      border: "1px solid rgba(201, 162, 39, 0.45)",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Fix requested:</strong> {r.pending_return_feedback}
                  </div>
                ) : null}
                <div>{r.vendor_name}</div>
                <div style={{ fontSize: "0.9rem", marginTop: 6 }}>
                  {formatQty(r.quantity, r.unit)} · Entry {formatDate(r.entry_date)} · {days} days
                </div>
                <div style={{ marginTop: 6 }}>
                  <StatusBadge level={r.alert_level} />
                  <span style={{ marginLeft: 8, fontSize: "0.85rem" }}>
                    Due {formatDate(r.due_date)}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="button" className="btn btn-primary" onClick={() => setFwd(r)}>
                  {forwardLabel}
                </button>
                {showReturn ? (
                  <button type="button" className="btn btn-danger" onClick={() => setRet(r)}>
                    {returnLabel}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {fwd ? (
        <ForwardModal
          recordId={fwd.id}
          nextStageName={nextStageName(myStage)}
          currentStage={myStage}
          onClose={() => {
            setFwd(null);
            fetchQueue().catch(() => {});
          }}
        />
      ) : null}
      {ret ? (
        <ReturnModal
          recordId={ret.id}
          prevStageName={prevStageName(myStage)}
          onClose={() => {
            setRet(null);
            fetchQueue().catch(() => {});
          }}
        />
      ) : null}
    </div>
  );
}

function StorManQueue() {
  return (
    <QueueShell
      title="Stock Entry Queue"
      forwardLabel="Forward"
      returnLabel="Return"
      showReturn={false}
    />
  );
}

function TreatmentQueue() {
  return (
    <QueueShell
      title="Treatment Verification Queue"
      forwardLabel="Verify & Forward ->"
      returnLabel="<- Return to Store Man"
      showReturn
    />
  );
}

function AdminQueue() {
  return (
    <QueueShell
      title="Admin Validation Queue"
      forwardLabel="Validate & Forward ->"
      returnLabel="<- Return to Treatment"
      showReturn
    />
  );
}

function ManagerQueue() {
  return (
    <QueueShell
      title="Manager Approval Queue"
      forwardLabel="Approve -> GM"
      returnLabel="<- Return to Admin"
      showReturn
    />
  );
}

function GMQueue() {
  return (
    <QueueShell
      title="Final Approval Queue"
      forwardLabel="Final Approve"
      returnLabel="<- Return to Manager"
      showReturn
    />
  );
}
