"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KnowledgeSourceShare } from "@/lib/api";

// Fixed hue per source (entity), not by rank — so the color of "Local Database"
// never changes if a filter shifts the sort order. Slots 1-7 of the validated
// categorical palette in fixed order (dataviz skill references/palette.md).
const SOURCE_COLORS: Record<string, string> = {
  local_db: "#2a78d6",
  memory: "#1baf7a",
  rag: "#eda100",
  cache: "#008300",
  web_search: "#4a3aa7",
  grounding: "#e34948",
  llm_only: "#e87ba4",
};

function renderPercentLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props;
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dy={4}
      fill="#cbd5e1"
      fontSize={12}
    >
      {`${(value * 100).toFixed(1)}%`}
    </text>
  );
}

export function KnowledgeSourceChart({ data }: { data: KnowledgeSourceShare[] }) {
  const chartData = [...data].sort((a, b) => a.requests - b.requests);

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
          dataKey="label"
          width={110}
          tick={{ fill: "#e2e8f0", fontSize: 13 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, _name, props) => [
            `${Number(value).toLocaleString()} requests (${(props.payload.percentage * 100).toFixed(1)}%)`,
            props.payload.label,
          ]}
          contentStyle={{ borderRadius: 8, background: "#1e293b", borderColor: "rgba(255,255,255,0.08)", fontSize: 13, color: "#e2e8f0" }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Bar dataKey="requests" barSize={20} radius={[0, 4, 4, 0]} label={renderPercentLabel}>
          {chartData.map((entry) => (
            <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] ?? "#898781"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
