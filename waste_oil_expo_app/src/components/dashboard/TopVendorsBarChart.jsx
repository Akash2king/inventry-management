import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartAxisTick, chartGridStroke, chartTooltip } from "./chartTheme.js";

const BAR = "#6ec8ff";

export function TopVendorsBarChart({ rows, unitLabel, onBarClick }) {
  const data = rows.map((v) => ({
    ...v,
    label: v.name.length > 22 ? `${v.name.slice(0, 20)}…` : v.name,
  }));

  const chartHeight = Math.min(320, Math.max(160, 24 + rows.length * 52));

  return (
    <div style={{ width: "100%", height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 16, left: 4, bottom: 36 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} strokeOpacity={0.5} horizontal={false} />
          <XAxis
            type="number"
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
            tickMargin={8}
            tickFormatter={(v) => (Number(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={chartAxisTick}
            tickLine={false}
            axisLine={{ stroke: chartGridStroke }}
            tickMargin={4}
          />
          <Tooltip
            {...chartTooltip}
            formatter={(value, _n, props) => [
              `${Number(value).toFixed(1)} ${unitLabel === "all" ? "qty" : unitLabel} · ${props.payload.count} record(s)`,
              props.payload.name,
            ]}
          />
          <Bar dataKey="quantity" name="Volume" radius={[0, 4, 4, 0]} cursor={onBarClick ? "pointer" : "default"}>
            {data.map((row, i) => (
              <Cell
                key={rows[i].vendor_id || rows[i].name || i}
                fill={BAR}
                onClick={() => onBarClick?.(row)}
                style={{ cursor: onBarClick ? "pointer" : "default" }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
