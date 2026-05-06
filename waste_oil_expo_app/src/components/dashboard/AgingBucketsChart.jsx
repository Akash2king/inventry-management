import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartAxisTick, chartGridStroke, chartTooltip } from "./chartTheme.js";

const BUCKET_COLORS = {
  "0-7": "#60c8ff",
  "8-15": "#ffcf5a",
  "16-30": "#ff9e58",
  "30+": "#ff5f7a",
};

export function AgingBucketsChart({ buckets, maxCount }) {
  const data = Object.entries(buckets).map(([key, count]) => ({
    key,
    label: `${key} days`,
    count,
  }));
  const max = Math.max(1, maxCount);

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="label"
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
          />
          <YAxis
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
            width={28}
            allowDecimals={false}
            domain={[0, max]}
          />
          <Tooltip {...chartTooltip} formatter={(value) => [value, "Open records"]} />
          <Bar dataKey="count" name="Records" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={BUCKET_COLORS[entry.key] || "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
