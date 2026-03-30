import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chartTooltip } from "./chartTheme.js";

const STAGE_LABELS = {
  1: "Storeman",
  2: "Treatment",
  3: "Manager",
  4: "Admin",
  5: "GM",
};

const COLORS = ["#6ec8ff", "#4a90e2", "#7dd8ff", "#3578e5", "#ff9e58"];

export function StageDistributionCard({ data, loading, hint, onStageClick, activeStage, footer }) {
  if (loading) {
    return (
      <div className="card" style={{ padding: "2rem", textAlign: "center", minHeight: 280 }}>
        <div style={{ opacity: 0.6 }}>Loading chart…</div>
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

  const pieData = data.map((item, i) => ({
    name: STAGE_LABELS[item.current_stage] || `Stage ${item.current_stage}`,
    value: item.count ?? 0,
    stage: item.current_stage,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="card">
      <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: hint ? "0.35rem" : "0.5rem" }}>
        Records by Role
      </div>
      {hint ? (
        <div style={{ fontSize: "0.78rem", opacity: 0.75, marginBottom: "0.65rem", fontWeight: 500, lineHeight: 1.4 }}>
          {hint}
        </div>
      ) : null}
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={88}
              paddingAngle={2}
              stroke="var(--clr-surface)"
              strokeWidth={2}
            >
              {pieData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={entry.fill}
                  opacity={
                    activeStage != null && Number(activeStage) !== Number(entry.stage) ? 0.35 : 1
                  }
                  style={{ cursor: onStageClick ? "pointer" : "default" }}
                  onClick={() => onStageClick?.(entry.stage)}
                />
              ))}
            </Pie>
            <Tooltip {...chartTooltip} formatter={(value, name) => [`${value} records`, name]} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: "0.72rem", paddingTop: 4 }}
              formatter={(value) => value}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {footer ? (
        <div
          style={{
            marginTop: "0.75rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--clr-border)",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
