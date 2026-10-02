"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FeatureAdoption } from "@/lib/api";

// Independent adoption rates, not parts of a whole — magnitude comparison,
// so one sequential hue (not a categorical palette) per dataviz skill guidance.
const BAR_COLOR = "#2a78d6";

function renderPercentLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props;
  return (
    <text x={x + width + 8} y={y + height / 2} dy={4} fill="#cbd5e1" fontSize={12}>
      {`${(value * 100).toFixed(1)}%`}
    </text>
  );
}

export function FeatureAdoptionChart({ data }: { data: FeatureAdoption[] }) {
  const chartData = [...data].sort((a, b) => a.percentage - b.percentage);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44)}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 8, right: 56, bottom: 8, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="feature"
          width={120}
          tick={{ fill: "#e2e8f0", fontSize: 13 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, _name, props) => [
            `${Number(value).toLocaleString()} requests (${(props.payload.percentage * 100).toFixed(1)}%)`,
            props.payload.feature,
          ]}
          contentStyle={{ borderRadius: 8, background: "#1e293b", borderColor: "rgba(255,255,255,0.08)", fontSize: 13, color: "#e2e8f0" }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Bar dataKey="requests" barSize={20} radius={[0, 4, 4, 0]} fill={BAR_COLOR} label={renderPercentLabel} />
      </BarChart>
    </ResponsiveContainer>
  );
}
