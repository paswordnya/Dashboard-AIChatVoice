"""The "Pip Mobile App" page — local dev tooling for one or more native/KMP
mobile projects on this machine (their own Android project dir / iOS
.xcodeproj, bundle ids etc — see MobileDevtoolsApp in app/models.py). The
page starts seeded with a single 'pip' app (the pipvoice project); more are
added from the "+ Add App" form and persisted in the mobile_devtools_apps
table, not hardcoded here.

Same security posture as pip_server_control.py: every subprocess call is a
fixed argv list built from server-side config (an app row's own columns)
plus user input that is always validated first (an AVD/UDID must appear in
our own `/emulators` listing, an app_id must exist in the table) — nothing
is shell-interpolated, so there is no command-injection surface despite
this endpoint running `open`, `gradlew`, `xcodebuild`, and `xcrun simctl`.
No auth layer, matching every other endpoint on this backend (local
single-user dev tool, not internet-exposed).
"""

import json
import os
import re
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import MobileDevtoolsApp

router = APIRouter(prefix="/mobile-devtools", tags=["mobile-devtools"])

ADB = str(Path(settings.android_sdk_dir) / "platform-tools" / "adb")
EMULATOR_BIN = str(Path(settings.android_sdk_dir) / "emulator" / "emulator")
# macOS-only, matching every other assumption in this file (`open -a`,
# `xcodebuild`, `xcrun simctl`) — there's no cross-platform install location
# to check, and this backend already only targets macOS dev machines.
ANDROID_STUDIO_APP_PATH = "/Applications/Android Studio.app"


def _android_studio_installed() -> bool:
    return Path(ANDROID_STUDIO_APP_PATH).exists()


def _android_sdk_available() -> bool:
    """Both binaries, not just the SDK root dir — a partially-installed SDK
    (root dir exists but `emulator`/`platform-tools` components weren't
    installed via SDK Manager) should read as unavailable too, since that's
    exactly the state that makes _list_android_avds/_list_android_devices
    silently return an empty list today."""
    return Path(EMULATOR_BIN).exists() and Path(ADB).exists()

# Seeded into mobile_devtools_apps the first time the table is empty — see
# list_apps() below. Everything after that comes from the "+ Add App" form.
DEFAULT_PIP_APP = dict(
    id="pip",
    name="Pip Mobile App",
    android_project_dir=settings.pipvoice_dir,
    android_application_id="com.pip.app",
    android_launcher_activity="com.pip.app/.MainActivity",
    ios_project_path=str(Path(settings.pipvoice_dir) / "iosApp" / "Pip.xcodeproj"),
    ios_scheme="Pip",
    ios_bundle_id="com.pip.app.Pip",
)


class ActionResult(BaseModel):
    ok: bool
    output: str


def _run(args: list[str], cwd: Optional[str] = None, timeout: int = 30, env: Optional[dict] = None) -> ActionResult:
    try:
        proc = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"Command not found: {args[0]} ({exc})") from exc
    except subprocess.TimeoutExpired as exc:
        partial = (exc.stdout or "") + (exc.stderr or "")
        return ActionResult(ok=False, output=f"Timed out after {timeout}s.\n{partial}".strip())

    output = ((proc.stdout or "") + (proc.stderr or "")).strip()
    return ActionResult(ok=proc.returncode == 0, output=output)


# ------------------------------------------------------------------
# App registry — GET/POST/DELETE /mobile-devtools/apps
# ------------------------------------------------------------------


class MobileAppOut(BaseModel):
    id: str
    name: str
    android_project_dir: Optional[str] = None
    android_application_id: Optional[str] = None
    android_launcher_activity: Optional[str] = None
    ios_project_path: Optional[str] = None
    ios_scheme: Optional[str] = None
    ios_bundle_id: Optional[str] = None


class MobileAppCreate(BaseModel):
    name: str
    android_project_dir: Optional[str] = None
    android_application_id: Optional[str] = None
    android_launcher_activity: Optional[str] = None
    ios_project_path: Optional[str] = None
    ios_scheme: Optional[str] = None
    ios_bundle_id: Optional[str] = None


def _to_out(row: MobileDevtoolsApp) -> MobileAppOut:
    return MobileAppOut(
        id=row.id,
        name=row.name,
        android_project_dir=row.android_project_dir,
        android_application_id=row.android_application_id,
        android_launcher_activity=row.android_launcher_activity,
        ios_project_path=row.ios_project_path,
        ios_scheme=row.ios_scheme,
        ios_bundle_id=row.ios_bundle_id,
    )


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "app"


def _get_app(app_id: str, db: Session) -> MobileDevtoolsApp:
    row = db.get(MobileDevtoolsApp, app_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No app '{app_id}' configured.")
    return row


@router.get("/apps", response_model=list[MobileAppOut])
def list_apps(db: Session = Depends(get_db)) -> list[MobileAppOut]:
    if db.execute(select(MobileDevtoolsApp)).first() is None:
        db.add(MobileDevtoolsApp(**DEFAULT_PIP_APP, created_at=datetime.now(timezone.utc)))
        db.commit()
    rows = db.execute(select(MobileDevtoolsApp).order_by(MobileDevtoolsApp.created_at)).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("/apps", response_model=MobileAppOut, status_code=201)
def create_app(payload: MobileAppCreate, db: Session = Depends(get_db)) -> MobileAppOut:
    base_slug = _slugify(payload.name)
    slug = base_slug
    n = 2
    while db.get(MobileDevtoolsApp, slug) is not None:
        slug = f"{base_slug}-{n}"
        n += 1
    row = MobileDevtoolsApp(id=slug, created_at=datetime.now(timezone.utc), **payload.model_dump())
    db.add(row)
    db.commit()
    return _to_out(row)


@router.delete("/apps/{app_id}", status_code=204)
def delete_app(app_id: str, db: Session = Depends(get_db)) -> None:
    row = _get_app(app_id, db)
    db.delete(row)
    db.commit()


# ------------------------------------------------------------------
# Directory browser — backs the Add App form's "Browse" buttons.
#
# A native browser file/directory picker (<input type="file" webkitdirectory>
# or the File System Access API) can NEVER return an absolute filesystem
# path — browsers deliberately withhold that, in every browser, so a web
# page can't learn local filesystem structure. So "Browse" here isn't that:
# it's a custom, read-only, server-side directory listing (safe to add —
# this whole router already runs gradlew/xcodebuild/open with server-side
# paths per the module docstring's security posture; a read-only listdir is
# far less privileged than that) that the frontend renders as a click-to-
# navigate modal, filling the form field with a real absolute path.
# ------------------------------------------------------------------

# macOS "bundles" — directories that Finder/Xcode present as a single
# selectable item rather than something to open/navigate into. Only
# relevant for the iOS Project Path field (Android's gradlew directory is
# always a plain folder) — the frontend's browse modal, in "xcodeproj"
# mode, selects one of these immediately on click instead of listing its
# contents.
_PROJECT_BUNDLE_SUFFIXES = (".xcodeproj", ".xcworkspace")


class BrowseEntry(BaseModel):
    name: str
    path: str
    is_project_bundle: bool


class BrowseResult(BaseModel):
    path: str
    parent: Optional[str]
    entries: list[BrowseEntry]
    # True when this directory's contents couldn't be read because of an OS
    # permission error — macOS's TCC privacy protection blocks unentitled
    # processes from listing ~/Documents, ~/Desktop, ~/Downloads, etc. even
    # for the owning user. Without this flag, a blocked folder and a
    # genuinely empty one both produce `entries: []`, which reads to a user
    # as "this folder has nothing in it" when the real answer is "grant this
    # process access in System Settings > Privacy & Security".
    permission_denied: bool = False


@router.get("/browse", response_model=BrowseResult)
def browse(path: Optional[str] = None) -> BrowseResult:
    base = Path(path).expanduser() if path else Path.home()
    if not base.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {base}")
    base = base.resolve()

    permission_denied = False
    try:
        children = sorted(base.iterdir(), key=lambda p: p.name.lower())
    except PermissionError:
        children = []
        permission_denied = True

    entries = [
        BrowseEntry(name=child.name, path=str(child), is_project_bundle=child.name.endswith(_PROJECT_BUNDLE_SUFFIXES))
        for child in children
        # Only directories are ever navigable/selectable here — there's no
        # "pick a file" case (gradlew's directory and an .xcodeproj bundle
        # are both directories). Dotdirs (.git, .gradle, .venv, …) are
        # hidden — noise, never a real pick target.
        if child.is_dir() and not child.name.startswith(".")
    ]
    parent = str(base.parent) if base != base.parent else None
    return BrowseResult(path=str(base), parent=parent, entries=entries, permission_denied=permission_denied)


# ------------------------------------------------------------------
# Emulators / simulators — machine-wide, not tied to any one app
# ------------------------------------------------------------------


class MobileCapabilities(BaseModel):
    android_studio_installed: bool
    android_sdk_available: bool


@router.get("/capabilities", response_model=MobileCapabilities)
def capabilities() -> MobileCapabilities:
    """Machine-level tool detection (Android Studio.app, Android SDK
    binaries) — separate from EmulatorsResult below because it's a cheap
    Path.exists() check with no subprocess calls, meant to be fetched eagerly
    on page load so the frontend can hide/relabel Android-specific UI (the
    "Open Android Studio" button, the AVD list section) before the user ever
    clicks "List emulators", instead of only surfacing the gap as a
    generic OS error or a misleadingly-empty list after the fact."""
    return MobileCapabilities(
        android_studio_installed=_android_studio_installed(),
        android_sdk_available=_android_sdk_available(),
    )


class EmulatorsResult(BaseModel):
    android_avds: list[str]
    android_devices: list[dict]
    ios_simulators: list[dict]


def _list_android_avds() -> list[str]:
    try:
        proc = subprocess.run([EMULATOR_BIN, "-list-avds"], capture_output=True, text=True, timeout=15)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def _list_android_devices() -> list[dict]:
    try:
        proc = subprocess.run([ADB, "devices"], capture_output=True, text=True, timeout=15)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    devices = []
    for line in proc.stdout.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 2:
            devices.append({"id": parts[0], "state": parts[1]})
    return devices


def _list_ios_simulators() -> list[dict]:
    try:
        proc = subprocess.run(
            ["xcrun", "simctl", "list", "devices", "available", "-j"], capture_output=True, text=True, timeout=15,
        )
        data = json.loads(proc.stdout)
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return []
    sims = []
    for runtime, devices in data.get("devices", {}).items():
        for d in devices:
            sims.append({"udid": d.get("udid"), "name": d.get("name"), "state": d.get("state"), "runtime": runtime})
    return sims


@router.get("/emulators", response_model=EmulatorsResult)
def emulators() -> EmulatorsResult:
    return EmulatorsResult(
        android_avds=_list_android_avds(),
        android_devices=_list_android_devices(),
        ios_simulators=_list_ios_simulators(),
    )


# ------------------------------------------------------------------
# Per-app actions — everything below is scoped to one MobileDevtoolsApp row
# ------------------------------------------------------------------


@router.post("/apps/{app_id}/open-xcode", response_model=ActionResult)
def open_xcode(app_id: str, db: Session = Depends(get_db)) -> ActionResult:
    app = _get_app(app_id, db)
    if not app.ios_project_path:
        return ActionResult(ok=False, output=f"'{app.name}' has no iOS project path configured.")
    return _run(["open", "-a", "Xcode", app.ios_project_path])


@router.post("/apps/{app_id}/open-android-studio", response_model=ActionResult)
def open_android_studio(app_id: str, db: Session = Depends(get_db)) -> ActionResult:
    app = _get_app(app_id, db)
    if not app.android_project_dir:
        return ActionResult(ok=False, output=f"'{app.name}' has no Android project dir configured.")
    if not _android_studio_installed():
        return ActionResult(ok=False, output=f"Android Studio not found at {ANDROID_STUDIO_APP_PATH} — install it first.")
    # Plain `open -a "Android Studio" <dir>` only launches the app — it
    # doesn't reliably open that folder as a project, because (unlike
    # Xcode, which registers .xcodeproj as a document type) Android Studio
    # doesn't register plain folders through Launch Services the same way.
    # `-n --args <path>` instead passes the path straight through as a CLI
    # arg to the studio binary (same as running `studio <path>` yourself),
    # which Android Studio does honor — and if an instance is already
    # running, it just opens the project there instead of spawning a
    # second one.
    return _run(["open", "-na", "Android Studio", "--args", app.android_project_dir])


class RunAndroidRequest(BaseModel):
    avd: Optional[str] = None  # from GET /emulators android_avds — boot this AVD first if given
    serial: Optional[str] = None  # from GET /emulators android_devices — target this one directly, no boot needed


def _boot_avd_and_get_serial(avd: str) -> tuple[Optional[str], str]:
    """Boots `avd` and returns its adb serial once fully booted, or (None, error_message).

    Identifies the serial by diffing `adb devices` before/after launch —
    picking "whatever's connected" is wrong the moment more than one
    device/emulator is present.
    """
    before = {d["id"] for d in _list_android_devices()}
    subprocess.Popen(
        [EMULATOR_BIN, "-avd", avd, "-no-snapshot-save"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True,
    )

    deadline = time.time() + 120
    serial = None
    while time.time() < deadline:
        after = {d["id"] for d in _list_android_devices()}
        new_serials = after - before
        if new_serials:
            serial = next(iter(new_serials))
            break
        time.sleep(2)
    if not serial:
        return None, f"AVD '{avd}' didn't show up in `adb devices` within 120s."

    wait = _run([ADB, "-s", serial, "wait-for-device"], timeout=60)
    if not wait.ok:
        return None, f"AVD '{avd}' (serial {serial}) didn't come up in time.\n{wait.output}"

    deadline = time.time() + 90
    while time.time() < deadline:
        r = subprocess.run(
            [ADB, "-s", serial, "shell", "getprop", "sys.boot_completed"], capture_output=True, text=True, timeout=10,
        )
        if r.stdout.strip() == "1":
            return serial, ""
        time.sleep(2)
    return None, f"AVD '{avd}' (serial {serial}) booted but Android wasn't ready after 90s."


@router.post("/apps/{app_id}/run-android", response_model=ActionResult)
def run_android(app_id: str, payload: RunAndroidRequest = RunAndroidRequest(), db: Session = Depends(get_db)) -> ActionResult:
    app = _get_app(app_id, db)
    if not app.android_project_dir:
        return ActionResult(ok=False, output=f"'{app.name}' has no Android project dir configured.")
    if not app.android_launcher_activity:
        return ActionResult(
            ok=False, output=f"'{app.name}' has no Android launcher activity configured (e.g. com.example.app/.MainActivity)."
        )

    logs = []
    serial = payload.serial

    if payload.serial and not payload.avd and payload.serial not in {d["id"] for d in _list_android_devices()}:
        raise HTTPException(status_code=400, detail=f"Unknown device serial '{payload.serial}' — not in `adb devices`.")

    if payload.avd:
        if payload.avd not in _list_android_avds():
            raise HTTPException(status_code=400, detail=f"Unknown AVD '{payload.avd}' — not in `emulator -list-avds`.")
        serial, err = _boot_avd_and_get_serial(payload.avd)
        if not serial:
            return ActionResult(ok=False, output=err)
        logs.append(f"AVD '{payload.avd}' booted as {serial}.")

    if not serial:
        ready = [d for d in _list_android_devices() if d["state"] == "device"]
        if not ready:
            return ActionResult(ok=False, output="No Android device/emulator connected — boot an AVD or connect a device first.")
        if len(ready) > 1:
            ids = ", ".join(d["id"] for d in ready)
            return ActionResult(ok=False, output=f"Multiple devices connected ({ids}) — pick one from the list instead of Run-without-target.")
        serial = ready[0]["id"]

    gradlew = str(Path(app.android_project_dir) / "gradlew")

    # ANDROID_SERIAL pins the Android Gradle Plugin's installDebug task (which
    # shells out to adb internally) to this exact device — otherwise, with more
    # than one device/emulator around, it's ambiguous which one gets the install.
    env = os.environ.copy()
    env["ANDROID_SERIAL"] = serial
    build = _run([gradlew, "installDebug"], cwd=app.android_project_dir, timeout=300, env=env)
    logs.append(build.output)
    if not build.ok:
        return ActionResult(ok=False, output="\n".join(logs))

    launch = _run([ADB, "-s", serial, "shell", "am", "start", "-n", app.android_launcher_activity], timeout=30)
    logs.append(launch.output)
    return ActionResult(ok=launch.ok, output="\n".join(logs))


class RunIosRequest(BaseModel):
    udid: str  # from GET /emulators ios_simulators — required, no implicit "default" device


def _ios_derived_data_dir(app: MobileDevtoolsApp) -> str:
    """Deliberately NOT under the project directory — that's commonly
    inside ~/Documents (or another iCloud Drive / cloud-sync-managed
    folder), and every build writes fresh files there. The sync daemon
    tags each new file with File Provider extended attributes (observed:
    com.apple.provenance, com.apple.fileprovider.*) within seconds of
    creation, and `codesign` then rejects the tagged ones with "resource
    fork, Finder information, or similar detritus not allowed" — not a
    one-off, but a moving target that reappears on a different framework
    every single build, no matter how thoroughly the Pods source itself is
    cleaned first (confirmed directly: `brctl status` showed this project's
    own build/ subfolder queued for iCloud sync). Xcode's own default
    DerivedData location (~/Library/Developer/Xcode/DerivedData) exists
    for exactly this reason — ~/Library is never part of iCloud Drive's
    Desktop & Documents sync scope. Mirror that convention here instead of
    writing next to the project."""
    return str(Path.home() / "Library" / "Developer" / "Xcode" / "DerivedData" / f"pip-mobile-devtools-{app.id}")


def _ios_project_name(app: MobileDevtoolsApp) -> str:
    return Path(app.ios_project_path).stem  # e.g. "Pip" from "Pip.xcodeproj"


def _ios_xcodebuild_target_args(app: MobileDevtoolsApp) -> list[str]:
    """xcodebuild takes `-workspace <x>.xcworkspace` OR `-project <x>.xcodeproj`
    — never the other way around; passing a .xcworkspace to -project fails
    with "'X.xcworkspace' does not exist" even though the path is real. This
    field can hold either (the Add App form's Browse button, in xcodeproj
    mode, lets a user pick a .xcworkspace directly — the normal case for any
    CocoaPods-based project), so the flag has to be chosen per-app rather
    than hardcoded."""
    flag = "-workspace" if app.ios_project_path.endswith(".xcworkspace") else "-project"
    return [flag, app.ios_project_path]


def _find_built_ios_app(app: MobileDevtoolsApp) -> Optional[str]:
    candidate = Path(_ios_derived_data_dir(app)) / "Build" / "Products" / "Debug-iphonesimulator" / f"{_ios_project_name(app)}.app"
    return str(candidate) if candidate.exists() else None


@router.post("/apps/{app_id}/run-ios", response_model=ActionResult)
def run_ios(app_id: str, payload: RunIosRequest, db: Session = Depends(get_db)) -> ActionResult:
    app = _get_app(app_id, db)
    if not app.ios_project_path or not app.ios_scheme or not app.ios_bundle_id:
        return ActionResult(ok=False, output=f"'{app.name}' is missing iOS project path / scheme / bundle id configuration.")

    known_udids = {s["udid"] for s in _list_ios_simulators()}
    if payload.udid not in known_udids:
        raise HTTPException(status_code=400, detail=f"Unknown simulator UDID '{payload.udid}' — not in `simctl list devices`.")

    logs = []

    boot = subprocess.run(["xcrun", "simctl", "boot", payload.udid], capture_output=True, text=True, timeout=30)
    if boot.returncode != 0 and "Booted" not in (boot.stderr or ""):
        return ActionResult(ok=False, output=f"Failed to boot simulator: {boot.stderr}")
    subprocess.run(["open", "-a", "Simulator"], capture_output=True, text=True, timeout=15)

    derived_data = _ios_derived_data_dir(app)
    build = _run(
        [
            "xcodebuild", *_ios_xcodebuild_target_args(app), "-scheme", app.ios_scheme, "-configuration", "Debug",
            "-destination", f"id={payload.udid}", "-derivedDataPath", derived_data, "build",
        ],
        timeout=300,
    )
    logs.append(build.output)
    if not build.ok:
        return ActionResult(ok=False, output="\n".join(logs))

    app_path = _find_built_ios_app(app)
    if not app_path:
        logs.append(f"Build succeeded but couldn't find {_ios_project_name(app)}.app under DerivedData/Build/Products/Debug-iphonesimulator.")
        return ActionResult(ok=False, output="\n".join(logs))

    install = _run(["xcrun", "simctl", "install", payload.udid, app_path], timeout=60)
    logs.append(install.output)
    if not install.ok:
        return ActionResult(ok=False, output="\n".join(logs))

    launch = _run(["xcrun", "simctl", "launch", payload.udid, app.ios_bundle_id], timeout=30)
    logs.append(launch.output)
    return ActionResult(ok=launch.ok, output="\n".join(logs))


@router.post("/apps/{app_id}/clear-cache/android", response_model=ActionResult)
def clear_cache_android(app_id: str, db: Session = Depends(get_db)) -> ActionResult:
    app = _get_app(app_id, db)
    if not app.android_project_dir:
        return ActionResult(ok=False, output=f"'{app.name}' has no Android project dir configured.")
    gradlew = str(Path(app.android_project_dir) / "gradlew")
    return _run([gradlew, "clean"], cwd=app.android_project_dir, timeout=120)


@router.post("/apps/{app_id}/clear-cache/ios", response_model=ActionResult)
def clear_cache_ios(app_id: str, db: Session = Depends(get_db)) -> ActionResult:
    app = _get_app(app_id, db)
    if not app.ios_project_path:
        return ActionResult(ok=False, output=f"'{app.name}' has no iOS project path configured.")

    removed = []

    # Our own scripted builds (run-ios above) always write here — always safe to remove.
    scoped = Path(_ios_derived_data_dir(app))
    if scoped.exists():
        shutil.rmtree(scoped)
        removed.append(str(scoped))

    # Xcode's own DerivedData, populated when the project is built via the
    # Xcode GUI directly (the "Open Xcode" button). Scoped to this project's
    # "<ProjectName>-<hash>" naming — never a bare wildcard rm on the whole
    # DerivedData dir.
    xcode_derived = Path.home() / "Library" / "Developer" / "Xcode" / "DerivedData"
    if xcode_derived.exists():
        for entry in xcode_derived.glob(f"{_ios_project_name(app)}-*"):
            if entry.is_dir():
                shutil.rmtree(entry)
                removed.append(str(entry))

    if not removed:
        return ActionResult(ok=True, output="No DerivedData found to clear.")
    return ActionResult(ok=True, output="Cleared:\n" + "\n".join(removed))
