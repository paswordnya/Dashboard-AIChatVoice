"""Seed request_metadata with mock data for local dashboard development.

Distributions are pulled from the example tables in
docs/dashboard-requirements.md (§2 Model Usage, §13 Knowledge Source
Distribution) so the dashboard renders something resembling the spec's own
examples, scaled down to a seed-sized dataset. Run from backend/:

    python scripts/seed.py [--rows N] [--reset]
"""

import argparse
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import IntentConfig, RequestMetadata, UserDirectory  # noqa: E402

random.seed(42)

# (model, provider, weight, avg_latency_ms, success_rate)
MODELS = [
    ("Gemma-4-E4B", "lm_studio", 1852, 75, 0.998),
    ("Gemma-4-26B", "lm_studio", 721, 1800, 0.994),
    ("Qwen3.6-27B", "lm_studio", 110, 3500, 0.992),
    ("Nemotron", "lm_studio", 345, 60, 0.999),
    ("gemini-flash", "gemini", 400, 2100, 0.997),
    ("gpt-5-mini", "openai", 150, 2400, 0.993),
    ("claude-haiku", "anthropic", 120, 2200, 0.996),
    ("llama3.3:8b", "ollama", 180, 900, 0.995),
]

# (knowledge_source, weight)
KNOWLEDGE_SOURCES = [
    ("local_db", 42),
    ("memory", 17),
    ("rag", 13),
    ("cache", 12),
    ("web_search", 10),
    ("grounding", 5),
    ("llm_only", 2),
]

INTENTS = [
    "greeting", "small_talk", "daily_assistant", "qa", "coding", "architecture",
    "translation", "rewrite", "search", "memory", "reminder", "voice_command",
]

# Default AI Router config per intent — (intent, model, provider, priority, confidence_threshold, fallback_model).
# Seeded only if intent_config is empty; never overwrites edits made via the Config tab.
DEFAULT_INTENT_CONFIGS = [
    ("greeting", "Nemotron", "lm_studio", 1, 0.50, "Gemma-4-E4B"),
    ("small_talk", "gemini-flash", "gemini", 2, 0.60, "Gemma-4-26B"),
    ("daily_assistant", "Gemma-4-26B", "lm_studio", 3, 0.60, "gemini-flash"),
    ("qa", "gpt-5-mini", "openai", 4, 0.70, "gemini-flash"),
    ("coding", "claude-haiku", "anthropic", 5, 0.75, "gpt-5-mini"),
    ("architecture", "claude-haiku", "anthropic", 6, 0.75, "gpt-5-mini"),
    ("translation", "gemini-flash", "gemini", 7, 0.60, "Gemma-4-26B"),
    ("rewrite", "Gemma-4-26B", "lm_studio", 8, 0.55, "gemini-flash"),
    ("search", "gemini-flash", "gemini", 9, 0.65, "llama3.3:8b"),
    ("memory", "Gemma-4-E4B", "lm_studio", 10, 0.50, "Gemma-4-26B"),
    ("reminder", "Nemotron", "lm_studio", 11, 0.50, "Gemma-4-E4B"),
    ("voice_command", "Nemotron", "lm_studio", 12, 0.55, "llama3.3:8b"),
]
CATEGORIES = [
    "coding", "ai", "travel", "health", "finance", "education",
    "shopping", "productivity", "translation", "writing",
]
TOOLS = [
    "web_search", "grounding_search", "calendar", "notes", "reminder",
    "google_sheet", "database", "rag", "mcp_tools",
]
ERROR_TYPES = [
    "timeout", "tool_failure", "model_failure", "invalid_response",
    "parsing_error", "api_error", "hallucination",
]
PIP_APP_PLATFORMS = ["ios", "android", "web"]
TELEGRAM_PLATFORM = "telegram"

# Model tier for escalation-chain generation — lower tier = smaller/faster,
# escalation only ever climbs tiers, never sideways or down.
MODEL_TIER = {
    "Nemotron": 1,
    "Gemma-4-E4B": 1,
    "Gemma-4-26B": 2,
    "llama3.3:8b": 2,
    "Qwen3.6-27B": 3,
    "gemini-flash": 4,
    "gpt-5-mini": 4,
    "claude-haiku": 4,
}

GENERIC_QUESTIONS = [
    "Halo pip, apa kabar?",
    "Terima kasih ya",
    "Selamat pagi",
    "Kamu bisa bantu apa aja?",
    "Ulangi lagi yang tadi",
]

QUESTIONS_BY_CATEGORY = {
    "coding": [
        "Buatkan fungsi Python untuk sorting list of dict berdasarkan key tertentu",
        "Kenapa async function saya stuck di await terus?",
        "Apa bedanya useEffect dan useLayoutEffect di React?",
        "Cara handle race condition di Go pakai channel gimana?",
        "Refactor kode ini biar gak nested callback",
        "Bagaimana cara setup CI/CD untuk monorepo?",
        "Query SQL buat join tiga tabel dengan kondisi ini gimana?",
    ],
    "ai": [
        "Apa bedanya RAG dan fine-tuning?",
        "Kenapa model saya sering halusinasi jawaban?",
        "Bagaimana cara kerja attention mechanism di transformer?",
        "Model mana yang paling murah buat task klasifikasi sederhana?",
        "Cara evaluasi kualitas embedding yang bagus itu gimana?",
    ],
    "travel": [
        "Rekomendasi itinerary 3 hari di Yogyakarta apa aja?",
        "Musim apa paling bagus buat ke Jepang?",
        "Berapa estimasi budget backpacking ke Vietnam seminggu?",
        "Visa ke Eropa butuh syarat apa aja sekarang?",
        "Rute kereta tercepat dari Jakarta ke Surabaya?",
    ],
    "health": [
        "Apa penyebab sering pusing di pagi hari?",
        "Berapa lama efek kafein bertahan di tubuh?",
        "Makanan apa yang bagus buat naikin imun?",
        "Apa beda gejala flu biasa sama alergi?",
        "Berapa jam tidur ideal buat orang dewasa?",
    ],
    "finance": [
        "Cara hitung compound interest buat tabungan gimana?",
        "Reksadana pasar uang vs deposito, mana lebih untung?",
        "Apa itu dollar cost averaging dan gimana caranya?",
        "Bagaimana cara bikin budget bulanan yang realistis?",
        "Pajak penghasilan freelance dihitung dari mana aja?",
        "Kapan waktu yang tepat buat mulai investasi saham?",
    ],
    "education": [
        "Jelaskan konsep fotosintesis secara sederhana",
        "Cara paling efektif belajar bahasa asing itu apa?",
        "Apa perbedaan skripsi kuantitatif dan kualitatif?",
        "Bagaimana cara bikin study plan buat ujian mingguan?",
        "Rumus integral parsial itu gimana turunannya?",
    ],
    "shopping": [
        "Rekomendasi laptop under 10 juta buat kerja desain apa?",
        "Kapan biasanya diskon besar e-commerce lokal?",
        "Cara bedain barang KW sama ori pas belanja online?",
        "Headphone noise cancelling terbaik di budget menengah apa?",
    ],
    "productivity": [
        "Metode manajemen waktu yang cocok buat kerja remote apa?",
        "Cara bikin to-do list yang gak numpuk terus gimana?",
        "Aplikasi note-taking yang bagus buat riset itu apa?",
        "Teknik pomodoro efektif gak buat kerja deep focus?",
    ],
    "translation": [
        "Terjemahin kalimat ini ke bahasa Inggris yang formal",
        "Apa padanan idiom 'buang badan' dalam bahasa Inggris?",
        "Tolong perbaiki grammar paragraf ini",
        "Terjemahin dokumen ini tapi pertahankan istilah teknisnya",
    ],
    "writing": [
        "Bantu rapikan draft email ke klien ini dong",
        "Buatkan outline artikel tentang produktivitas kerja",
        "Perbaiki tone tulisan ini biar lebih formal",
        "Ringkas dokumen panjang ini jadi beberapa poin utama",
    ],
}


def pick_query_text(category: Optional[str]) -> str:
    pool = QUESTIONS_BY_CATEGORY.get(category, GENERIC_QUESTIONS) if category else GENERIC_QUESTIONS
    return random.choice(pool)


def build_escalation(model: str, requested_steps: int) -> tuple[int, Optional[str]]:
    """Cap requested escalation depth to how many strictly-lower-tier models
    actually exist below `model`'s tier, and render the chain as text."""
    final_tier = MODEL_TIER.get(model, 1)
    lower_tier_models = [m for m, t in MODEL_TIER.items() if t < final_tier]
    steps = min(requested_steps, len(lower_tier_models))
    if steps == 0:
        return 0, None
    chain = sorted(random.sample(lower_tier_models, steps), key=lambda m: MODEL_TIER[m])
    chain.append(model)
    return steps, " → ".join(chain)

N_USERS = 250
N_SESSIONS = 500
N_CONVERSATIONS = 700

# Authoritative Telegram user list — sourced from the real "config" sheet
# tab, not invented. (telegram_username, linked user_id or None). A None
# user_id means that real Telegram user has no activity in request_metadata
# yet — TelegramDirectory keeps them visible with blank stats regardless.
REAL_TELEGRAM_USERS = [
    ("rakkap", "user_0000"),
    ("lialialiat", "user_0001"),
    ("Rbesars", None),
]


def assign_user_platforms(user_ids: list[str]) -> dict[str, str]:
    """Each user has one home platform, fixed for all their requests. Only
    the real Telegram accounts (from the sheet) get platform=telegram —
    everyone else is a native pip app user (ios/android/web)."""
    telegram_user_ids = {uid for _, uid in REAL_TELEGRAM_USERS if uid is not None}
    return {
        user_id: TELEGRAM_PLATFORM if user_id in telegram_user_ids else random.choice(PIP_APP_PLATFORMS)
        for user_id in user_ids
    }


def assign_telegram_usernames() -> dict[str, str]:
    """Maps linked user_id -> real @username, for the request_metadata rows
    those specific accounts generate."""
    return {uid: username for username, uid in REAL_TELEGRAM_USERS if uid is not None}


def pick_knowledge_source() -> str:
    sources, weights = zip(*KNOWLEDGE_SOURCES)
    return random.choices(sources, weights=weights, k=1)[0]


def pick_model() -> tuple[str, str, float, float]:
    weights = [m[2] for m in MODELS]
    model, provider, _, avg_latency, success_rate = random.choices(MODELS, weights=weights, k=1)[0]
    return model, provider, avg_latency, success_rate


def jitter_latency(avg_ms: float) -> float:
    return max(5.0, random.gauss(avg_ms, avg_ms * 0.35))


def random_timestamp(days_back: int = 30) -> datetime:
    now = datetime.now(timezone.utc)
    delta_seconds = random.randint(0, days_back * 24 * 3600)
    ts = now - timedelta(seconds=delta_seconds)
    # bias toward business hours (peak traffic) for Trend Analytics (§19)
    hour_weights = [1, 1, 1, 1, 1, 2, 4, 6, 8, 9, 9, 8, 8, 9, 9, 8, 7, 6, 5, 4, 3, 2, 2, 1]
    hour = random.choices(range(24), weights=hour_weights, k=1)[0]
    return ts.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))


def make_row(
    user_ids: list[str],
    session_ids: list[str],
    conversation_ids: list[str],
    user_platforms: dict[str, str],
    user_telegram_usernames: dict[str, str],
) -> RequestMetadata:
    model, provider, avg_latency, success_rate = pick_model()
    knowledge_source = pick_knowledge_source()
    channel = random.choices(["chat", "voice"], weights=[70, 30], k=1)[0]
    success = random.random() < success_rate
    latency = jitter_latency(avg_latency)
    input_tokens = random.randint(20, 500)
    output_tokens = random.randint(20, 800)
    is_cloud = provider in ("gemini", "openai", "anthropic")
    tool_called = random.choice(TOOLS) if knowledge_source in ("rag", "grounding", "web_search") and random.random() < 0.8 else None

    category = random.choice(CATEGORIES) if random.random() < 0.7 else None
    wrong_route = random.random() < 0.02
    requested_escalation = random.choices([0, 1, 2, 3], weights=[88, 8, 3, 1], k=1)[0]
    escalation_steps, escalation_path = build_escalation(model, requested_escalation)
    # low-confidence routing is what drives both wrong routes and escalation in practice
    routing_confidence = (
        random.uniform(0.30, 0.65) if (wrong_route or escalation_steps > 0) else random.uniform(0.60, 0.99)
    )
    negative_feedback = random.random() < (0.55 if not success else 0.02)

    user_id = random.choice(user_ids) if random.random() < 0.95 else None
    # anonymous rows (no user_id) can't be Telegram — Telegram always identifies the chat user
    platform = user_platforms[user_id] if user_id is not None else random.choice(PIP_APP_PLATFORMS)
    # voice channel only exists on the native app, never through Telegram's text/voice-note bot
    if platform == TELEGRAM_PLATFORM:
        channel = "chat"

    row = RequestMetadata(
        request_id=str(uuid.uuid4()),
        session_id=random.choice(session_ids),
        conversation_id=random.choice(conversation_ids) if random.random() < 0.9 else None,
        user_id=user_id,
        telegram_username=user_telegram_usernames.get(user_id) if user_id is not None else None,
        timestamp=random_timestamp(),
        model_used=model,
        provider=provider,
        intent=random.choice(INTENTS) if random.random() < 0.9 else None,
        category=category,
        route_fallback=escalation_steps > 0,
        manual_override=random.random() < 0.01,
        wrong_route=wrong_route,
        routing_confidence=round(routing_confidence, 4),
        escalation_steps=escalation_steps,
        escalation_path=escalation_path,
        query_text=pick_query_text(category),
        knowledge_source=knowledge_source,
        local_db_hit=knowledge_source == "local_db",
        memory_hit=knowledge_source == "memory",
        rag_hit=knowledge_source == "rag",
        cache_hit=knowledge_source == "cache",
        grounding_used=knowledge_source == "grounding",
        web_search_used=knowledge_source == "web_search",
        tool_called=tool_called,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=round((input_tokens + output_tokens) / 1000 * 0.002, 6) if is_cloud else None,
        success=success,
        error_type=random.choice(ERROR_TYPES) if not success else None,
        negative_feedback=negative_feedback,
        latency_ms=latency,
        first_token_latency_ms=max(5.0, latency * random.uniform(0.15, 0.4)),
        channel=channel,
        platform=platform,
        device=platform,
    )

    if channel == "voice":
        row.vad_time_ms = random.uniform(30, 150)
        row.turn_detection_time_ms = random.uniform(50, 400)
        row.stt_latency_ms = random.uniform(100, 600)
        row.first_audio_latency_ms = random.uniform(500, 1500)
        row.tts_latency_ms = random.uniform(200, 900)
        row.playback_latency_ms = random.uniform(20, 150)
        row.interrupt_count = random.choices([0, 1, 2, 3], weights=[70, 20, 7, 3], k=1)[0]
        row.false_end_of_utterance = random.random() < 0.03
        row.wake_word_detected = random.random() < 0.4

    return row


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=3500, help="number of mock request rows to insert")
    parser.add_argument("--reset", action="store_true", help="drop and recreate request_metadata before seeding")
    args = parser.parse_args()

    if args.reset:
        RequestMetadata.__table__.drop(engine, checkfirst=True)
        UserDirectory.__table__.drop(engine, checkfirst=True)
    Base.metadata.create_all(engine)

    user_ids = [f"user_{i:04d}" for i in range(N_USERS)]
    session_ids = [f"session_{i:04d}" for i in range(N_SESSIONS)]
    conversation_ids = [f"conv_{i:04d}" for i in range(N_CONVERSATIONS)]
    user_platforms = assign_user_platforms(user_ids)
    user_telegram_usernames = assign_telegram_usernames()

    db = SessionLocal()
    try:
        batch = []
        for i in range(args.rows):
            batch.append(
                make_row(user_ids, session_ids, conversation_ids, user_platforms, user_telegram_usernames)
            )
            if len(batch) >= 500:
                db.add_all(batch)
                db.commit()
                batch = []
        if batch:
            db.add_all(batch)
            db.commit()

        db.query(UserDirectory).delete()
        directory_rows = [
            UserDirectory(directory_id=username, platform=TELEGRAM_PLATFORM, telegram_username=username, user_id=uid)
            for username, uid in REAL_TELEGRAM_USERS
        ]
        telegram_linked_ids = {uid for _, uid in REAL_TELEGRAM_USERS if uid is not None}
        # No real app-user source identified yet — these entries mirror the mock
        # population already used above, tagged with platform, as a placeholder
        # until an actual pip-app user source is hooked up the same way Telegram's
        # config sheet was.
        directory_rows += [
            UserDirectory(directory_id=uid, platform=user_platforms[uid], telegram_username=None, user_id=uid)
            for uid in user_ids
            if uid not in telegram_linked_ids
        ]
        db.add_all(directory_rows)
        db.commit()

        # Live config, not disposable mock data — only seed defaults once,
        # never overwrite edits made via the Config tab on subsequent reseeds.
        intent_config_count = db.query(IntentConfig).count()
        if intent_config_count == 0:
            now = datetime.now(timezone.utc)
            db.add_all(
                IntentConfig(
                    intent=intent,
                    chain=[{"provider": provider, "model": model}]
                    + ([{"provider": provider, "model": fallback}] if fallback else []),
                    priority=priority,
                    confidence_threshold=threshold,
                    updated_at=now,
                )
                for intent, model, provider, priority, threshold, fallback in DEFAULT_INTENT_CONFIGS
            )
            db.commit()
            intent_config_count = len(DEFAULT_INTENT_CONFIGS)
    finally:
        db.close()

    print(
        f"Seeded {args.rows} request_metadata rows, {len(directory_rows)} user_directory rows, "
        f"{intent_config_count} intent_config rows."
    )


if __name__ == "__main__":
    main()
