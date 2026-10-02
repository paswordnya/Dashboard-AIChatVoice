#!/bin/bash
# start/stop/restart pip-voice-ai-dashboard frontend only (:3000). Backend
# (uvicorn :8010) is assumed to already be running on its own and is never
# touched here — the frontend still needs it up to actually show data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/.run"
FRONTEND_PORT=3000

mkdir -p "$LOG_DIR"

pids_on_port() { lsof -ti ":$1" 2>/dev/null || true; }

stop_port() {
  local port="$1" name="$2"
  local pids
  pids=$(pids_on_port "$port")
  if [ -n "$pids" ]; then
    echo "stopping $name (port $port, pid $pids)"
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(pids_on_port "$port")
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  else
    echo "$name not running (port $port)"
  fi
}

start_dashboard() {
  if [ -n "$(pids_on_port "$FRONTEND_PORT")" ]; then
    echo "frontend already running on $FRONTEND_PORT"
  else
    echo "starting frontend on $FRONTEND_PORT..."
    (cd "$ROOT/frontend" && nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 < /dev/null &)
  fi

  sleep 3
  # -m 5: Next.js cold start can take a while to answer the first request
  # (on-demand compile) — cap the check so a slow-but-fine startup can't
  # make this script (and the Telegram command driving it) hang.
  curl -s -m 5 -o /dev/null -w "frontend http %{http_code} - http://localhost:$FRONTEND_PORT\n" "http://localhost:$FRONTEND_PORT" \
    || echo "frontend not responding yet (still starting up, check again in a few seconds)"
}

stop_dashboard() {
  stop_port "$FRONTEND_PORT" "frontend"
}

case "${1:-}" in
  start)   start_dashboard ;;
  stop)    stop_dashboard ;;
  restart) stop_dashboard; sleep 1; start_dashboard ;;
  *) echo "usage: dashboard.sh {start|stop|restart}"; exit 1 ;;
esac
