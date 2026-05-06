/**
 * Labels for numeric `current_stage` (1–5) from API.
 * Aligns with `ROLE_STAGE` in `permissions.js` and backend pipeline stages.
 */
export const STAGE_LABELS = {
  1: "Storeman",
  2: "Treatment",
  3: "Admin",
  4: "Manager",
  5: "GM",
};

export const LOOKBACK_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
  { label: "All", value: 0 },
];
