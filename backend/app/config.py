from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/pip_voice_ai_dashboard"
    cors_origins: list[str] = ["http://localhost:3000"]
    events_api_key: str  # required — the pip app / Telegram bot's shared secret for POST /events
    # required — Fernet key encrypting model_registry.api_key_encrypted at rest.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Losing/rotating this key makes previously-saved API keys undecryptable —
    # back it up like any other secret, don't regenerate casually.
    model_registry_encryption_key: str
    # Local sibling project (same machine, same L-casemx workspace) whose
    # pipctl.sh this backend shells out to for the Settings page's server
    # control panel (start/stop/restart the merged bot+Pip backend). Safe to
    # run from THIS process specifically because it's a separate process
    # from the one being restarted — see app/routers/pip_server_control.py.
    pipctl_dir: str = "/Users/rakka/Documents/L-casemx/bpjs-pending-bot-local"
    # Local sibling project (same machine, same L-casemx workspace) that the
    # Settings page's "Pip Mobile App" panel builds/runs/clears — see
    # app/routers/mobile_devtools.py. Unrelated to pipctl_dir above: that one
    # is the bpjs bot's backend process, this one is the pipvoice KMP mobile
    # app (Android + iOS) source tree.
    pipvoice_dir: str = "/Users/rakka/Documents/L-casemx/pipvoice"
    android_sdk_dir: str = "/Users/rakka/Library/Android/sdk"
    # bpjs-pending-bot-local's dashboard_api.py (port 8000, HTTP Basic Auth) —
    # used by app/services/provider_health_sync.py to poll GET
    # /api/dashboard/provider-status directly (this backend calling that API
    # itself, unlike the frontend's proxy route which forwards a browser
    # request). Same credentials as frontend/.env.local's BOT_API_URL/
    # BOT_DASHBOARD_USER/BOT_DASHBOARD_PASSWORD — two separate consumers of
    # the same bot API, not a shared DB connection. Left blank-default (never
    # required) so a dashboard checkout with no bpjs sibling configured just
    # skips the sync silently, same best-effort spirit as
    # bpjs-pending-bot-local's own model_registry_client.py in the other
    # direction.
    bot_api_url: str = "http://localhost:8000"
    bot_dashboard_user: str = ""
    bot_dashboard_password: str = ""
    provider_health_sync_interval_seconds: int = 30


settings = Settings()
