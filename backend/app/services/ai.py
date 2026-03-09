import json
import httpx
from fastapi import HTTPException
from app.core.config import get_settings


settings = get_settings()


SYSTEM_PROMPT = (
    "You are Machine Guardian AI, an expert machine health analyst. "
    "Analyze real-time telemetry and give concise, actionable insights. "
    "Flag critical issues urgently."
)


def build_auto_prompt(device_name: str, telemetry_json: str) -> str:
    return (
        f"Analyze telemetry for {device_name}: {telemetry_json}. "
        "Return JSON: [{severity, title, explanation, recommendation}]"
    )


async def claude_chat(message: str, context: dict | None = None) -> str:
    if not settings.CLAUDE_API_KEY:
        return "Claude API key not configured."

    payload = {
        "model": settings.CLAUDE_MODEL,
        "max_tokens": 500,
        "system": SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": f"Context: {json.dumps(context or {})}\nUser: {message}",
            }
        ],
    }

    headers = {
        "x-api-key": settings.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=40) as client:
        resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)

    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Claude API error: {resp.text}")

    data = resp.json()
    blocks = data.get("content", [])
    return "\n".join(block.get("text", "") for block in blocks if block.get("type") == "text")


async def generate_auto_insight(device_name: str, telemetry_dict: dict) -> list[dict]:
    if not settings.CLAUDE_API_KEY:
        return [
            {
                "severity": "info",
                "title": "Demo insight",
                "explanation": "Claude API key is not configured; generated fallback insight.",
                "recommendation": "Set CLAUDE_API_KEY in backend/.env",
            }
        ]

    prompt = build_auto_prompt(device_name, json.dumps(telemetry_dict))
    text = await claude_chat(prompt)

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except Exception:
        pass

    return [
        {
            "severity": "info",
            "title": "AI insight",
            "explanation": text,
            "recommendation": "Review telemetry trend and verify thresholds.",
        }
    ]
