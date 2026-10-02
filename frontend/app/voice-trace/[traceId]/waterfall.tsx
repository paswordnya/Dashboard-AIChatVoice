"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WaterfallRow } from "./trace-shaping";
import { fmtMs, statusColor } from "../format";

// First Gantt/waterfall-style chart in this codebase — the standard
// stacked-bar technique: an invisible "offset" bar (fill=transparent)
// positions each category row's start on a shared ms-since-trace-start
// axis, followed by a visible "duration" bar sized to how long that
// component actually took. Chrome DevTools' network waterfall uses the
// same idea (per-request offset + duration bars on one timeline).

function WaterfallTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row: WaterfallRow = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-slate-800 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <div className="mb-1 font-semibold text-white">{row.category}</div>
      {row.status === "no-data" ? (
        <div className="text-slate-500">No data for this component.</div>
      ) : (
        <>
          <div className="text-slate-400">
            {Math.round(row.offsetMs)}ms → {Math.round(row.offsetMs + row.durationMs)}ms ({fmtMs(row.durationMs)})
          </div>
          <div className="mt-1.5 space-y-0.5">
            {row.spans.map((s) => (
              <div key={s.stage} className="flex items-center justify-between gap-4">
                <span className="text-slate-300">{s.label}</span>
                <span className="text-slate-500">
                  {s.provider ? `${s.provider}${s.model ? `/${s.model}` : ""} · ` : ""}
                  {fmtMs(s.durationMs)}
                  {s.status === "error" ? " · error" : s.status === "skipped" ? " · fallback" : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WaterfallChart({ data }: { data: WaterfallRow[] }) {
  const hasAnyData = data.some((row) => row.status !== "no-data");
  if (!hasAnyData) {
    return <div className="flex h-48 items-center justify-center text-sm text-slate-500">No pipeline stages recorded for this trace.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          type="number"
          tickFormatter={(v) => fmtMs(v)}
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          width={140}
          tick={{ fill: "#e2e8f0", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="offsetMs" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="durationMs" stackId="w" isAnimationActive={false} radius={[3, 3, 3, 3]} minPointSize={2}>
          {data.map((row, i) => (
            <Cell key={row.category} fill={statusColor(row.status)} opacity={i % 2 === 0 ? 1 : 0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
