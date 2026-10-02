# Dashboard Requirement – AI Analytics & Model Observability

## Objective

Menyediakan dashboard analytics yang menampilkan penggunaan AI secara real-time untuk membantu developer dan product team memahami performa model, pola penggunaan, kualitas routing, serta efektivitas AI Assistant.

Dashboard harus menjadi pusat observability seluruh AI pipeline, baik model lokal (LM Studio) maupun cloud (Gemini/OpenAI), sehingga mudah mengetahui model mana yang paling sering digunakan, kategori pertanyaan pengguna, penggunaan tool, dan performa sistem. Dashboard yang efektif sebaiknya menampilkan metrik penggunaan, performa, dan outcome secara bersamaan, bukan hanya jumlah request.

---

# 1. Overview

## KPI Cards

Menampilkan ringkasan penggunaan AI.

* Total Requests
* Total Conversations
* Total Active Users
* Total Sessions
* Total AI Responses
* Average Response Time
* Average First Token Time
* Success Rate
* Error Rate
* Tool Call Rate

---

# 2. Model Usage

Menampilkan penggunaan setiap model AI.

Informasi:

* Model Name
* Provider
* Total Requests
* Success Rate
* Error Rate
* Average Latency
* Average Token Usage
* Average Cost (Cloud)
* Last Used

Contoh

| Model       | Requests | Success | Avg Latency |
| ----------- | -------: | ------: | ----------: |
| Gemma-4-E4B |   18,520 |   99.8% |       75 ms |
| Gemma-4-26B |    7,210 |   99.4% |       1.8 s |
| Qwen3.6-27B |    1,102 |   99.2% |       3.5 s |
| Nemotron    |    3,450 |   99.9% |       60 ms |
| Gemini      |      920 |   99.7% |       2.1 s |

---

# 3. Model Distribution

Visualisasi:

* Pie Chart
* Bar Chart

Menampilkan:

* Persentase penggunaan setiap model
* Provider paling sering digunakan
* Local vs Cloud Usage

---

# 4. Task / Intent Analytics

Menampilkan task yang paling sering dijalankan.

Contoh:

* Greeting
* Small Talk
* Daily Assistant
* Q&A
* Coding
* Architecture
* Translation
* Rewrite
* Search
* Memory
* Reminder
* Voice Command

Informasi:

* Total Requests
* Success Rate
* Model yang digunakan

---

# 5. Category Analytics

Kategori pertanyaan yang paling banyak ditanyakan.

Contoh

* Coding
* AI
* Travel
* Health
* Finance
* Education
* Shopping
* Productivity
* Translation
* Writing

Menampilkan:

* Top 10 Categories
* Growth
* Daily Trend
* Weekly Trend

---

# 6. Conversation Analytics

Menampilkan:

* Total Chat Sessions
* Total Voice Sessions
* Average Conversation Length
* Average Messages per Session
* Average Session Duration
* Longest Conversation

---

# 7. Local AI Analytics

Khusus LM Studio.

Menampilkan:

* Total Local Requests
* Local Success Rate
* Local Cache Hit
* Local Model Usage
* Local Response Time
* Local GPU Usage (jika tersedia)
* Local CPU Usage (jika tersedia)
* Local Memory Usage (RAM)

---

# 8. Cloud Analytics

Menampilkan:

* Total Cloud Requests
* Gemini Requests
* OpenAI Requests
* Fallback Count
* Retry Count
* Cloud Latency
* Estimated Cost
* Token Usage

---

# 9. Router Analytics

Menampilkan performa AI Router.

* Total Routed Requests
* Route Success
* Route Failure
* Local → Cloud Fallback
* Cloud → Local Fallback
* Wrong Route Rate
* Manual Override

---

# 10. Memory Analytics

Menampilkan:

* Total Memories
* Memory Created
* Memory Updated
* Memory Deleted
* Memory Recall
* Top Memory Categories

Kategori

* Profile
* Preference
* Project
* Work
* Hobby
* Language

---

# 11. Tool Analytics

Menampilkan penggunaan tool.

Contoh:

* Web Search
* Grounding Search
* Calendar
* Notes
* Reminder
* Google Sheet
* Database
* RAG
* MCP Tools

Informasi:

* Total Calls
* Success Rate
* Average Latency

---

# 12. Grounding Analytics

Menampilkan penggunaan grounding dan knowledge retrieval.

Informasi:

* Total Grounding Requests
* Grounding Success Rate
* Local Knowledge Hit
* RAG Hit
* Vector Search Hit
* Web Search Count
* Average Retrieval Time
* Documents Retrieved

---

# 13. RAG Analytics

Jika menggunakan RAG.

Menampilkan:

* Total Retrieval
* Vector Search Count
* Average Similarity Score
* Average Documents Returned
* Cache Hit
* Retrieval Latency

---

# 14. Token Analytics

Menampilkan:

* Input Tokens
* Output Tokens
* Total Tokens
* Average Tokens per Request
* Token per Model
* Token per User
* Token per Task

---

# 15. Performance Analytics

Menampilkan:

* Average Response Time
* First Token Time
* Streaming Duration
* Tool Execution Time
* STT Latency
* TTS Latency
* Total End-to-End Latency

---

# 16. Voice Analytics

Menampilkan:

* Voice Sessions
* Voice Duration
* Average STT Time
* Average TTS Time
* Voice Interruptions
* Voice Commands
* Wake Word Count

---

# 17. Error Analytics

Menampilkan:

* Timeout
* Tool Failure
* Model Failure
* Invalid Response
* Parsing Error
* API Error
* Hallucination Detection (jika tersedia)

---

# 18. User Analytics

Menampilkan:

* Active Users
* Daily Active Users
* Weekly Active Users
* Monthly Active Users
* Average Sessions
* Average Messages per User

---

# 19. Trend Analytics

Grafik:

* Daily Requests
* Weekly Requests
* Monthly Requests
* Peak Hours
* Peak Days

---

# 20. Leaderboard

Top Models

* Most Used Model
* Fastest Model
* Lowest Latency
* Highest Success Rate

Top Categories

* Most Asked Category
* Fastest Growing Category

Top Tools

* Most Used Tool

---

# 21. Filters

Dashboard harus mendukung filter:

* Date Range
* User
* Session
* Model
* Provider
* Intent
* Category
* Platform
* Device
* Chat / Voice
* Local / Cloud

---

# Success Metrics

Dashboard dianggap berhasil apabila mampu menjawab pertanyaan berikut tanpa membuka log mentah:

* Model apa yang paling sering digunakan?
* Berapa kali setiap model dipanggil?
* Berapa persen request diproses secara lokal vs cloud?
* Berapa kali grounding, RAG, atau web search digunakan?
* Intent dan kategori apa yang paling sering ditanyakan?
* Model mana yang paling cepat dan paling stabil?
* Berapa tingkat keberhasilan routing AI?
* Berapa rata-rata latency setiap model?
* Berapa total token dan estimasi biaya cloud?
* Kapan traffic AI paling tinggi?

## 13. Knowledge Source Analytics

Dashboard harus menampilkan sumber pengetahuan (Knowledge Source) yang digunakan AI untuk menghasilkan setiap jawaban. Tujuannya adalah memastikan efektivitas penggunaan data lokal, cache, memory, RAG, maupun cloud service.

### KPI Cards

* Total Local Database Requests
* Local Database Hit
* Local Database Miss
* User Memory Hit
* Cache Hit
* Cache Miss
* Local RAG Retrieval
* Grounding Requests
* Web Search Requests
* LLM Only Responses

---

### Knowledge Source Distribution

Visualisasi:

* Pie Chart
* Stacked Bar Chart

Menampilkan persentase sumber jawaban AI.

Contoh:

| Source         | Requests | Percentage |
| -------------- | -------: | ---------: |
| Local Database |    3,241 |        42% |
| User Memory    |    1,284 |        17% |
| Local RAG      |    1,016 |        13% |
| Cache          |      892 |        12% |
| Web Search     |      764 |        10% |
| Grounding      |      412 |         5% |
| LLM Only       |      151 |         2% |

---

### Local Database Analytics

Menampilkan:

* Total Local Queries
* Successful Retrieval
* Retrieval Miss
* Average Query Time
* Hit Rate
* Most Accessed Tables
* Most Accessed Knowledge Base
* Failed Queries

---

### User Memory Analytics

Menampilkan:

* Total Memory Recall
* Profile Memory
* Preference Memory
* Project Memory
* Work Memory
* Recent Memory Usage
* Memory Hit Rate

---

### Cache Analytics

Menampilkan:

* Cache Hit
* Cache Miss
* Cache Expired
* Average Cache Response Time
* Cache Hit Rate

---

### RAG Analytics

Menampilkan:

* Vector Search Requests
* Documents Retrieved
* Average Similarity Score
* Average Retrieval Time
* Top Referenced Documents
* RAG Success Rate

---

### Grounding Analytics

Menampilkan:

* Total Grounding Requests
* Grounding Success
* Grounding Failure
* Average Grounding Latency
* Referenced External Sources

---

### Web Search Analytics

Menampilkan:

* Total Web Searches
* Successful Searches
* Search Failure
* Average Search Time
* Most Frequently Searched Topics

---

### Knowledge Source per Model

Menampilkan hubungan antara model dan sumber data yang digunakan.

Contoh:

| Model       | Local DB | Memory | RAG | Grounding | Web Search | LLM Only |
| ----------- | -------: | -----: | --: | --------: | ---------: | -------: |
| Gemma-4-E4B |    2,130 |    820 | 120 |         0 |          0 |       85 |
| Gemma-4-26B |      980 |    310 | 540 |        52 |        103 |       44 |
| Qwen3.6-27B |      131 |     95 | 245 |        18 |         24 |       12 |
| Gemini      |        0 |     59 | 111 |       284 |        402 |       10 |

---

### Knowledge Source Timeline

Grafik harian/mingguan yang menampilkan tren penggunaan:

* Local Database
* Memory
* Cache
* RAG
* Grounding
* Web Search
* LLM Only

---

### Request Metadata

Setiap request AI wajib menyimpan metadata berikut agar seluruh analytics dapat dihitung.

| Field            | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| request_id       | Unique Request ID                                              |
| session_id       | Session ID                                                     |
| conversation_id  | Conversation ID                                                |
| model_used       | Model yang digunakan                                          |
| provider         | LM Studio / Gemini / OpenAI / Ollama                           |
| knowledge_source | Local DB, Memory, Cache, RAG, Grounding, Web Search, LLM Only  |
| local_db_hit     | Boolean                                                        |
| memory_hit       | Boolean                                                        |
| rag_hit          | Boolean                                                        |
| cache_hit        | Boolean                                                        |
| grounding_used   | Boolean                                                        |
| web_search_used  | Boolean                                                        |
| tool_called      | Tool yang digunakan                                            |
| latency_ms       | Total response latency                                        |
| input_tokens     | Input tokens                                                   |
| output_tokens    | Output tokens                                                  |
| timestamp        | Request time                                                   |

---

### Success Metrics

Dashboard harus mampu menjawab pertanyaan berikut:

* Berapa kali AI mengambil jawaban dari Local Database?
* Berapa persen jawaban berasal dari User Memory?
* Berapa kali AI menggunakan Cache?
* Berapa kali AI melakukan RAG Retrieval?
* Berapa kali Grounding digunakan?
* Berapa kali AI melakukan Web Search?
* Berapa persen jawaban berasal murni dari LLM tanpa retrieval?
* Model mana yang paling sering menggunakan Local Database?
* Model mana yang paling sering membutuhkan Grounding?
* Seberapa efektif Knowledge Base lokal dibanding Cloud?

---

# 22. Model Management & Dynamic Configuration

Modul administratif yang memungkinkan Administrator atau AI Engineer menambahkan, mengubah, mengaktifkan, menonaktifkan, dan mengelola model AI secara **real-time** tanpa deployment aplikasi. Berbeda dari §2 Model Usage (yang bersifat read-only analytics), modul ini adalah console untuk mengelola model itu sendiri — model yang ditambahkan di sini langsung tersedia untuk AI Router setelah lolos verifikasi.

### Goals

* Menambahkan model baru tanpa deployment.
* Mengaktifkan model secara langsung.
* Mengubah routing model tanpa restart service.
* Mendukung banyak provider, lokal maupun cloud.
* Memudahkan eksperimen model.
* Mendukung rollback konfigurasi.

### Supported Providers

* LM Studio
* Ollama
* Gemini
* OpenAI
* Anthropic
* OpenRouter
* Azure OpenAI
* Custom OpenAI Compatible API

### Navigation

```text
AI Console

├── Dashboard
├── Analytics
├── Router
├── Models
│     ├── Active Models
│     ├── Add Model
│     ├── Model Profiles
│     ├── Model Capabilities
│     ├── Health Check
│     └── Version History
│
├── Providers
├── Prompt Templates
├── Knowledge
└── Settings
```

---

### Active Models

Menampilkan seluruh model yang tersedia beserta provider, status, versi, dan flag default.

Contoh

| Model            | Provider  | Status   | Version | Default |
| ---------------- | --------- | -------- | ------- | ------- |
| Gemma-4-E4B      | LM Studio | Active   | v4      | ✅       |
| Gemma-4-26B      | LM Studio | Active   | v4      |         |
| Qwen3.6-27B      | LM Studio | Active   | v3.6    |         |
| Gemini 2.5 Flash | Gemini    | Active   | Latest  |         |
| GPT-5.5          | OpenAI    | Disabled | Latest  |         |

---

### Add New Model

Administrator dapat menambahkan model baru.

Field

* Model Name
* Display Name
* Provider
* API Base URL
* API Key (Encrypted)
* Model Identifier
* Version
* Context Window
* Max Output Tokens
* Timeout
* Streaming Support
* Vision Support
* Function Calling Support
* JSON Mode Support
* Embedding Support (opsional)

Action

* Test Connection
* Validate Model
* Save
* Save & Activate

Jika validasi berhasil, model langsung tersedia pada AI Router.

---

### Model Status

* Active
* Inactive
* Maintenance
* Deprecated
* Experimental

Hanya model **Active** yang dapat dipilih oleh Router.

---

### Model Capability

Setiap model memiliki daftar kemampuan yang digunakan AI Router untuk memilih model yang sesuai.

Contoh

| Capability       | Supported |
| ---------------- | --------- |
| Chat             | ✅         |
| Voice            | ✅         |
| Coding           | ✅         |
| Vision           | ❌         |
| Translation      | ✅         |
| Summarization    | ✅         |
| Function Calling | ✅         |
| JSON Output      | ✅         |
| Long Context     | ✅         |

---

### Model Use Cases

Administrator dapat menentukan model digunakan untuk kebutuhan apa (primary/secondary, dengan fallback).

Contoh

| Use Case              | Primary Model | Secondary Model |
| ---------------------- | ------------- | --------------- |
| Greeting               | Gemma-4-E4B   | Gemini          |
| Small Talk              | Gemma-4-26B   | Gemini          |
| Daily Assistant         | Gemma-4-26B   | Gemini          |
| Coding                  | Qwen3.6-27B   | Gemini          |
| Code Review             | Qwen3.6-27B   | Gemini          |
| Debugging               | Qwen3.6-27B   | Gemini          |
| Health                  | Gemma-4-26B   | Qwen3.6-27B     |
| Translation             | Gemma-4-26B   | Gemini          |
| Summarization           | Gemma-4-26B   | Qwen3.6-27B     |
| Vision                  | Gemini        | GPT-5.5         |
| Memory Classification   | Gemma-4-E4B   | Nemotron        |
| Intent Detection        | Gemma-4-E4B   | Nemotron        |
| Topic Classification    | Gemma-4-E4B   | Nemotron        |
| Entity Extraction       | Nemotron      | Gemma-4-E4B     |
| RAG Answering           | Gemma-4-26B   | Gemini          |
| Grounding Search        | Gemini        | GPT-5.5         |

---

### Model Assignment

Satu model dapat digunakan oleh banyak fitur; dashboard harus menampilkan seluruh assignment.

Contoh — Gemma-4-E4B digunakan oleh: Intent Detection, Topic Detection, Memory Classification, Greeting.

---

### Model Health

| Metric                 | Description           |
| ----------------------- | ---------------------- |
| Status                  | Active / Down          |
| Last Health Check       | Terakhir dicek         |
| Average Response Time   | Latency                |
| Success Rate            | Tingkat keberhasilan   |
| Error Rate              | Tingkat error          |
| Queue Length             | Panjang antrean        |
| Last Error               | Error terakhir         |

---

### Runtime Configuration

Parameter model yang dapat diubah Administrator tanpa deployment; perubahan langsung berlaku untuk request berikutnya.

* Temperature
* Top P
* Top K
* Max Tokens
* Stop Sequence
* Timeout
* Retry Count
* Streaming
* Parallel Request Limit

---

### Enable / Disable Model

Administrator dapat Activate / Deactivate model. Jika model dinonaktifkan, AI Router otomatis menggunakan fallback yang telah dikonfigurasi.

---

### Default Model

Administrator dapat menentukan Default Model per kategori:

* Chat
* Voice
* Background Task
* Classification
* Coding

---

### Test Model

Alur pengujian model dari dashboard:

Input Prompt → Memilih Model → Response → Latency → Token → Cost → Health Status

---

### Model Analytics

* Total Requests
* Success Rate
* Error Rate
* Average Latency
* Average Token Usage
* Average Cost
* First Token Time
* Time To First Audio (Voice)
* Retry Count
* Fallback Count

---

### Version History

Setiap perubahan model dicatat, dengan dukungan rollback.

Contoh

| Version | Updated By | Date   |
| ------- | ---------- | ------ |
| 1.0     | Admin      | 01 Jul |
| 1.1     | AI Team    | 08 Jul |
| 1.2     | QA         | 12 Jul |

---

### Acceptance Criteria

**Add Model**

* Admin dapat menambahkan model baru.
* Sistem melakukan validasi koneksi sebelum menyimpan.
* Model dapat langsung diaktifkan setelah validasi berhasil.
* Model baru otomatis muncul pada daftar model AI Router.

**Active Models**

* Dashboard menampilkan seluruh model yang aktif.
* Dashboard menampilkan provider dan status model.
* Dashboard menampilkan capability setiap model.
* Dashboard menampilkan use case setiap model.

**Runtime Configuration**

* Parameter model dapat diubah tanpa deployment.
* Perubahan langsung digunakan oleh request berikutnya.

**Monitoring**

* Dashboard menampilkan status kesehatan model secara real-time.
* Dashboard menampilkan statistik penggunaan model.

---

### Future Enhancements

* Auto Model Benchmark.
* Automatic Health Monitoring.
* Automatic Failover.
* Auto Scaling.
* Cost-based Routing.
* Latency-based Routing.
* Capability-based Routing.
* A/B Testing antar model.
* Canary Release untuk model baru.
* Model Recommendation berdasarkan performa.

simpan project di dalam L-casemx
