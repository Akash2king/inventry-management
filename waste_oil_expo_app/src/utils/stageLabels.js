export const STAGE_LABELS = [
  "Stock Entry",
  "Treatment Verification",
  "Admin Validation",
  "Manager Approval",
  "GM Final Approval",
];

export function nextStageName(currentStage) {
  if (currentStage >= 5) return "Complete";
  return STAGE_LABELS[currentStage] ?? `Stage ${currentStage + 1}`;
}

export function prevStageName(currentStage) {
  if (currentStage <= 1) return "";
  return STAGE_LABELS[currentStage - 2] ?? `Stage ${currentStage - 1}`;
}
