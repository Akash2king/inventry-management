export function StageDistributionCard({ data, loading, hint }) {
  if (loading) {
    return (
      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ opacity: 0.6 }}>Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ opacity: 0.6 }}>No data available</div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count || 0));
  const stages = {
    1: "Storeman",
    2: "Treatment",
    3: "Manager",
    4: "Admin",
    5: "GM",
  };

  return (
    <div className="card">
      <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: hint ? "0.35rem" : "1rem" }}>
        Records by Role
      </div>
      {hint ? (
        <div style={{ fontSize: "0.78rem", opacity: 0.75, marginBottom: "0.85rem", fontWeight: 500, lineHeight: 1.4 }}>
          {hint}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", height: "150px" }}>
        {data.map((item) => {
          const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <div
              key={item.current_stage}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${percentage}%`,
                  background: "linear-gradient(180deg, #6ec8ff, #4a90e2)",
                  borderRadius: "4px 4px 0 0",
                  minHeight: "10px",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                title={`${stages[item.current_stage]}: ${item.count}`}
              />
              <div style={{ fontSize: "0.65rem", marginTop: "0.5rem", opacity: 0.7 }}>
                {stages[item.current_stage]?.substring(0, 3)}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>{item.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
