# pip Voice AI — Analytics Dashboard

Dashboard analitik dan observability untuk asisten **pip Voice AI**. Memantau
pemakaian model, routing, efektivitas sumber pengetahuan, latensi, dan kualitas
percakapan suara, baik untuk model lokal (LM Studio, Ollama) maupun cloud
(Gemini, OpenAI, Anthropic). Dashboard juga menjadi tempat mengelola registry
model, konfigurasi intent, server pip, dan tools pengembangan aplikasi mobile.

Daftar fitur dan alurnya ada di [`docs/FEATURES.md`](docs/FEATURES.md).
Spesifikasi lengkap metrik ada di
[`docs/dashboard-requirements.md`](docs/dashboard-requirements.md).

## Komponen

| Bagian | Teknologi | Port default |
|---|---|---|
| `backend/` | FastAPI, SQLAlchemy, Postgres | 8010 |
| `frontend/` | Next.js 15 (App Router), React 19, Recharts, Tailwind | 3000 |

Frontend memanggil backend lewat `NEXT_PUBLIC_API_URL`. Satu halaman
(Settings) juga memanggil dashboard API bot BPJS lewat proxy sisi server, lihat
bagian Integrasi.

## Menjalankan

Kebutuhan: Python 3.9+, Node.js 18+, dan Postgres yang sedang berjalan.

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Buat file `.env` di `backend/`:

```bash
DATABASE_URL=postgresql+psycopg2://<user>:<password>@localhost:5432/pip_voice_ai_dashboard
EVENTS_API_KEY=<secret acak>
MODEL_REGISTRY_ENCRYPTION_KEY=<kunci Fernet>
```

Buat nilai rahasianya:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"                              # EVENTS_API_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # MODEL_REGISTRY_ENCRYPTION_KEY
```

Simpan `MODEL_REGISTRY_ENCRYPTION_KEY` dengan aman. Bila hilang, API key model
yang sudah tersimpan tidak bisa didekripsi lagi.

Siapkan database lalu jalankan server:

```bash
createdb pip_voice_ai_dashboard           # sekali saja
python scripts/migrate.py                 # buat tabel yang belum ada
python scripts/seed.py                    # opsional: data mock untuk dev
python scripts/seed_model_registry.py     # isi registry model (tanpa API key)
uvicorn app.main:app --reload --port 8010
```

Cek: `curl http://localhost:8010/health` mengembalikan `{"status":"ok"}`.

### Frontend

Buat `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8010
```

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

`scripts/dashboard.sh` menjalankan, menghentikan, atau me-restart frontend saja
(port 3000). Backend tidak disentuh oleh skrip itu.

## Script database

Semua dijalankan dari `backend/`.

| Script | Fungsi | Catatan |
|---|---|---|
| `migrate.py` | Membuat tabel yang belum ada | Aman, tidak mengubah tabel yang sudah ada |
| `seed.py [--rows N] [--reset]` | Data mock `request_metadata` dan `user_directory` | `--reset` menghapus dan membuat ulang kedua tabel itu |
| `seed_model_registry.py` | Mengisi registry model | Idempoten, tanpa API key |
| `migrate_intent_config_chain.py` | Migrasi lama ke kolom `chain` (JSONB) | Sekali jalan, **menghapus kolom lama**. Hanya untuk database skema lama |
| `migrate_model_registry_health.py` | Menambah kolom `auto_deactivated_reason` | Hanya untuk database lama |

Urutan database baru: `migrate.py`, lalu `seed.py` (opsional), lalu
`seed_model_registry.py`. Dua skrip `migrate_*` tidak perlu dijalankan pada
database baru.

## Mengirim data nyata

`POST /events` dipakai aplikasi pip dan bot Telegram untuk melapor setiap
request. Wajib header `X-API-Key` yang sama dengan `EVENTS_API_KEY`.

```bash
curl -X POST http://localhost:8010/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $EVENTS_API_KEY" \
  -d '{"session_id": "s1", "model_used": "gemini-flash", "provider": "gemini", "knowledge_source": "llm_only", "latency_ms": 850}'
```

Hanya `session_id`, `model_used`, `provider`, `knowledge_source`, dan
`latency_ms` yang wajib. Field lain bernilai null, false, atau 0 bila tidak
dikirim, tidak pernah diisi dengan tebakan. `user_id` yang belum ada otomatis
masuk ke `user_directory`.

Endpoint lain yang memakai `X-API-Key`: `PATCH /events/{request_id}`,
`POST /system-metrics`, dan `POST /voice-trace/spans`.

## Integrasi

- **Bot BPJS (`bpjs-pending-bot-local`)**: halaman Settings
  (`/bot-config`) menampilkan dan mengedit tabel konfigurasi bot lewat proxy
  Next.js `frontend/app/api/bot-config/[...path]/route.ts`. Proxy menambahkan
  HTTP Basic Auth di sisi server (`BOT_DASHBOARD_USER`,
  `BOT_DASHBOARD_PASSWORD`, `BOT_API_URL`), jadi kredensial tidak sampai ke
  browser. Backend juga memakainya untuk membaca status provider dan profil
  pengguna. Tanpa kredensial itu, fitur terkait dilewati diam-diam.
- **Server pip**: halaman Settings juga bisa start, stop, restart, dan melihat
  log server pip lewat `pipctl.sh` di proyek bot.
- **Aplikasi mobile pip**: halaman Pip Mobile App menjalankan build dan
  emulator lokal.

Variabel `.env` tambahan untuk integrasi (backend):
`BOT_API_URL`, `BOT_DASHBOARD_USER`, `BOT_DASHBOARD_PASSWORD`, `PIPCTL_DIR`,
`PIPVOICE_DIR`, `ANDROID_SDK_DIR`, `CORS_ORIGINS`,
`PROVIDER_HEALTH_SYNC_INTERVAL_SECONDS` (default 30). Frontend:
`BOT_API_URL`, `BOT_DASHBOARD_USER`, `BOT_DASHBOARD_PASSWORD`,
`NEXT_PUBLIC_SITE_URL`.

## Keamanan: hanya untuk penggunaan lokal

Dashboard ini dirancang sebagai tool lokal satu pengguna. **Jangan diekspos ke
jaringan publik tanpa menambah autentikasi.**

- Hanya endpoint ingest (`/events`, `POST /system-metrics`,
  `POST /voice-trace/spans`) yang memakai `X-API-Key`. Semua endpoint lain
  tanpa autentikasi, termasuk tulis konfigurasi model dan intent, kontrol
  server pip, dan tools mobile.
- Endpoint kontrol (`/pip-server/*`, `/mobile-devtools/*`) menjalankan proses
  lokal, menghapus cache build, dan menelusuri folder di mesin. Dengan
  `POST /mobile-devtools/apps`, pemanggil menentukan folder proyek yang
  `gradlew`-nya akan dijalankan.
- `POST /config/models/test-connection` dan `/validate` melakukan request ke
  URL yang diberikan pemanggil, dan API key provider bisa terkirim ke URL itu.
- Proxy `/api/bot-config` di frontend juga tidak punya autentikasi.
- CORS dibatasi ke `http://localhost:3000` secara default.
- Kunci Gemini dikirim lewat query string URL saat probe, yang bisa terekam di
  log proxy.

Bila perlu dipakai bersama, pasang reverse proxy dengan autentikasi di depan
backend dan frontend, atau batasi hanya ke `localhost`.

## Struktur

```
backend/
  app/
    main.py                  FastAPI app, CORS, 22 router, /health, sinkron kesehatan provider
    config.py                Pengaturan dari .env
    models.py                Tabel SQLAlchemy
    security.py              Enkripsi Fernet untuk API key model
    provider_probe.py        Probe koneksi, validasi, dan tes prompt ke provider
    routers/                 Endpoint per fitur
    services/provider_health_sync.py   Sinkron status provider tiap 30 detik
  scripts/                   Migrasi dan seed
frontend/
  app/                       Halaman (App Router) dan proxy bot-config
  components/                Komponen UI dan konsol manajemen
  lib/api.ts                 Klien API bertipe
docs/                        Spesifikasi dan dokumentasi fitur
scripts/dashboard.sh         Start, stop, restart frontend
```

## Status

Backend dan frontend berjalan dengan data mock dari `seed.py` atau data nyata
dari `POST /events`. PRD pip Voice AI sendiri masih berupa desain, jadi skema
`request_metadata` di `backend/app/models.py` adalah kontrak ingest yang
disiapkan untuk komponen pip. Tes otomatis belum ada di repo ini.
