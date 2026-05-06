import { STAGE_LABELS } from "@/utils/stageLabels.js";

export function StageAckBanner({ user }) {
  const stage = user?.department_stage_order;
  if (stage == null || stage < 1 || stage > 5) {
    return (
      <div className="stage-ack stage-ack-muted">
        No pipeline stage assigned to your account. Contact the GM to link you to a department.
      </div>
    );
  }
  const label = STAGE_LABELS[stage - 1] || `Stage ${stage}`;
  return (
    <div className="stage-ack">
      <strong>Your queue</strong> shows records at <strong>stage {stage}</strong> —{" "}
      <strong>{label}</strong>. When a record is forwarded here, it appears automatically
      (this screen refreshes every 20 seconds, or when you return to this tab).
    </div>
  );
}
