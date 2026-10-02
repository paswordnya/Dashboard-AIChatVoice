# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An AI analytics & model observability dashboard for **pip Voice AI** — the
voice assistant pipeline (Turn Manager, Fast Response Layer, AI Router,
streaming STT→LLM→TTS) designed in
`../reference/prd/PRD_TDD_pip_Voice_AI.md.pdf` ("PRD & TDD — pip Voice AI", v1.0,
14 Juli 2026). That PRD is still a design blueprint — its own roadmap
(§18.3, M1–M6) has not been implemented yet, so this dashboard currently has
no live system to read from. Build it against the request-metadata schema
below and seed/mock data until pip Voice AI's backend actually emits events.

Full dashboard spec (21 sections — Overview KPIs, Model Usage, Router
Analytics, Knowledge Source Analytics, Voice Analytics, etc.) lives in
`docs/dashboard-requirements.md`. Read it before touching any analytics
endpoint or chart — it defines what each metric means and which questions
("Success Metrics" at the end of each section) the dashboard must be able to
answer without opening raw logs.

## Why this exists / how it maps to the PRD

The dashboard's `request_id` metadata table (see "Request Metadata" in the
requirements doc) is the ingestion contract every pip Voice AI component
should eventually write to. Key mappings:

- `provider` / `model_used` ↔ PRD §14 Voice Routing (`AI Router`, config-driven
  routes: fast_response / gemini / openai / anthropic / ollama).
- `knowledge_source`, `*_hit` booleans ↔ this dashboard's own §13 Knowledge
  Source Analytics (Local DB, Memory, Cache, RAG, Grounding, Web Search, LLM
  Only) — not covered by the PRD itself, since the PRD is scoped to the voice
  turn-taking pipeline, not retrieval.
- `latency_ms` and friends ↔ PRD §15 Monitoring & Observability metrics (Turn
  Detection Time, VAD Time, First Token/Audio Latency, Interrupt Count, False
  End-of-Utterance, Voice RTT, Provider/Model Switch). The PRD recommends
  Prometheus + OpenTelemetry with p50/p95/p99 per metric — this dashboard is
  the product-facing view on top of that, not a replacement for it.

## Stack

- `backend/` — FastAPI, ingesting/serving the request-metadata table
  (Postgres; Timescale extension recommended once volume justifies it).
- `frontend/` — Next.js (App Router) + Recharts for the dashboard UI.

This is a fresh scaffold, not a working app yet — see README.md for current
status and next steps. No root-level build command spans backend and
frontend; run each separately.

## Relationship to the rest of the L-casemx workspace

This project is unrelated to the three BPJS pending-claim projects
(`bpjs-pending-bot-local/`, `excel/`, `telegram-ai-excel-assistant/`) — see
the workspace root `CLAUDE.md`. It shares nothing with them except living in
the same top-level directory — **with one deliberate exception**:
`frontend/app/bot-config/page.tsx` (nav label "Settings") renders
`bpjs-pending-bot-local`'s dashboard-config tables (`settings`/
`prompt_templates`/`ai_provider_routes`/`ai_providers`, see that project's
`schema.sql`), because the user asked for a single place to edit both
dashboards from. It works through `frontend/app/api/bot-config/[...path]/
route.ts`, a server-side proxy that injects HTTP Basic Auth
(`BOT_DASHBOARD_USER`/`BOT_DASHBOARD_PASSWORD` in `frontend/.env.local`,
never `NEXT_PUBLIC_`-prefixed) before forwarding to that bot's
`dashboard_api.py` on port 8000 (`BOT_API_URL`). No database is shared —
this frontend still reads all its own analytics from `pip_voice_ai_dashboard`
via its own `backend/` on port 8010; the bot-config page is the only thing
that talks to bpjs-pending-bot-local, and it does so over HTTP, not a
shared DB connection or shared Python/TS code.
