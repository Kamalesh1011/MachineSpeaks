from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import Base, engine, SessionLocal
import app.models  # noqa: F401
from app.services.seed import seed_database
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.websocket_manager import ws_manager


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb"))
            conn.execute(
                text(
                    "SELECT create_hypertable('telemetry', 'ts', if_not_exists => TRUE, migrate_data => TRUE);"
                )
            )
        except Exception:
            # Running without TimescaleDB extension is allowed for local fallback.
            pass

    if settings.ENABLE_DEMO_SEED:
        db = SessionLocal()
        try:
            api_key = seed_database(db)
            if api_key:
                print(f"[seed] default agent api key: {api_key}")
        finally:
            db.close()

    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Primary API routes (as requested in prompt)
app.include_router(api_router)
# Optional versioned alias for clients
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def health():
    return {"service": settings.APP_NAME, "status": "ok"}


@app.websocket("/ws/telemetry/{device_id}")
async def telemetry_ws(websocket: WebSocket, device_id: int):
    await ws_manager.connect(device_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(device_id, websocket)
