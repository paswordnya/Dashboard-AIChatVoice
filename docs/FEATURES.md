# Dokumentasi Fitur dan Alur — pip Voice AI Dashboard

Dokumen ini menjelaskan setiap fitur dashboard, fungsinya, endpoint backend
yang dipakai, dan alur datanya. Cara menjalankan ada di `README.md`.

## Gambaran alur data

```
 pip app / bot Telegram
        |  POST /events (X-API-Key)            POST /voice-trace/spans (X-API-Key)
        |  POST /system-metrics (X-API-Key)
        v
 +---------------------------+        +------------------------------+
 | backend (FastAPI :8010)   | <----> | Postgres                     |
 |  routers analitik (GET)   |        |  request_metadata, topics,   |
 |  routers konfigurasi      |        |  voice_trace_spans, ...      |
 +---------------------------+        +------------------------------+
        ^            |  tiap 30 detik: GET /api/dashboard/provider-status
        |            v
        |      bot BPJS (:8000)  <---- proxy /api/bot-config (Basic Auth di server)
        |            ^
 frontend (Next.js :3000) ---------+
```

Analitik hanya membaca tabel `request_metadata` dan turunannya. Karena itu
semua halaman analitik bergantung pada event yang dikirim lewat `POST /events`
(atau data mock dari `scripts/seed.py`).

## Navigasi dashboard

| Grup | Halaman | Rute |
|---|---|---|
| (tanpa grup) | Overview | `/` |
| Analytics | Voice Analytics, Voice Trace, Model Usage, Router Analytics, Knowledge Source, Categories, Topics, Cost Savings, Feature Adoption, Confidence, Escalation, Knowledge Gap, Top Failed Questions | `/voice-analytics`, `/voice-trace`, `/models`, `/router-analytics`, `/knowledge-source`, `/categories`, `/topics`, `/cost-savings`, `/feature-adoption`, `/confidence-distribution`, `/escalation-analytics`, `/knowledge-gap`, `/top-failed-questions` |
| People | Users | `/users` |
| Configuration | Model Management, Config, Settings, Pip Mobile App | `/models/manage`, `/config`, `/bot-config`, `/pip-mobile-app` |

Sidebar bisa dilipat per grup. Status lipatan diingat saat reload, dan grup
yang berisi halaman aktif selalu terbuka.

## 1. Fitur analitik (hanya baca)

Semua endpoint analitik berupa `GET`, dan sebagian besar menerima filter
`start` dan `end` (waktu).

| Fitur | Halaman | Endpoint | Fungsi |
|---|---|---|---|
| Overview | `/` | `GET /overview`, `/models`, `/categories` | KPI utama: total request, percakapan, pengguna, sesi unik, rata-rata latensi dan first-token latency, success, error, dan tool-call rate. Plus donut distribusi dan badge kesehatan provider. |
| Model Usage | `/models` | `GET /models` | Tabel per model dan provider: jumlah request, success dan error rate, latensi, token rata-rata, biaya rata-rata, terakhir dipakai. |
| Router Analytics | `/router-analytics` | `GET /router-analytics`, `/router-analytics/fallback-by-model` | Kinerja routing: jumlah routed, sukses, gagal, fallback lokal ke cloud dan cloud ke lokal, wrong-route rate, manual override, dan tujuan fallback. |
| Escalation | `/escalation-analytics` | `GET /escalation-analytics` | Persentase request yang naik tingkat, jumlah per kedalaman eskalasi, dan 10 jalur eskalasi tersering. |
| Knowledge Source | `/knowledge-source` | `GET /knowledge-source/distribution` | Porsi jawaban per sumber: database lokal, memory, cache, RAG, grounding, web search, atau LLM saja. |
| Knowledge Gap | `/knowledge-gap` | `GET /knowledge-gap?limit` | Pertanyaan yang dijawab hanya oleh LLM (tanpa sumber pengetahuan), diurutkan menurut frekuensi, dengan topik teratasnya. Petunjuk materi yang perlu ditambahkan. |
| Confidence | `/confidence-distribution` | `GET /confidence-distribution` | Sebaran confidence router dalam 10 bucket (lebar 0,1), rata-ratanya, dan perbandingan route bersih vs salah atau naik tingkat. |
| Categories | `/categories` | `GET /categories`, `/categories/{c}/routing` | Volume, persentase, dan success rate per kategori, plus rincian provider dan model untuk kategori teratas. |
| Topics | `/topics`, `/topics/[id]` | `GET /topics/summary`, `/topics`, `/topics/by-model`, `/topics/by-channel`, `/topics/new?days=7`, `/topics/timeline?bucket=`, `/topics/{id}` | Topik yang paling sering dibahas: leaderboard (dengan pencarian `q`), topik per model dan per kanal, topik baru minggu ini, timeline harian, mingguan, atau bulanan, dan detail topik (tren, intent teratas, model, sumber pengetahuan, topik terkait). |
| Cost Savings | `/cost-savings` | `GET /cost-savings` | Estimasi penghematan = jumlah request lokal x rata-rata biaya request cloud. Perkiraan kasar, bukan akuntansi per request. |
| Feature Adoption | `/feature-adoption` | `GET /feature-adoption` | Persentase request yang memakai tiap fitur: Voice, Memory, RAG, Web Search, Reminder, Calendar, MCP Tools, dan tool call apa pun. |
| Top Failed Questions | `/top-failed-questions` | `GET /top-failed-questions?limit` | Pertanyaan yang paling sering gagal atau mendapat feedback negatif. |
| Users | `/users`, `/users/[id]` | `GET /users/summary`, `/users/telegram`, `/users/top`, `/users/{id}`, `/users/{id}/profile` | Pembagian pengguna Telegram vs aplikasi pip, direktori pengguna Telegram, 20 pengguna teraktif, dan detail pengguna (model, kategori, topik, bahasa, dan profil adaptif dari bot). |

Catatan: profil adaptif pengguna (`/users/{id}/profile`) diambil dari bot BPJS
lewat HTTP Basic Auth, hanya untuk ID numerik, dan bernilai null bila gagal
atau kredensial tidak diset.

## 2. Voice Analytics

Halaman `/voice-analytics` adalah satu halaman panjang dengan 15 bagian. Semua
datanya dari request berkanal `voice`.

| Bagian | Endpoint |
|---|---|
| Ringkasan | `GET /voice-analytics/overview` |
| Voice Usage | `/voice-analytics/usage` |
| Voice Interaction | `/voice-analytics/interaction` |
| Speech | `/voice-analytics/speech` |
| STT | `/voice-analytics/stt` |
| TTS | `/voice-analytics/tts` |
| AI Response | `/voice-analytics/ai-response` |
| Intent dan Category | `/voice-analytics/intents`, `/voice-analytics/categories` |
| Topics | `/voice-analytics/topics` |
| Knowledge | `/voice-analytics/knowledge` |
| Models | `/voice-analytics/models` |
| Performance | `/voice-analytics/performance` |
| Errors | `/voice-analytics/errors` |
| Quality | `/voice-analytics/quality` |

Beberapa metrik belum dilacak (misalnya push-to-talk, keberhasilan STT per
tahap, clarification rate). Docstring di `routers/voice_analytics.py` mencatat
field mana yang tidak tersedia.

## 3. Voice Trace

Jejak per giliran bicara, untuk mencari bagian pipeline yang lambat.

- **Daftar** (`/voice-trace`): 50 trace terbaru, filter Mode A atau Mode B
  (`?mode=`). `GET /voice-trace/traces`.
- **Detail** (`/voice-trace/[traceId]`): Voice Performance Metrics, grafik
  waterfall durasi tiap komponen, dan timeline berurutan semua tahap.
  `GET /voice-trace/{trace_id}`, atau `GET /voice-trace/by-request/{request_id}`
  untuk melompat dari sebuah request.
- **Ingest**: pip mengirim span satu giliran sekaligus lewat
  `POST /voice-trace/spans` (`X-API-Key`). Satu batch menyimpan semua span, tanpa
  pengecekan duplikat.

```
pip app --POST /voice-trace/spans--> voice_trace_spans (trace_id, stage, urutan, durasi, status, provider, model, error)
                                          |
        /voice-trace  --GET /traces--> daftar --klik--> /voice-trace/[traceId] --> waterfall + timeline
```

## 4. Konfigurasi dan manajemen

### 4.1 Model Management (`/models/manage`)

Registry model AI yang bisa dipakai router. Terdiri dari empat panel.

| Panel | Fungsi | Endpoint |
|---|---|---|
| Tambah model | Isi nama, provider, identifier, versi, base URL, API key, context window, max output. Tombol "Test connection" dan validasi sebelum menyimpan. | `POST /config/models/test-connection`, `/config/models/validate`, `POST /config/models` |
| Tabel registry | Daftar model (provider, identifier, kapabilitas, status, kesehatan). Ubah status inline, hapus. | `GET /config/models`, `PATCH /config/models/{name}`, `DELETE /config/models/{name}` |
| Tes model | Pilih model, kirim prompt nyata, lihat hasilnya. Tidak dicatat ke `request_metadata`. | `POST /config/models/{name}/test` |
| Model default | Pilih model default untuk lima use case. | `GET /config/model-defaults`, `PUT /config/model-defaults/{use_case}` |

Aturan penting:
- API key dienkripsi (Fernet) sebelum disimpan dan tidak pernah dikembalikan.
  API hanya menampilkan `has_api_key`.
- `DELETE` ditolak (409) bila model masih menjadi default suatu use case.
- Model default harus berstatus aktif (409 bila tidak), dan harus ada (404).
- `PATCH` dengan `api_key` kosong ditolak (422). Setiap perubahan status
  menghapus `auto_deactivated_reason`.

### 4.2 Config Intent (`/config`)

Tabel konfigurasi per intent yang bisa diedit inline: prioritas, ambang
confidence, sumber pengetahuan, pengecekan aturan, batas latensi, status aktif,
dan **chain fallback** berurutan berisi pasangan provider dan model. Tambah,
ubah, dan hapus lewat `GET/POST /config/intents`, `PATCH/DELETE /config/intents/{intent}`
(409 bila intent sudah ada).

### 4.3 Sinkron kesehatan provider (otomatis)

Tugas latar yang berjalan tiap 30 detik (`PROVIDER_HEALTH_SYNC_INTERVAL_SECONDS`).

```
tiap 30 detik
  |
  v
GET bot /api/dashboard/provider-status (Basic Auth)
  |
  +-- provider DOWN      -> semua model aktif milik provider itu dinonaktifkan,
  |                         auto_deactivated_reason diisi
  +-- provider PULIH     -> model dengan auto_deactivated_reason diaktifkan lagi
  +-- kredensial kosong / gagal fetch -> dilewati diam-diam
```

Granularitasnya per provider, bukan per model. Nama `claude` di bot dipetakan
ke `anthropic`. Hasilnya tampil sebagai badge kesehatan di Overview dan tabel
registry.

### 4.4 Settings bot BPJS (`/bot-config`)

Satu tempat untuk mengedit konfigurasi bot lewat proxy Next.js.

```
browser --> /api/bot-config/<path> (GET, PATCH)
              |  Next.js route handler menambah Basic Auth di server
              v
        ${BOT_API_URL}/api/dashboard/<path>
```

Bagian: Server (kontrol server pip), Settings, Prompt Templates, AI Provider
Routes (tugas ke provider dan model), dan AI Providers (label, aktif). Tiap baris
bisa disimpan sendiri dengan indikator sibuk dan pesan error. Bila bot tidak
terjangkau, proxy membalas 502.

### 4.5 Kontrol server pip

Panel di `/bot-config` yang menjalankan `pipctl.sh` dari proyek bot.

| Aksi | Endpoint | Catatan |
|---|---|---|
| Status | `GET /pip-server/status` | Label "Jalan" atau "Tidak jalan" |
| Start | `POST /pip-server/start` | `port` opsional (1-65535) lewat env `PORT` |
| Stop | `POST /pip-server/stop` | Batas waktu 15 detik, konfirmasi dua langkah |
| Restart | `POST /pip-server/restart` | Batas waktu 30 detik, konfirmasi dua langkah |
| Log | `GET /pip-server/logs?lines=` | Membaca `logs/server.log`, 1 sampai 2000 baris |

### 4.6 Pip Mobile App (`/pip-mobile-app`)

Tools pengembangan aplikasi mobile pip dari browser. Backend menjalankan
perintah lokal dengan daftar argumen tetap (tanpa shell).

```
Daftarkan app --> pilih folder proyek (browse) --> pilih target --> Run / Open / Clear cache
```

| Aksi | Endpoint | Yang terjadi |
|---|---|---|
| Daftar, tambah, hapus app | `GET/POST /mobile-devtools/apps`, `DELETE .../{id}` | Registry app (nama, folder proyek Android, path `.xcodeproj` iOS, scheme, bundle id). Tabel kosong otomatis diisi app "pip". |
| Telusuri folder | `GET /mobile-devtools/browse?path=` | Daftar subfolder, menandai `.xcodeproj` dan `.xcworkspace` |
| Cek kemampuan | `GET /mobile-devtools/capabilities` | Ada tidaknya Android Studio dan SDK |
| Daftar emulator | `GET /mobile-devtools/emulators` | AVD Android, device `adb`, dan simulator iOS |
| Buka Xcode atau Android Studio | `POST .../open-xcode`, `.../open-android-studio` | `open -a` |
| Run Android | `POST .../run-android` | Boot AVD (tunggu sampai 120 dtk, boot selesai sampai 90 dtk), `gradlew installDebug`, lalu `adb shell am start` |
| Run iOS | `POST .../run-ios` | Boot simulator (UDID harus ada di daftar), `xcodebuild` ke DerivedData, `simctl install` dan `launch` |
| Hapus cache Android | `POST .../clear-cache/android` | `gradlew clean` |
| Hapus cache iOS | `POST .../clear-cache/ios` | Menghapus DerivedData milik proyek, konfirmasi dua langkah |

## 5. Alur ingest data (sumber semua analitik)

```
POST /events (X-API-Key)
   |
   +-- simpan satu baris request_metadata
   |     (field yang tidak dikirim tetap null, false, atau 0)
   +-- user_id baru?  -> tambah ke user_directory (dengan platform asal event)
   +-- topik?         -> cari tanpa peduli huruf besar-kecil, buat bila belum ada
   |                     -> tautkan ke message_topics dan conversation_topics
   v
PATCH /events/{request_id}   (opsional: field yang baru diketahui setelah POST awal)

POST /system-metrics (X-API-Key)  -> sampel CPU dan memori dari bot, sekitar tiap 30 detik
GET  /system-metrics/latest       -> sampel terbaru
```

## 6. Tabel database

| Tabel | Isi |
|---|---|
| `request_metadata` | Satu baris per request AI: id, model, provider, intent, kategori, query, flag routing dan confidence, jalur eskalasi, flag hit sumber pengetahuan, token, biaya, sukses, feedback, latensi, kanal, dan field suara (STT, TTS, VAD, interupsi, bahasa) |
| `system_metrics` | Sampel CPU dan memori |
| `voice_trace_spans` | Span per tahap pipeline suara |
| `user_directory` | Direktori pengguna (platform, username Telegram) |
| `intent_config` | Konfigurasi routing per intent, termasuk `chain` fallback (JSONB) |
| `topics`, `conversation_topics`, `message_topics` | Topik dan tautannya ke percakapan dan pesan |
| `model_registry` | Registry model (API key terenkripsi, status, alasan nonaktif otomatis) |
| `model_default_assignment` | Model default per use case |
| `mobile_devtools_apps` | Registry app mobile untuk tools devtools |

## 7. Autentikasi ringkas

| Endpoint | Autentikasi |
|---|---|
| `POST/PATCH /events`, `POST /system-metrics`, `POST /voice-trace/spans` | Header `X-API-Key` |
| `GET /health` dan semua endpoint lain | Tidak ada |

Lihat bagian Keamanan di `README.md` sebelum mengekspos dashboard di luar
mesin lokal.
