"use client";

import { useState } from "react";
import {
  getPipServerLogs,
  getPipServerStatus,
  restartPipServer,
  startPipServer,
  stopPipServer,
  type PipServerActionResult,
} from "@/lib/api";
import { Card, Pill } from "@/components/ui";

const inputClass =
  "rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

type Busy = "start" | "stop" | "restart" | "status" | "logs" | null;

function isRunning(status: PipServerActionResult | null): boolean | null {
  if (!status) return null;
  return /^Jalan/.test(status.output);
}

// Two-click arm/confirm for the destructive actions — this takes down the
// live Telegram bot AND Pip's voice backend for everyone using it, so a
// single accidental click must not be enough to fire it.
function DangerButton({
  label,
  armedLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  armedLabel: string;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const [armed, setArmed] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
        }
      }}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
        armed ? "bg-rose-600 text-white hover:bg-rose-700" : "border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
      }`}
    >
      {armed ? armedLabel : label}
    </button>
  );
}

export function PipServerControl({ initialStatus }: { initialStatus: PipServerActionResult }) {
  const [status, setStatus] = useState<PipServerActionResult | null>(initialStatus);
  const [lastAction, setLastAction] = useState<PipServerActionResult | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [port, setPort] = useState("");
  const [logs, setLogs] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  async function refreshStatus() {
    setBusy("status");
    setError(null);
    try {
      setStatus(await getPipServerStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch status");
    } finally {
      setBusy(null);
    }
  }

  async function handleStart() {
    setBusy("start");
    setError(null);
    try {
      const parsedPort = port.trim() ? Number(port) : undefined;
      if (parsedPort !== undefined && (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535)) {
        throw new Error("Port harus angka 1-65535");
      }
      setLastAction(await startPipServer(parsedPort));
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setBusy(null);
    }
  }

  async function handleStop() {
    setBusy("stop");
    setError(null);
    try {
      setLastAction(await stopPipServer());
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to stop");
    } finally {
      setBusy(null);
    }
  }

  async function handleRestart() {
    setBusy("restart");
    setError(null);
    try {
      setLastAction(await restartPipServer());
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restart");
    } finally {
      setBusy(null);
    }
  }

  async function fetchLogs() {
    setBusy("logs");
    try {
      setLogs((await getPipServerLogs(150)).output);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch logs");
    } finally {
      setBusy(null);
    }
  }

  function handleToggleLogs() {
    if (logsOpen) {
      setLogsOpen(false);
      return;
    }
    setLogsOpen(true);
    void fetchLogs();
  }

  const running = isRunning(status);

  return (
    <Card>
      <div className="mb-1 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-white">Server (bot Telegram + voice Pip)</h3>
        {running === true && <Pill tone="positive">Jalan</Pill>}
        {running === false && <Pill tone="negative">Tidak jalan</Pill>}
        {running === null && <Pill tone="neutral">?</Pill>}
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Satu proses (`pipctl.sh`) melayani bot Telegram DAN backend voice Pip sekaligus — stop/restart di sini mematikan
        keduanya, bukan cuma salah satu.{" "}
        <span className="text-slate-400">
          Dashboard ini (yang lagi kamu buka sekarang) proses terpisah — <strong>tidak ikut mati</strong> walau server di bawah ini di-stop.
        </span>
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}

      {status && <div className="mb-4 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-300">{status.output}</div>}

      {lastAction && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap ${
            lastAction.ok ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400"
          }`}
        >
          {lastAction.output}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Port (opsional, buat Start)</label>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="default pipctl.sh (8000)"
            className={`mt-1 w-48 ${inputClass}`}
          />
        </div>
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleStart}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === "start" ? "Starting…" : "Start"}
        </button>
        <DangerButton label="Stop" armedLabel="Yakin? Klik lagi" disabled={busy !== null} onConfirm={handleStop} />
        <DangerButton label="Restart" armedLabel="Yakin? Klik lagi" disabled={busy !== null} onConfirm={handleRestart} />
        <button
          type="button"
          disabled={busy !== null}
          onClick={refreshStatus}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {busy === "status" ? "Checking…" : "Refresh Status"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleToggleLogs}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {logsOpen ? "Sembunyikan Logs" : busy === "logs" ? "Loading…" : "Lihat Logs"}
        </button>
      </div>

      {logsOpen && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">150 baris terakhir — logs/server.log</span>
            <button type="button" onClick={fetchLogs} className="text-xs text-indigo-400 hover:underline">
              Refresh
            </button>
          </div>
          <pre className="max-h-96 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-xs text-slate-300">
            {logs ?? "Loading…"}
          </pre>
        </div>
      )}
    </Card>
  );
}
