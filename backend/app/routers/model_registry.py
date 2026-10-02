from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import provider_probe
from app.db import get_db
from app.models import ModelDefaultAssignment, ModelRegistry
from app.security import decrypt_api_key, encrypt_api_key

router = APIRouter(prefix="/config/models", tags=["config"])

Provider = Literal[
    "lmstudio", "ollama", "gemini", "openai", "anthropic", "openrouter", "azure_openai", "custom_openai_compatible"
]
Status = Literal["active", "inactive", "maintenance", "deprecated", "experimental"]


class ModelRegistryOut(BaseModel):
    model_name: str
    display_name: str
    provider: Provider
    api_base_url: str
    has_api_key: bool
    model_identifier: str
    version: Optional[str]
    context_window: Optional[int]
    max_output_tokens: Optional[int]
    timeout_ms: Optional[int]
    supports_streaming: bool
    supports_vision: bool
    supports_function_calling: bool
    supports_json_mode: bool
    supports_embedding: bool
    status: Status
    # Non-null when app/services/provider_health_sync.py (not an admin)
    # deactivated this row because its provider is currently cooling down —
    # "auth" | "quota" | "server_error" | "network". Read-only here; not
    # settable through ModelRegistryCreate/Update.
    auto_deactivated_reason: Optional[str]
    created_at: str
    updated_at: str


class ModelRegistryCreate(BaseModel):
    model_name: str
    display_name: str
    provider: Provider
    api_base_url: str
    api_key: Optional[str] = None
    model_identifier: str
    version: Optional[str] = None
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None
    timeout_ms: Optional[int] = None
    supports_streaming: bool = False
    supports_vision: bool = False
    supports_function_calling: bool = False
    supports_json_mode: bool = False
    supports_embedding: bool = False
    # Save (Save button) leaves the model "inactive"; Save & Activate sets
    # this true so it's immediately eligible for AI Router selection.
    activate: bool = False


class ModelRegistryUpdate(BaseModel):
    display_name: Optional[str] = None
    provider: Optional[Provider] = None
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None  # omitted = keep existing key; "" is rejected, not "clear the key"
    model_identifier: Optional[str] = None
    version: Optional[str] = None
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None
    timeout_ms: Optional[int] = None
    supports_streaming: Optional[bool] = None
    supports_vision: Optional[bool] = None
    supports_function_calling: Optional[bool] = None
    supports_json_mode: Optional[bool] = None
    supports_embedding: Optional[bool] = None
    status: Optional[Status] = None


class TestConnectionRequest(BaseModel):
    api_base_url: str


class ProbeResponse(BaseModel):
    ok: bool
    status_code: Optional[int]
    latency_ms: float
    message: str


class ValidateModelRequest(BaseModel):
    provider: Provider
    api_base_url: str
    api_key: Optional[str] = None
    model_identifier: str


class TestPromptRequest(BaseModel):
    prompt: str


class TestPromptResponse(BaseModel):
    ok: bool
    response_text: Optional[str]
    latency_ms: float
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    cost_usd: Optional[float]  # always null — no pricing field on the model, never fabricated
    health_status: Literal["ok", "error"]
    error: Optional[str]


def _to_out(row: ModelRegistry) -> ModelRegistryOut:
    return ModelRegistryOut(
        model_name=row.model_name,
        display_name=row.display_name,
        provider=row.provider,
        api_base_url=row.api_base_url,
        has_api_key=row.api_key_encrypted is not None,
        model_identifier=row.model_identifier,
        version=row.version,
        context_window=row.context_window,
        max_output_tokens=row.max_output_tokens,
        timeout_ms=row.timeout_ms,
        supports_streaming=row.supports_streaming,
        supports_vision=row.supports_vision,
        supports_function_calling=row.supports_function_calling,
        supports_json_mode=row.supports_json_mode,
        supports_embedding=row.supports_embedding,
        status=row.status,
        auto_deactivated_reason=row.auto_deactivated_reason,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


@router.get("", response_model=list[ModelRegistryOut])
def list_models(db: Session = Depends(get_db)) -> list[ModelRegistryOut]:
    """§ Active Models — every registered model, any status."""
    rows = db.execute(select(ModelRegistry).order_by(ModelRegistry.display_name)).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=ModelRegistryOut, status_code=201)
def create_model(payload: ModelRegistryCreate, db: Session = Depends(get_db)) -> ModelRegistryOut:
    """§ Add New Model. Save & Activate (activate=true) makes it immediately
    eligible for AI Router selection; Save alone leaves it inactive."""
    if db.get(ModelRegistry, payload.model_name) is not None:
        raise HTTPException(status_code=409, detail=f"Model '{payload.model_name}' already exists")

    now = datetime.now(timezone.utc)
    row = ModelRegistry(
        model_name=payload.model_name,
        display_name=payload.display_name,
        provider=payload.provider,
        api_base_url=payload.api_base_url,
        api_key_encrypted=encrypt_api_key(payload.api_key) if payload.api_key else None,
        model_identifier=payload.model_identifier,
        version=payload.version,
        context_window=payload.context_window,
        max_output_tokens=payload.max_output_tokens,
        timeout_ms=payload.timeout_ms,
        supports_streaming=payload.supports_streaming,
        supports_vision=payload.supports_vision,
        supports_function_calling=payload.supports_function_calling,
        supports_json_mode=payload.supports_json_mode,
        supports_embedding=payload.supports_embedding,
        status="active" if payload.activate else "inactive",
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    return _to_out(row)


@router.patch("/{model_name}", response_model=ModelRegistryOut)
def update_model(model_name: str, payload: ModelRegistryUpdate, db: Session = Depends(get_db)) -> ModelRegistryOut:
    """Covers §13 Enable/Disable (PATCH {"status": "active" | "inactive"})
    as well as general field edits — all take effect on the next request,
    no restart."""
    row = db.get(ModelRegistry, model_name)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")

    updates = payload.model_dump(exclude_unset=True)
    api_key = updates.pop("api_key", None)
    if api_key is not None:
        if not api_key:
            raise HTTPException(status_code=422, detail="api_key cannot be set to an empty string")
        row.api_key_encrypted = encrypt_api_key(api_key)
    for field, value in updates.items():
        setattr(row, field, value)
    if "status" in updates:
        # A human explicitly set status — that's a manual decision now,
        # overriding whatever provider_health_sync.py last recorded here.
        row.auto_deactivated_reason = None
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_out(row)


@router.delete("/{model_name}", status_code=204)
def delete_model(model_name: str, db: Session = Depends(get_db)) -> None:
    row = db.get(ModelRegistry, model_name)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")

    default_use_cases = db.execute(
        select(ModelDefaultAssignment.use_case).where(ModelDefaultAssignment.model_name == model_name)
    ).scalars().all()
    if default_use_cases:
        raise HTTPException(
            status_code=409,
            detail=f"Model '{model_name}' is the default for: {', '.join(default_use_cases)} — reassign those before deleting",
        )

    db.delete(row)
    db.commit()


@router.post("/test-connection", response_model=ProbeResponse)
def test_connection(payload: TestConnectionRequest) -> ProbeResponse:
    """§ Add New Model → Test Connection. Unauthenticated reachability probe
    against api_base_url, run before the model is saved."""
    result = provider_probe.test_connection(payload.api_base_url)
    return ProbeResponse(ok=result.ok, status_code=result.status_code, latency_ms=result.latency_ms, message=result.message)


@router.post("/validate", response_model=ProbeResponse)
def validate_model(payload: ValidateModelRequest) -> ProbeResponse:
    """§ Add New Model → Validate Model. Authenticated probe that also
    checks model_identifier resolves against the provider — run before the
    model is saved, using the form's not-yet-persisted values directly."""
    result = provider_probe.validate_model(payload.provider, payload.api_base_url, payload.api_key, payload.model_identifier)
    return ProbeResponse(ok=result.ok, status_code=result.status_code, latency_ms=result.latency_ms, message=result.message)


@router.post("/{model_name}/test", response_model=TestPromptResponse)
def test_model(model_name: str, payload: TestPromptRequest, db: Session = Depends(get_db)) -> TestPromptResponse:
    """§15 Test Model — Input Prompt → this saved model → Response, Latency,
    Token, Cost, Health Status. Not logged to request_metadata: this is an
    ad hoc admin probe, not real production traffic."""
    row = db.get(ModelRegistry, model_name)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")

    api_key = decrypt_api_key(row.api_key_encrypted) if row.api_key_encrypted else None
    result = provider_probe.run_test_prompt(
        row.provider, row.api_base_url, api_key, row.model_identifier, payload.prompt,
        timeout_s=(row.timeout_ms / 1000) if row.timeout_ms else 30.0,
    )
    return TestPromptResponse(
        ok=result.ok,
        response_text=result.response_text,
        latency_ms=result.latency_ms,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_usd=None,
        health_status="ok" if result.ok else "error",
        error=result.error,
    )
