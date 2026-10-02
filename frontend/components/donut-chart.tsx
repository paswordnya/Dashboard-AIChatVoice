"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

// Renders selectively: only slices with a comfortable share get an inline
// label (per dataviz skill — never a number crammed on every sliver).
// Percentage only, not the name — entity names here (model IDs) can run
// long ("gemini-2.5-flash-native-audio-latest"), which clipped off the
// left edge of the chart when included inline; the legend below already
// maps color -> full name, so the inline label only needs the number.
function renderSliceLabel(props: { percent?: number }) {
  const { percent = 0 } = props;
  return percent >= 0.06 ? `${(percent * 100).toFixed(0)}%` : "";
}

export function DonutChart({ data }: { data: DonutSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="45%"
          innerRadius={65}
          outerRadius={100}
          paddingAngle={2}
          label={renderSliceLabel}
          labelLine={false}
        >
          {data.map((slice) => (
            <Cell key={slice.key} fill={slice.color} stroke="#1e293b" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, props) => [
            `${Number(value).toLocaleString()} requests (${((Number(value) / total) * 100).toFixed(1)}%)`,
            props.payload.label,
          ]}
          contentStyle={{ borderRadius: 8, background: "#1e293b", borderColor: "rgba(255,255,255,0.08)", fontSize: 13, color: "#e2e8f0" }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Legend verticalAlign="bottom" height={64} wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
