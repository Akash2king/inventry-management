export const KPI_VARIANTS = {
  total: {
    gradient: "linear-gradient(135deg, rgba(110, 200, 255, 0.22) 0%, rgba(74, 144, 226, 0.12) 100%)",
    border: "rgba(110, 200, 255, 0.45)",
    accent: "#2b6cb0",
  },
  queue: {
    gradient: "linear-gradient(135deg, rgba(147, 112, 219, 0.18) 0%, rgba(99, 102, 241, 0.1) 100%)",
    border: "rgba(147, 112, 219, 0.4)",
    accent: "#5b21b6",
  },
  active: {
    gradient: "linear-gradient(135deg, rgba(34, 197, 94, 0.16) 0%, rgba(16, 185, 129, 0.08) 100%)",
    border: "rgba(34, 197, 94, 0.4)",
    accent: "#0d7a4a",
  },
  overdue: {
    gradient: "linear-gradient(135deg, rgba(248, 113, 113, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)",
    border: "rgba(239, 68, 68, 0.45)",
    accent: "#c62828",
  },
  completion: {
    gradient: "linear-gradient(135deg, rgba(96, 165, 250, 0.18) 0%, rgba(59, 130, 246, 0.1) 100%)",
    border: "rgba(59, 130, 246, 0.4)",
    accent: "#1d4ed8",
  },
};

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.hint] Short explanation of what the metric means
 * @param {import('react').ReactNode} props.value
 * @param {string} [props.subtext] Extra context (counts, formulas)
 * @param {() => void} [props.onClick]
 * @param {keyof typeof KPI_VARIANTS} [props.variant]
 * @param {import('react').CSSProperties} [props.style]
 */
export function KPICard({ label, hint, value, subtext, onClick, variant = "total", style }) {
  const v = KPI_VARIANTS[variant] || KPI_VARIANTS.total;
  const interactive = typeof onClick === "function";

  const baseStyle = {
    padding: "1.15rem 1.25rem",
    borderRadius: "12px",
    background: v.gradient,
    border: `1px solid ${v.border}`,
    cursor: interactive ? "pointer" : "default",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    textAlign: "left",
    width: "100%",
    font: "inherit",
    color: "inherit",
    ...style,
  };

  const aria =
    interactive &&
    [label, hint, subtext, "Open list."]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={
        interactive ? "dashboard-kpi dashboard-kpi--interactive" : "dashboard-kpi dashboard-kpi--static"
      }
      style={baseStyle}
      aria-label={interactive ? aria : undefined}
    >
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--clr-text)",
          opacity: 0.72,
          marginBottom: hint ? "0.35rem" : "0.45rem",
        }}
      >
        {label}
      </div>
      {hint ? (
        <p className="dashboard-kpi__hint" style={{ margin: "0 0 0.55rem" }}>
          {hint}
        </p>
      ) : null}
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          lineHeight: 1.1,
          color: "var(--clr-text-bright)",
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value ?? "—"}
      </div>
      {subtext && (
        <div
          style={{
            fontSize: "0.75rem",
            marginTop: "0.5rem",
            opacity: 0.72,
            lineHeight: 1.35,
          }}
        >
          {subtext}
        </div>
      )}
      {interactive && (
        <div
          style={{
            marginTop: "0.65rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: v.accent,
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          View list
          <span aria-hidden style={{ fontSize: "0.85em" }}>
            →
          </span>
        </div>
      )}
    </div>
  );
}
