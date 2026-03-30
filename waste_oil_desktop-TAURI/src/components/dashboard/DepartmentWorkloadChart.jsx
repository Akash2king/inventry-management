import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartAxisTick, chartGridStroke, chartTooltip } from "./chartTheme.js";

export function DepartmentWorkloadChart({ departments }) {
  const data = departments.map((d) => ({
    ...d,
    short:
      d.name.length > 16
        ? `${d.name.slice(0, 14)}…`
        : d.name,
  }));

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="short"
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
            interval={0}
            angle={-22}
            textAnchor="end"
            height={56}
          />
          <YAxis
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            {...chartTooltip}
            formatter={(value, name) => [value, name]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
          />
          <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: 8 }} />
          <Bar dataKey="active" name="Active" stackId="w" fill="#ff9e58" radius={[0, 0, 0, 0]} />
          <Bar dataKey="completed" name="Completed" stackId="w" fill="#4f86ff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
