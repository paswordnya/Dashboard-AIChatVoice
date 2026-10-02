"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ConfidenceBucket } from "@/lib/api";

// Ordered continuous domain (0-1 confidence) — sequential single hue,
// low buckets a lighter step, high buckets the full accent (magnitude job).
const LOW_COLOR = "#9ec5f4"; // step 200
const HIGH_COLOR = "#2a78d6"; // step 450, categorical slot 1

export function ConfidenceHistogram({ buckets }: { buckets: ConfidenceBucket[] }) {
  const data = buckets.map((b) => ({
    ...b,
    label: `${b.bucket_start.toFixed(1)}–${b.bucket_end.toFixed(1)}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
        <Tooltip
          formatter={(value) => [`${Number(value).toLocaleString()} requests`, "Requests"]}
          contentStyle={{ borderRadius: 8, background: "#1e293b", borderColor: "rgba(255,255,255,0.08)", fontSize: 13, color: "#e2e8f0" }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Bar dataKey="requests" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.bucket_start < 0.6 ? LOW_COLOR : HIGH_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
