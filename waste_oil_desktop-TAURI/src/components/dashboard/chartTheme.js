/** Shared Recharts styling aligned with app CSS variables */
export const chartTooltip = {
  contentStyle: {
    background: "var(--clr-surface)",
    border: "1px solid var(--clr-border)",
    borderRadius: "8px",
    fontSize: "0.82rem",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
  },
  labelStyle: { color: "var(--clr-text-bright)", fontWeight: 600 },
  itemStyle: { color: "var(--clr-text)" },
};

export const chartAxisTick = { fill: "var(--clr-text)", fontSize: 11 };
export const chartGridStroke = "var(--clr-border)";
