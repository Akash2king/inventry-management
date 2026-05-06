import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartAxisTick, chartGridStroke, chartTooltip } from "./chartTheme.js";

export function EntryTrendChart({ data, lookbackDays, trendMax }) {
  const max = Math.max(1, trendMax);

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="entryTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7dd8ff" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#3578e5" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} strokeOpacity={0.6} vertical={false} />
          <XAxis
            dataKey="date"
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
            tickFormatter={(v) => (typeof v === "string" && v.length >= 10 ? v.slice(5, 10) : v)}
            interval={data.length > 20 ? Math.floor(data.length / 12) : "preserveStartEnd"}
            minTickGap={8}
          />
          <YAxis
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
            width={32}
            allowDecimals={false}
            domain={[0, max]}
          />
          <Tooltip
            {...chartTooltip}
            formatter={(value) => [value, "Records"]}
            labelFormatter={(label) => `Entry date: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Entries"
            stroke="#3578e5"
            strokeWidth={2}
            fill="url(#entryTrendFill)"
            dot={{ r: 2, fill: "#3578e5" }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", opacity: 0.7 }}>
        Last {lookbackDays || "all"} days by entry date
      </div>
    </div>
  );
}
