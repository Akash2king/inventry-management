export function KPICard({ label, value, subtext, onClick, style }) {
  const baseStyle = {
    padding: "1.25rem",
    borderRadius: "0.5rem",
    background: "var(--clr-surface)",
    border: "1px solid var(--clr-border)",
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.2s ease",
    ...style,
  };

  const hoverStyle = onClick
    ? {
        transform: "translateY(-2px)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      }
    : {};

  return (
    <div
      onClick={onClick}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (onClick) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <div style={{ fontSize: "0.85rem", opacity: 0.75, marginBottom: "0.5rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--clr-text-bright)" }}>
        {value ?? "—"}
      </div>
      {subtext && (
        <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", opacity: 0.65 }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
