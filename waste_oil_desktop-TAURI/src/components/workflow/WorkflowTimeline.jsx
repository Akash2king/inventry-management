import { formatDate } from "@/utils/formatters.js";
import { STAGE_LABELS } from "@/utils/stageLabels.js";

function actionLabel(t) {
  if (t.transition_type === "return") return "Returned";
  if (t.to_stage === 5 && t.from_stage === 5) return "Final approval";
  return "Forwarded";
}

function actorName(t) {
  const name = (t.transitioned_by_name || "").trim();
  const un = (t.transitioned_by_username || "").trim();
  if (name && un && name !== un) {
    return `${name} (@${un})`;
  }
  if (name) return name;
  if (un) return `@${un}`;
  if (t.transitioned_by_id) {
    return `User ${String(t.transitioned_by_id).slice(0, 8)}…`;
  }
  return "—";
}

export function WorkflowTimeline({ record, transitions }) {
  const rows =
    (record && record.stage_transitions && record.stage_transitions.length
      ? record.stage_transitions
      : transitions) || [];
  const current = record && record.current_stage != null ? record.current_stage : 1;
  const locked = !!(record && record.is_locked);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, color: "var(--clr-text-bright)" }}>Workflow</h3>
      <div className="stepper">
        {STAGE_LABELS.map((label, i) => {
          const stageNum = i + 1;
          let state = "future";
          if (stageNum < current || (locked && stageNum <= 5)) {
            state = "done";
          } else if (stageNum === current && !locked) {
            state = "current";
          }
          let iconCls = "step-icon future";
          if (state === "done") iconCls = "step-icon done";
          if (state === "current") iconCls = "step-icon current";
          const icon = state === "done" ? "✓" : state === "current" ? "●" : "○";
          const last = [...rows].reverse().find((t) => t.to_stage === stageNum);
          return (
            <div key={label} className="step-node">
              <div className={iconCls}>{icon}</div>
              <div className="step-body">
                <div className="step-title">
                  {stageNum}. {label}
                </div>
                {last ? (
                  <div className="step-meta">
                    {actorName(last)} · {formatDate(last.timestamp)} · {actionLabel(last)}
                    {last.note ? ` · ${last.note}` : ""}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
