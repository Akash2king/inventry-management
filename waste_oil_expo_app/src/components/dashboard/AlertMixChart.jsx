import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chartTooltip } from "./chartTheme.js";

const COLORS = {
  green: "#36d27e",
  yellow: "#ffcf5a",
  red: "#ff5f7a",
  completed: "#4f86ff",
};

export function AlertMixChart({ data, total, onSegmentClick, activeLevel }) {
  const rows = Object.entries(data).map(([level, count]) => ({
    level,
    name: level,
    count,
    fill: COLORS[level] || "#94a3b8",
  }));

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            {...chartTooltip}
            formatter={(value, name) => [
              `${value} (${total ? Math.round((value / total) * 100) : 0}%)`,
              String(name),
            ]}
          />
          <Pie
            data={rows}
            dataKey="count"
            nameKey="level"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
            stroke="var(--clr-surface)"
            strokeWidth={activeLevel ? 2 : 1}
          >
            {rows.map((entry) => (
              <Cell
                key={entry.level}
                fill={entry.fill}
                opacity={activeLevel && activeLevel !== entry.level ? 0.35 : 1}
                style={{ cursor: onSegmentClick ? "pointer" : "default" }}
                onClick={() => onSegmentClick?.(entry.level)}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
