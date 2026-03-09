import re
import secrets

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.core.security import hash_password
from app.models.api_key import APIKey
from app.services.agent_template import (
    AGENT_TEMPLATE,
    WINDOWS_INSTALL_SCRIPT,
    LINUX_INSTALL_SCRIPT,
    MACOS_INSTALL_SCRIPT,
)


router = APIRouter(prefix="/agent", tags=["agent"])


class ProvisionPayload(BaseModel):
    device_external_id: str = Field(min_length=3, max_length=64)
    os_name: str = Field(default="windows")
    consent_accepted: bool = Field(default=False)


def _sanitize_device_external_id(value: str) -> str:
    out = re.sub(r"[^a-z0-9-]+", "-", value.strip().lower()).strip("-")
    return out[:64] if out else "device"


@router.get("/download")
def download_agent():
    return PlainTextResponse(
        AGENT_TEMPLATE,
        media_type="text/x-python",
        headers={"Content-Disposition": "attachment; filename=guardian-agent.py"},
    )


@router.post("/provision")
def provision_agent_install(
    payload: ProvisionPayload,
    request: Request,
    db: Session = Depends(get_db),
    _: object = Depends(require_role("engineer")),
):
    if not payload.consent_accepted:
        return {"ok": False, "detail": "Consent must be accepted before provisioning agent install."}

    device_external_id = _sanitize_device_external_id(payload.device_external_id)
    os_name = payload.os_name.strip().lower()
    if os_name not in {"windows", "linux", "macos"}:
        os_name = "windows"

    plain_key = "mg_" + secrets.token_urlsafe(24)
    key_name = f"agent-{device_external_id}-{secrets.token_hex(4)}"
    row = APIKey(name=key_name, key_hash=hash_password(plain_key), is_active=True)
    db.add(row)
    db.commit()
    db.refresh(row)

    server_url = str(request.base_url).rstrip("/")
    windows_script_url = f"{server_url}/agent/install/windows"
    linux_script_url = f"{server_url}/agent/install/linux"
    macos_script_url = f"{server_url}/agent/install/macos"

    windows_commands = [
        f"Invoke-WebRequest -Uri '{windows_script_url}' -OutFile install-agent.ps1",
        f"powershell -ExecutionPolicy Bypass -File .\\install-agent.ps1 -ServerUrl '{server_url}' -ApiKey '{plain_key}' -DeviceId '{device_external_id}'",
    ]
    linux_commands = [
        f"curl -fsSL '{linux_script_url}' -o install-agent.sh",
        f"sudo bash install-agent.sh '{server_url}' '{plain_key}' '{device_external_id}'",
    ]
    macos_commands = [
        f"curl -fsSL '{macos_script_url}' -o install-agent-macos.sh",
        f"bash install-agent-macos.sh '{server_url}' '{plain_key}' '{device_external_id}'",
    ]

    install_by_os = {
        "windows": {"script_url": windows_script_url, "commands": windows_commands},
        "linux": {"script_url": linux_script_url, "commands": linux_commands},
        "macos": {"script_url": macos_script_url, "commands": macos_commands},
    }

    return {
        "ok": True,
        "api_key": plain_key,
        "api_key_name": key_name,
        "server_url": server_url,
        "device_external_id": device_external_id,
        "selected_os": os_name,
        "install": install_by_os,
        "selected_install": install_by_os[os_name],
        "permissions_notice": "Agent installation requires local administrator/root privileges on the target device.",
        "telemetry_notice": "After installation, telemetry is collected on-device and streamed automatically.",
    }


@router.get("/config-template")
def agent_config_template():
    return {
        "server_url": "https://your-jetson-host:8000",
        "api_key": "replace_with_agent_api_key",
        "device_external_id": "optional-device-id",
        "interval_seconds": 2,
        "request_timeout": 10,
        "verify_tls": True,
        "ca_cert_path": "",
        "queue_db_path": "guardian-agent-queue.db",
        "max_queue_items": 10000,
    }


@router.get("/install/windows")
def windows_install_script():
    return PlainTextResponse(
        WINDOWS_INSTALL_SCRIPT,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=install-agent.ps1"},
    )


@router.get("/install/linux")
def linux_install_script():
    return PlainTextResponse(
        LINUX_INSTALL_SCRIPT,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=install-agent.sh"},
    )


@router.get("/install/macos")
def macos_install_script():
    return PlainTextResponse(
        MACOS_INSTALL_SCRIPT,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=install-agent-macos.sh"},
    )
