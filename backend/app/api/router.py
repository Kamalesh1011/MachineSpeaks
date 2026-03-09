from fastapi import APIRouter

from app.api.routes import auth, devices, telemetry, alerts, ai, agent, users, settings, analytics


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(devices.router)
api_router.include_router(telemetry.router)
api_router.include_router(alerts.router)
api_router.include_router(ai.router)
api_router.include_router(agent.router)
api_router.include_router(users.router)
api_router.include_router(settings.router)
api_router.include_router(analytics.router)
