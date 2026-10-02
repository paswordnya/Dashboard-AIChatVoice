"""Real outbound HTTP calls used by the Model Management console (§22) to
back Test Connection / Validate Model / Test Model with actual network
behavior instead of a canned success response — this dashboard has no live
AI Router to delegate to (see CLAUDE.md: pip Voice AI is still a design
blueprint), so these probes are the only honest way to tell an Administrator
whether a model they just registered is actually reachable.

Uses stdlib urllib rather than adding an HTTP client dependency — these are
low-volume, admin-triggered calls, not a hot path.
"""

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional


@dataclass
class ProbeResult:
    ok: bool
    status_code: Optional[int]
    latency_ms: float
    message: str


def _http(
    url: str, headers: dict[str, str], timeout_s: float, method: str = "GET"
) -> tuple[Optional[int], Optional[bytes], Optional[str], float]:
    req = urllib.request.Request(url, headers=headers, method=method)
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            return resp.status, resp.read(), None, (time.monotonic() - start) * 1000
    except urllib.error.HTTPError as e:
        return e.code, e.read(), str(e.reason), (time.monotonic() - start) * 1000
    except urllib.error.URLError as e:
        return None, None, str(e.reason), (time.monotonic() - start) * 1000
    except TimeoutError:
        return None, None, "timed out", (time.monotonic() - start) * 1000


def test_connection(api_base_url: str, timeout_s: float = 5.0) -> ProbeResult:
    """Unauthenticated reachability probe — is anything listening at
    api_base_url at all. A 4xx still counts as reachable (the server
    responded); only network failure / timeout / 5xx count as unreachable."""
    status, _, error, latency_ms = _http(api_base_url, headers={}, timeout_s=timeout_s)
    if status is None:
        return ProbeResult(ok=False, status_code=None, latency_ms=latency_ms, message=error or "unreachable")
    if status >= 500:
        return ProbeResult(ok=False, status_code=status, latency_ms=latency_ms, message=error or f"HTTP {status}")
    return ProbeResult(ok=True, status_code=status, latency_ms=latency_ms, message="Reachable")


def _auth_headers(provider: str, api_key: Optional[str]) -> dict[str, str]:
    if not api_key:
        return {}
    if provider == "anthropic":
        return {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    if provider == "azure_openai":
        return {"api-key": api_key}
    if provider == "gemini":
        return {}  # gemini auth travels as a ?key= query param instead
    return {"Authorization": f"Bearer {api_key}"}  # openai, openrouter, lmstudio, ollama, custom_openai_compatible


def validate_model(
    provider: str,
    api_base_url: str,
    api_key: Optional[str],
    model_identifier: str,
    timeout_s: float = 8.0,
) -> ProbeResult:
    """Authenticated probe that also checks model_identifier resolves.

    OpenAI-compatible providers (openai, openrouter, lmstudio, ollama,
    custom_openai_compatible, azure_openai) and Anthropic all expose a
    GET .../models list shaped like {"data": [{"id": ...}, ...]} — fetch it
    and check model_identifier is present. Gemini's shape is different
    (GET .../models/{id} resolves a single model directly), so it gets its
    own branch. If the list call itself fails (network/auth error), that
    failure is returned as-is — we can't say anything about the identifier
    without a successful list.
    """
    base = api_base_url.rstrip("/")

    if provider == "gemini":
        url = f"{base}/models/{model_identifier}"
        if api_key:
            url += f"?key={api_key}"
        status, body, error, latency_ms = _http(url, headers={}, timeout_s=timeout_s)
        if status == 200:
            return ProbeResult(ok=True, status_code=status, latency_ms=latency_ms, message=f"Model '{model_identifier}' resolved")
        return ProbeResult(ok=False, status_code=status, latency_ms=latency_ms, message=_error_message(body) or error or f"HTTP {status}")

    if provider == "azure_openai":
        url = f"{base}/openai/models?api-version=2024-02-01"
    else:
        url = f"{base}/models"

    status, body, error, latency_ms = _http(url, headers=_auth_headers(provider, api_key), timeout_s=timeout_s)
    if status != 200:
        return ProbeResult(ok=False, status_code=status, latency_ms=latency_ms, message=_error_message(body) or error or (f"HTTP {status}" if status else "unreachable"))

    ids = _extract_model_ids(body)
    if ids is None:
        # List call succeeded but the response wasn't the shape we expect —
        # still real signal (key + base URL work), just can't confirm the
        # exact identifier.
        return ProbeResult(ok=True, status_code=status, latency_ms=latency_ms, message="Connection & auth OK — could not parse model list to confirm the identifier")
    if model_identifier in ids:
        return ProbeResult(ok=True, status_code=status, latency_ms=latency_ms, message=f"Model '{model_identifier}' found in provider's model list")
    return ProbeResult(ok=False, status_code=status, latency_ms=latency_ms, message=f"Connection & auth OK, but '{model_identifier}' is not in the provider's model list")


def _extract_model_ids(body: Optional[bytes]) -> Optional[list[str]]:
    if not body:
        return None
    try:
        parsed = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    items = parsed.get("data") if isinstance(parsed, dict) else None
    if not isinstance(items, list):
        return None
    return [item.get("id") for item in items if isinstance(item, dict) and "id" in item]


@dataclass
class TestPromptResult:
    ok: bool
    response_text: Optional[str]
    latency_ms: float
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    error: Optional[str]


def _http_json(
    url: str, headers: dict[str, str], payload: dict, timeout_s: float
) -> tuple[Optional[int], Optional[bytes], Optional[str], float]:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, headers={**headers, "Content-Type": "application/json"}, data=body, method="POST"
    )
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            return resp.status, resp.read(), None, (time.monotonic() - start) * 1000
    except urllib.error.HTTPError as e:
        return e.code, e.read(), str(e.reason), (time.monotonic() - start) * 1000
    except urllib.error.URLError as e:
        return None, None, str(e.reason), (time.monotonic() - start) * 1000
    except TimeoutError:
        return None, None, "timed out", (time.monotonic() - start) * 1000


def run_test_prompt(
    provider: str,
    api_base_url: str,
    api_key: Optional[str],
    model_identifier: str,
    prompt: str,
    timeout_s: float = 30.0,
    max_tokens: int = 256,
) -> TestPromptResult:
    """§15 Test Model — send a real prompt to the registered model and
    report back what actually came back. cost_usd is deliberately not
    computed here: the Add Model form has no pricing field, so a dollar
    figure would be fabricated; the caller surfaces cost as unknown."""
    base = api_base_url.rstrip("/")

    if provider == "gemini":
        url = f"{base}/models/{model_identifier}:generateContent"
        if api_key:
            url += f"?key={api_key}"
        payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"maxOutputTokens": max_tokens}}
        status, body, error, latency_ms = _http_json(url, headers={}, payload=payload, timeout_s=timeout_s)
        if status != 200:
            return TestPromptResult(False, None, latency_ms, None, None, _error_message(body) or error or f"HTTP {status}")
        parsed = json.loads(body)
        text = parsed.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
        usage = parsed.get("usageMetadata", {})
        return TestPromptResult(True, text, latency_ms, usage.get("promptTokenCount"), usage.get("candidatesTokenCount"), None)

    if provider == "anthropic":
        url = f"{base}/messages"
        headers = _auth_headers(provider, api_key)
        payload = {"model": model_identifier, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
        status, body, error, latency_ms = _http_json(url, headers=headers, payload=payload, timeout_s=timeout_s)
        if status != 200:
            return TestPromptResult(False, None, latency_ms, None, None, _error_message(body) or error or f"HTTP {status}")
        parsed = json.loads(body)
        text = (parsed.get("content") or [{}])[0].get("text")
        usage = parsed.get("usage", {})
        return TestPromptResult(True, text, latency_ms, usage.get("input_tokens"), usage.get("output_tokens"), None)

    # openai, openrouter, lmstudio, ollama, custom_openai_compatible, azure_openai
    if provider == "azure_openai":
        url = f"{base}/openai/deployments/{model_identifier}/chat/completions?api-version=2024-02-01"
    else:
        url = f"{base}/chat/completions"
    headers = _auth_headers(provider, api_key)
    payload = {"model": model_identifier, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens}
    status, body, error, latency_ms = _http_json(url, headers=headers, payload=payload, timeout_s=timeout_s)
    if status != 200:
        return TestPromptResult(False, None, latency_ms, None, None, _error_message(body) or error or f"HTTP {status}")
    parsed = json.loads(body)
    text = (parsed.get("choices") or [{}])[0].get("message", {}).get("content")
    usage = parsed.get("usage", {})
    return TestPromptResult(True, text, latency_ms, usage.get("prompt_tokens"), usage.get("completion_tokens"), None)


def _error_message(body: Optional[bytes]) -> Optional[str]:
    if not body:
        return None
    try:
        parsed = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    err = parsed.get("error") if isinstance(parsed, dict) else None
    if isinstance(err, dict):
        return err.get("message")
    if isinstance(err, str):
        return err
    return None
