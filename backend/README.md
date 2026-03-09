# Machine Guardian AI Backend

FastAPI backend for Machine Guardian AI with TimescaleDB, JWT auth/RBAC, telemetry ingest, alerts, AI chat, analytics, and agent download.

## Quick start

1. Copy env file:

```bash
cd backend
cp .env.example .env
```

2. Start DB + backend with Docker:

```bash
docker compose up --build
```

Backend runs at `http://localhost:8000`.

## Default seeded users

- admin / admin123
- engineer / engineer123
- viewer / viewer123

On first startup, a default agent API key is printed in backend logs as:

`[seed] default agent api key: ...`

## Key routes

- `POST /auth/login`
- `GET /devices`
- `POST /devices`
- `GET /devices/{id}/telemetry/latest`
- `GET /devices/{id}/telemetry/history`
- `POST /devices/{id}/insights/generate`
- `GET /alerts/{id}`
- `PUT /alerts/{id}`
- `WS /ws/telemetry/{deviceId}`
- `POST /telemetry/ingest`
- `POST /ai/chat`
- `GET /agent/download`
- `GET /agent/install/windows`
- `GET /agent/install/linux`
- `GET /agent/install/macos`

Versioned aliases also exist under `/api/v1/*`.

## Agent rollout

1. Download agent: `GET /agent/download`
2. Run setup wizard on client:

```bash
python guardian-agent.py --setup
python guardian-agent.py --check
```

3. Install startup service script from backend:
- Windows PowerShell: `GET /agent/install/windows`
- Linux systemd script: `GET /agent/install/linux`
- macOS launchd script: `GET /agent/install/macos`

Agent supports:
- TLS verification (`verify_tls`, `ca_cert_path`)
- Offline queue (`queue_db_path`, `max_queue_items`)
- Retry with exponential backoff

## Notes

- If Timescale extension is unavailable, app still runs with regular PostgreSQL table.
- Set `CLAUDE_API_KEY` in `.env` for real AI responses.
- Set SMTP/Webhook env vars to enable notifications.
- Set `ENFORCE_HTTPS_INGEST=true` in production behind HTTPS reverse proxy.
