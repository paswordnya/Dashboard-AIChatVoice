import { NextRequest, NextResponse } from "next/server";

// Server-side proxy to bpjs-pending-bot-local's dashboard_api.py (a
// separate, otherwise-unrelated project — see this project's CLAUDE.md
// for the one-off exception this creates). Runs only on the Next.js
// server, never in the browser, specifically so the bot dashboard's HTTP
// Basic Auth credentials (BOT_DASHBOARD_USER/PASSWORD below) never ship in
// client-side JS — the browser only ever talks to this same-origin route.
const BOT_API_URL = process.env.BOT_API_URL ?? "http://localhost:8000";
const BOT_DASHBOARD_USER = process.env.BOT_DASHBOARD_USER ?? "";
const BOT_DASHBOARD_PASSWORD = process.env.BOT_DASHBOARD_PASSWORD ?? "";

function authHeaders(): Record<string, string> {
  if (!BOT_DASHBOARD_USER || !BOT_DASHBOARD_PASSWORD) return {};
  const token = Buffer.from(`${BOT_DASHBOARD_USER}:${BOT_DASHBOARD_PASSWORD}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const url = `${BOT_API_URL}/api/dashboard/${path.map(encodeURIComponent).join("/")}`;
  const init: RequestInit = {
    method: request.method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    cache: "no-store",
  };
  if (request.method === "PATCH" || request.method === "POST") {
    init.body = await request.text();
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return NextResponse.json({ detail: `Tidak bisa menghubungi bot backend di ${BOT_API_URL}` }, { status: 502 });
  }

  const body = await res.text();
  return new NextResponse(body, { status: res.status, headers: { "Content-Type": "application/json" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path);
}
