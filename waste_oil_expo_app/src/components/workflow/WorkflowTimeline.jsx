import { useMemo } from "react";
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

/** Labels for the ≤3 peer window rows (chronological order). */
function peerSlotLabels(rows, record) {
  const n = rows.length;
  if (n === 0) return [];
  if (n === 1) return ["Current"];
  const cur = record?.current_department_id != null ? String(record.current_department_id) : null;
  if (n === 2) {
    const second = rows[1];
    const secondTo = second?.to_department_id != null ? String(second.to_department_id) : null;
    if (cur && secondTo === cur) return ["Before", "Current"];
    return ["Current", "Next"];
  }
  return ["Before", "Current", "Next"];
}

function FixedStepperTimeline({ record, rows, horizontal }) {
  const current = record && record.current_stage != null ? record.current_stage : 1;
  const locked = !!(record && record.is_locked);

  return (
    <div className={`stepper${horizontal ? " stepper--horizontal" : ""}`}>
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
        const nodeCls = `step-node step-node--${state}`;
        const isLast = i === STAGE_LABELS.length - 1;
        return (
          <div key={label} className={`step-flow-item${horizontal ? " step-flow-item--horizontal" : ""}`}>
            <div className={nodeCls}>
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
            {horizontal && !isLast ? (
              <div className={`step-connector step-connector--${state}`} aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PeerWindowTimeline({ record, rows, horizontal }) {
  const labels = useMemo(() => peerSlotLabels(rows, record), [rows, record]);

  return (
    <div className={`workflow-peer-window${horizontal ? " workflow-peer-window--horizontal" : ""}`}>
      {rows.length === 0 ? (
        <p className="workflow-peer-empty">No workflow steps yet for this record.</p>
      ) : (
        rows.map((t, i) => (
          <div key={t.id || i} className="workflow-peer-slot">
            <div className="workflow-peer-slot__label">{labels[i] || "Step"}</div>
            <div className="workflow-peer-slot__card">
              <div className="workflow-peer-slot__dept">
                {(t.from_department_name || "—") + " → " + (t.to_department_name || "—")}
              </div>
              <div className="workflow-peer-slot__meta">
                {actorName(t)} · {formatDate(t.timestamp)} · {actionLabel(t)}
                {t.note ? ` · ${t.note}` : ""}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function splitOversightSteps(transitions) {
  const idx = transitions.findIndex((t) => (t.to_department_layer || "") === "oversight");
  if (idx === -1) {
    return { pipeline: transitions, oversight: [] };
  }
  return {
    pipeline: transitions.slice(0, idx),
    oversight: transitions.slice(idx),
  };
}

function TransitionChain({ transitions, variant }) {
  return (
    <div className={`workflow-graph-chain workflow-graph-chain--${variant}`}>
      {transitions.map((t) => (
        <div key={t.id} className="workflow-graph-step">
          <div className="workflow-graph-nodes">
            <span className="workflow-graph-pill workflow-graph-pill--from" title="From department">
              {t.from_department_name || "—"}
            </span>
            <span
              className={`workflow-graph-arrow workflow-graph-arrow--${t.transition_type || "forward"}`}
              title={actionLabel(t)}
            >
              {t.transition_type === "return" ? "↩" : "→"}
            </span>
            <span className="workflow-graph-pill workflow-graph-pill--to" title="To department">
              {t.to_department_name || "—"}
            </span>
          </div>
          <div className="workflow-graph-meta">
            Stage {t.from_stage}→{t.to_stage} · {actorName(t)} · {formatDate(t.timestamp)} · {actionLabel(t)}
            {t.note ? ` · ${t.note}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function FullGraphTimeline({ transitions, horizontal }) {
  const { pipeline, oversight } = useMemo(() => splitOversightSteps(transitions), [transitions]);
  const flowNodes = useMemo(() => {
    if (!transitions.length) return [];
    const nodes = [];
    const first = transitions[0];
    nodes.push({
      key: `from-${first.id}`,
      name: first.from_department_name || "—",
      layer: first.from_department_layer || "peer",
    });
    transitions.forEach((t) => {
      nodes.push({
        key: `to-${t.id}`,
        name: t.to_department_name || "—",
        layer: t.to_department_layer || "peer",
      });
    });
    return nodes;
  }, [transitions]);

  if (!transitions.length) {
    return <p className="workflow-graph-empty">No transitions yet. The record will show each hop here.</p>;
  }

  return (
    <div className={`workflow-graph${horizontal ? " workflow-graph--horizontal" : ""}`}>
      <p className="workflow-graph-hint">
        Graph flow through departments. Manager/GM routing appears in the highlighted oversight band.
      </p>
      <div className="workflow-flow-row" role="img" aria-label="Department flow graph">
        {flowNodes.map((n, i) => (
          <div key={n.key} className="workflow-flow-node-wrap">
            <div className={`workflow-flow-node workflow-flow-node--${n.layer}`}>
              {n.name}
            </div>
            {i < flowNodes.length - 1 ? <div className="workflow-flow-edge" aria-hidden>→</div> : null}
          </div>
        ))}
      </div>
      {pipeline.length > 0 ? <TransitionChain transitions={pipeline} variant="pipeline" /> : null}
      {oversight.length > 0 ? (
        <div className="workflow-graph-oversight" role="region" aria-label="Manager and GM">
          <div className="workflow-graph-oversight__title">Manager / GM band</div>
          <TransitionChain transitions={oversight} variant="oversight" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} [props.record] — includes stage_transitions and stage_transitions_view from API
 * @param {object[]} [props.transitions] — fallback if record.stage_transitions missing
 * @param {boolean} [props.horizontal]
 */
export function WorkflowTimeline({ record, transitions, horizontal = false }) {
  const rows =
    (record && record.stage_transitions && record.stage_transitions.length
      ? record.stage_transitions
      : transitions) || [];
  const viewMode = record?.stage_transitions_view ?? "full";

  if (viewMode !== "full") {
    return null;
  }

  const body =
    rows.length > 0 ? (
      <FullGraphTimeline transitions={rows} horizontal={horizontal} />
    ) : (
      <FixedStepperTimeline record={record} rows={rows} horizontal={horizontal} />
    );

  return (
    <div className="card workflow-card">
      <h3 style={{ marginTop: 0, marginBottom: "0.35rem", color: "var(--clr-text-bright)" }}>Workflow</h3>
      <p className="workflow-card__hint">Track stage movement and handoffs across departments.</p>
      {body}
    </div>
  );
}
