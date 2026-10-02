"use client";

import { useEffect, useState } from "react";
import {
  browseDirectory,
  clearAndroidCache,
  clearIosCache,
  createMobileApp,
  deleteMobileApp,
  getMobileEmulators,
  openAndroidStudio,
  openXcode,
  runAndroidApp,
  runIosApp,
  type BrowseResult,
  type MobileApp,
  type MobileAppInput,
  type MobileCapabilities,
  type MobileDevtoolsActionResult,
  type MobileEmulators,
} from "@/lib/api";
import { Card, Pill, SectionHeader } from "@/components/ui";
import { IconChevronDown } from "@/components/icons";

type Busy = string | null;

// Two-click arm/confirm, same pattern as PipServerControl's DangerButton —
// clearing cache is recoverable (next build just re-populates it) but still
// shouldn't fire from a single stray click mid-build; removing an app is
// only a config-row delete (no project files touched) but still deserves
// the same guard against a stray click.
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

function ResultBanner({ result }: { result: MobileDevtoolsActionResult | null }) {
  if (!result) return null;
  return (
    <div
      className={`mt-3 rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap ${
        result.ok ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400"
      }`}
    >
      {result.output || (result.ok ? "OK" : "Failed")}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function Field({
  label,
  placeholder,
  value,
  onChange,
  onBrowse,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBrowse?: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
        {label}
        {onBrowse && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onBrowse();
            }}
            className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            Browse
          </button>
        )}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

// Custom server-side directory browser — NOT a native browser file picker.
// Browsers never expose an absolute filesystem path from a native picker
// (a deliberate cross-browser security restriction), which is exactly what
// these path fields need, so this instead renders a click-to-navigate list
// backed by the backend's read-only GET /mobile-devtools/browse.
//
// mode="folder" (Android Project Dir): any directory is a valid pick — a
// "Pilih folder ini" button commits whatever directory is currently open.
// mode="xcodeproj" (iOS Project Path): a .xcodeproj/.xcworkspace entry is a
// leaf — clicking it selects immediately instead of navigating in, since
// there's nothing useful inside a project bundle to browse into here.
function BrowseModal({
  title,
  mode,
  initialPath,
  onSelect,
  onClose,
}: {
  title: string;
  mode: "folder" | "xcodeproj";
  initialPath: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(path?: string) {
    setLoading(true);
    setError(null);
    try {
      setResult(await browseDirectory(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuka folder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(initialPath ?? undefined);
    // Only on mount — subsequent navigation goes through load() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-300">
            Tutup
          </button>
        </div>

        <div className="border-b border-white/[0.06] px-5 py-2.5">
          <p className="truncate text-xs text-slate-500" title={result?.path}>
            {result?.path ?? "…"}
          </p>
        </div>

        <div className="max-h-[45vh] overflow-y-auto px-2 py-2">
          {loading && <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>}
          {error && <p className="px-3 py-4 text-sm text-rose-400">{error}</p>}
          {!loading && !error && result && (
            <div className="space-y-0.5">
              {result.parent && (
                <button
                  type="button"
                  onClick={() => load(result.parent!)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/[0.04]"
                >
                  <IconChevronDown className="h-3.5 w-3.5 rotate-90" />
                  ..
                </button>
              )}
              {result.permission_denied ? (
                <p className="px-3 py-2 text-xs text-amber-400">
                  macOS memblokir akses ke folder ini (izin Documents/Desktop dsb belum diberikan). Buka System Settings &gt;
                  Privacy &amp; Security &gt; Files and Folders, lalu kasih akses ke aplikasi yang menjalankan backend ini
                  (Terminal/iTerm), atau navigasi lewat folder lain yang nggak diproteksi.
                </p>
              ) : (
                result.entries.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">Folder kosong.</p>
              )}
              {result.entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => {
                    if (mode === "xcodeproj" && entry.is_project_bundle) {
                      onSelect(entry.path);
                    } else {
                      load(entry.path);
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[0.04] ${
                    entry.is_project_bundle ? "text-indigo-400" : "text-slate-200"
                  }`}
                >
                  <span className="truncate">{entry.name}</span>
                  {entry.is_project_bundle ? (
                    <span className="shrink-0 text-xs font-medium text-indigo-400">Pilih</span>
                  ) : (
                    <IconChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-slate-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === "folder" && result && (
          <div className="border-t border-white/[0.06] px-5 py-3">
            <button
              type="button"
              onClick={() => onSelect(result.path)}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Pilih folder ini
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddAppForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (app: MobileApp) => void }) {
  const [name, setName] = useState("");
  const [androidProjectDir, setAndroidProjectDir] = useState("");
  const [androidApplicationId, setAndroidApplicationId] = useState("");
  const [androidLauncherActivity, setAndroidLauncherActivity] = useState("");
  const [iosProjectPath, setIosProjectPath] = useState("");
  const [iosScheme, setIosScheme] = useState("");
  const [iosBundleId, setIosBundleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState<"android" | "ios" | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Nama app wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: MobileAppInput = {
        name: name.trim(),
        android_project_dir: androidProjectDir.trim() || null,
        android_application_id: androidApplicationId.trim() || null,
        android_launcher_activity: androidLauncherActivity.trim() || null,
        ios_project_path: iosProjectPath.trim() || null,
        ios_scheme: iosScheme.trim() || null,
        ios_bundle_id: iosBundleId.trim() || null,
      };
      onCreated(await createMobileApp(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat app");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <h3 className="mb-1 text-sm font-semibold text-white">App Baru</h3>
      <p className="mb-4 text-xs text-slate-500">
        Isi salah satu (Android saja, iOS saja, atau dua-duanya) — kolom yang dikosongkan cuma bikin aksi platform itu
        nonaktif untuk app ini, bukan error.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}

      <div className="mb-4">
        <Field label="Nama App" placeholder="mis. Toko Sebelah" value={name} onChange={setName} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="Android Project Dir"
          placeholder="/path/ke/project (folder berisi gradlew)"
          value={androidProjectDir}
          onChange={setAndroidProjectDir}
          onBrowse={() => setBrowsing("android")}
        />
        <Field label="Android Application ID" placeholder="com.example.app" value={androidApplicationId} onChange={setAndroidApplicationId} />
        <Field
          label="Android Launcher Activity"
          placeholder="com.example.app/.MainActivity"
          value={androidLauncherActivity}
          onChange={setAndroidLauncherActivity}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="iOS Project Path"
          placeholder="/path/ke/App.xcodeproj"
          value={iosProjectPath}
          onChange={setIosProjectPath}
          onBrowse={() => setBrowsing("ios")}
        />
        <Field label="iOS Scheme" placeholder="App" value={iosScheme} onChange={setIosScheme} />
        <Field label="iOS Bundle ID" placeholder="com.example.app" value={iosBundleId} onChange={setIosBundleId} />
      </div>

      {browsing === "android" && (
        <BrowseModal
          title="Pilih Android Project Dir"
          mode="folder"
          initialPath={androidProjectDir || null}
          onSelect={(p) => {
            setAndroidProjectDir(p);
            setBrowsing(null);
          }}
          onClose={() => setBrowsing(null)}
        />
      )}
      {browsing === "ios" && (
        <BrowseModal
          title="Pilih iOS Project (.xcodeproj/.xcworkspace)"
          mode="xcodeproj"
          // If re-opening after already picking a bundle, start from its
          // parent dir — a .xcodeproj/.xcworkspace is itself a directory
          // (macOS bundle), so browsing "into" it would just list its
          // internal files, not something a user would want to navigate.
          initialPath={
            iosProjectPath && /\.(xcodeproj|xcworkspace)$/.test(iosProjectPath)
              ? iosProjectPath.slice(0, iosProjectPath.lastIndexOf("/"))
              : iosProjectPath || null
          }
          onSelect={(p) => {
            setIosProjectPath(p);
            setBrowsing(null);
          }}
          onClose={() => setBrowsing(null)}
        />
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          Batal
        </button>
      </div>
    </Card>
  );
}

function AppDevtools({
  app,
  capabilities,
  onRemove,
}: {
  app: MobileApp;
  capabilities: MobileCapabilities;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<MobileDevtoolsActionResult | null>(null);
  const [removing, setRemoving] = useState(false);

  const [emulators, setEmulators] = useState<MobileEmulators | null>(null);
  const [emulatorsLoaded, setEmulatorsLoaded] = useState(false);

  async function run(key: string, fn: () => Promise<MobileDevtoolsActionResult>) {
    setBusy(key);
    setError(null);
    try {
      setLastAction(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed: ${key}`);
      setLastAction(null);
    } finally {
      setBusy(null);
    }
  }

  async function refreshEmulators() {
    setBusy("emulators");
    setError(null);
    try {
      setEmulators(await getMobileEmulators());
      setEmulatorsLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list emulators");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteMobileApp(app.id);
      onRemove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus app");
      setRemoving(false);
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{app.name}</h3>
        <DangerButton label="Remove App" armedLabel="Yakin? Klik lagi" disabled={busy !== null || removing} onConfirm={handleRemove} />
      </div>
      <p className="mb-4 text-xs text-slate-500">
        {app.android_project_dir ? (
          <>
            Android: <code className="text-slate-400">{app.android_project_dir}</code>
          </>
        ) : (
          "Android: belum dikonfigurasi"
        )}
        {" · "}
        {app.ios_project_path ? (
          <>
            iOS: <code className="text-slate-400">{app.ios_project_path}</code>
          </>
        ) : (
          "iOS: belum dikonfigurasi"
        )}
        . Build/run bisa makan waktu beberapa menit — tombol akan disabled sampai selesai.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("open-xcode", () => openXcode(app.id))}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === "open-xcode" ? "Membuka…" : "Open Xcode"}
        </button>
        {capabilities.android_studio_installed && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("open-android-studio", () => openAndroidStudio(app.id))}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === "open-android-studio" ? "Membuka…" : "Open Android Studio"}
          </button>
        )}
      </div>

      <div className="mb-5 rounded-xl border border-white/[0.06] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-200">Emulators &amp; Simulators</h4>
          <button
            type="button"
            disabled={busy !== null}
            onClick={refreshEmulators}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
          >
            {busy === "emulators" ? "Loading…" : emulatorsLoaded ? "Refresh" : "List emulators yang bisa di-build"}
          </button>
        </div>

        {!emulatorsLoaded && <p className="text-xs text-slate-500">Klik tombol di atas untuk lihat AVD Android dan simulator iOS yang tersedia.</p>}

        {emulatorsLoaded && emulators && (
          <div className="space-y-4">
            {capabilities.android_sdk_available ? (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Android AVDs</div>
                {emulators.android_avds.length === 0 ? (
                  <p className="text-xs text-slate-500">Tidak ada AVD terdaftar (`emulator -list-avds`).</p>
                ) : (
                  <div className="space-y-1.5">
                    {emulators.android_avds.map((avd) => (
                      <div key={avd} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5">
                        <span className="text-sm text-slate-200">{avd}</span>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run(`run-android:${avd}`, () => runAndroidApp(app.id, { avd }))}
                          className="rounded-md bg-emerald-600/90 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {busy === `run-android:${avd}` ? "Running…" : "Run"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {emulators.android_devices.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {emulators.android_devices.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5">
                        <span className="flex items-center gap-2 text-sm text-slate-200">
                          {d.id}
                          <Pill tone={d.state === "device" ? "positive" : "neutral"}>{d.state}</Pill>
                        </span>
                        <button
                          type="button"
                          disabled={busy !== null || d.state !== "device"}
                          onClick={() => run(`run-android-device:${d.id}`, () => runAndroidApp(app.id, { serial: d.id }))}
                          className="rounded-md bg-emerald-600/90 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {busy === `run-android-device:${d.id}` ? "Running…" : "Run"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Android AVDs</div>
                <p className="text-xs text-slate-500">
                  Android SDK tidak terdeteksi di <code className="text-slate-400">{"~/Library/Android/sdk"}</code> — AVD list
                  disembunyikan. Install lewat Android Studio &gt; SDK Manager dulu.
                </p>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">iOS Simulators</div>
              {emulators.ios_simulators.length === 0 ? (
                <p className="text-xs text-slate-500">Tidak ada simulator ditemukan (`xcrun simctl list devices`).</p>
              ) : (
                <div className="space-y-1.5">
                  {emulators.ios_simulators.map((sim) => (
                    <div key={sim.udid} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5">
                      <span className="flex items-center gap-2 text-sm text-slate-200">
                        {sim.name}
                        <Pill tone={sim.state === "Booted" ? "positive" : "neutral"}>{sim.state}</Pill>
                      </span>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => run(`run-ios:${sim.udid}`, () => runIosApp(app.id, sim.udid))}
                        className="rounded-md bg-emerald-600/90 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {busy === `run-ios:${sim.udid}` ? "Running…" : "Run"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.06] p-4">
        <h4 className="mb-3 text-sm font-medium text-slate-200">Clear Cache</h4>
        <div className="flex flex-wrap gap-3">
          <DangerButton
            label="Clear Android Cache"
            armedLabel="Yakin? Klik lagi"
            disabled={busy !== null}
            onConfirm={() => run("clear-cache-android", () => clearAndroidCache(app.id))}
          />
          <DangerButton
            label="Clear iOS Cache"
            armedLabel="Yakin? Klik lagi"
            disabled={busy !== null}
            onConfirm={() => run("clear-cache-ios", () => clearIosCache(app.id))}
          />
        </div>
      </div>

      <ResultBanner result={lastAction} />
    </Card>
  );
}

export function MobileAppsPanel({
  initialApps,
  capabilities,
}: {
  initialApps: MobileApp[];
  capabilities: MobileCapabilities;
}) {
  const [apps, setApps] = useState<MobileApp[]>(initialApps);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader title="Apps" />
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            + Add App
          </button>
        )}
      </div>

      {adding && (
        <AddAppForm
          onCancel={() => setAdding(false)}
          onCreated={(app) => {
            setApps((prev) => [...prev, app]);
            setAdding(false);
          }}
        />
      )}

      {apps.length === 0 && !adding && (
        <p className="text-sm text-slate-500">Belum ada app terdaftar — klik &quot;+ Add App&quot; di atas.</p>
      )}

      <div className="space-y-6">
        {apps.map((app) => (
          <AppDevtools
            key={app.id}
            app={app}
            capabilities={capabilities}
            onRemove={() => setApps((prev) => prev.filter((a) => a.id !== app.id))}
          />
        ))}
      </div>
    </div>
  );
}
