"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimelinePoint } from "@/lib/api";

function formatBucketLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function TopicTimelineChart({ data }: { data: TimelinePoint[] }) {
  if (data.length === 0) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-500">No topic activity yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="topicTimelineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="bucket"
          tickFormatter={formatBucketLabel}
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
        <Tooltip
          labelFormatter={(value) => formatBucketLabel(String(value))}
          formatter={(value) => [`${Number(value).toLocaleString()} requests`, "Topic activity"]}
          contentStyle={{ borderRadius: 8, background: "#1e293b", borderColor: "rgba(255,255,255,0.08)", fontSize: 13, color: "#e2e8f0" }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Area type="monotone" dataKey="requests" stroke="#2a78d6" strokeWidth={2} fill="url(#topicTimelineFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
