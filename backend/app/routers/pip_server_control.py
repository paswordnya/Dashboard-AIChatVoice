"""Settings page server-control panel — shells out to bpjs-pending-bot-local's
`pipctl.sh` (a separate project, same machine — see this repo's CLAUDE.md)
to start/stop/restart the merged bot+Pip backend process.

Only safe to do from THIS process specifically: this backend (port 8010) is
a completely separate process from the one pipctl.sh manages (bpjs-pending-
bot-local's main.py, port 8000/8001) — a "restart" endpoint living inside
the process being restarted would kill itself mid-request before it could
ever respond. Every action here is a FIXED argv array (["pipctl.sh",
"start"|"stop"|"restart"|"status"]); the only value that flows from a
request body into the subprocess is `port`, passed via the `env` dict
(never shell-interpolated), and validated as a real TCP port number first —
so there's no command-injection surface despite this endpoint running
arbitrary-looking shell commands.

No auth layer added here, matching every other endpoint on this backend
(see CLAUDE.md: local single-user dev tool, not internet-exposed) — but
unlike a CRUD mistake, clicking the wrong button here takes down the actual
Telegram bot and Pip's voice backend for everyone using them, so the
frontend is expected to confirm before calling stop/restart, not just fire
on click.
"""

import os
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter(prefix="/pip-server", tags=["pip-server"])

PIPCTL = str(Path(settings.pipctl_dir) / "pipctl.sh")


class ActionResult(BaseModel):
    ok: bool
    output: str


class StartRequest(BaseModel):
    port: Optional[int] = Field(default=None, ge=1, le=65535)


def _run(args: list[str], env: Optional[dict] = None, timeout: int = 30) -> ActionResult:
    try:
        proc = subprocess.run(
            args, cwd=settings.pipctl_dir, capture_output=True, text=True, timeout=timeout, env=env,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"pipctl.sh not found at {PIPCTL} — check PIPCTL_DIR") from exc
    except subprocess.TimeoutExpired as exc:
        partial = (exc.stdout or "") + (exc.stderr or "")
        return ActionResult(ok=False, output=f"Timed out after {timeout}s.\n{partial}".strip())

    output = ((proc.stdout or "") + (proc.stderr or "")).strip()
    return ActionResult(ok=proc.returncode == 0, output=output)


@router.get("/status", response_model=ActionResult)
def status() -> ActionResult:
    return _run([PIPCTL, "status"])


@router.post("/start", response_model=ActionResult)
def start(payload: StartRequest = StartRequest()) -> ActionResult:
    env = os.environ.copy()
    if payload.port is not None:
        env["PORT"] = str(payload.port)
    return _run([PIPCTL, "start"], env=env)


@router.post("/stop", response_model=ActionResult)
def stop() -> ActionResult:
    # cmd_stop in pipctl.sh waits up to 5s for graceful SIGTERM shutdown
    # before escalating to SIGKILL — give the subprocess call enough room
    # for that plus process-launch overhead.
    return _run([PIPCTL, "stop"], timeout=15)


@router.post("/restart", response_model=ActionResult)
def restart() -> ActionResult:
    # restart = stop (up to ~6s) + start (~1-2s) — see pipctl.sh's cmd_restart.
    return _run([PIPCTL, "restart"], timeout=30)


@router.get("/logs", response_model=ActionResult)
def logs(lines: int = 150) -> ActionResult:
    log_path = Path(settings.pipctl_dir) / "logs" / "server.log"
    if not log_path.exists():
        return ActionResult(ok=True, output="(belum ada log — server belum pernah di-start lewat pipctl.sh)")
    with log_path.open("r", errors="replace") as f:
        content = f.readlines()
    return ActionResult(ok=True, output="".join(content[-max(1, min(lines, 2000)):]))
