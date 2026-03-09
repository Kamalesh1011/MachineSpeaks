import hashlib
import secrets
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.models.device import Device
from app.models.alert import Alert
from app.models.settings import AppSetting
from app.models.api_key import APIKey


DEFAULT_THRESHOLDS = {
    "cpu_temp": {"warning": 75, "critical": 90},
    "gpu_temp": {"warning": 85, "critical": 92},
    "memory_util": {"warning": 85, "critical": 95},
    "vibration": {"warning": 2.5, "critical": 4.0},
    "cpu_util": {"warning": 85, "critical": 95},
    "gpu_util": {"warning": 90, "critical": 98},
}


DEMO_DEVICES = [
    {"external_id": "srv-001", "name": "Production Server Alpha", "type": "server", "location": "Data Center A", "ip": "192.168.1.101"},
    {"external_id": "srv-002", "name": "Production Server Beta", "type": "server", "location": "Data Center A", "ip": "192.168.1.102"},
    {"external_id": "gpu-001", "name": "ML Training Workstation", "type": "gpu-workstation", "location": "Lab B", "ip": "192.168.2.50"},
    {"external_id": "mot-001", "name": "Conveyor Motor Unit 3", "type": "industrial-motor", "location": "Factory Floor", "ip": "10.0.3.20"},
    {"external_id": "cnc-001", "name": "CNC Mill Station 7", "type": "cnc-machine", "location": "Manufacturing Bay", "ip": "10.0.4.15"},
    {"external_id": "net-001", "name": "Core Network Switch", "type": "network-switch", "location": "Server Room B", "ip": "192.168.0.1"},
]


def seed_database(db: Session) -> str:
    if db.query(User).count() == 0:
        db.add_all(
            [
                User(username="admin", email="admin@guardian.local", hashed_password=hash_password("admin123"), role="admin", is_active=True),
                User(username="engineer", email="engineer@guardian.local", hashed_password=hash_password("engineer123"), role="engineer", is_active=True),
                User(username="viewer", email="viewer@guardian.local", hashed_password=hash_password("viewer123"), role="viewer", is_active=True),
            ]
        )

    if db.query(AppSetting).count() == 0:
        db.add(AppSetting(retention_days=90, default_thresholds=DEFAULT_THRESHOLDS))

    if db.query(Device).count() == 0:
        for item in DEMO_DEVICES:
            db.add(Device(**item, connection_method="agent", thresholds=DEFAULT_THRESHOLDS, specs={"cpu": "demo", "memory_gb": 64}))

    if db.query(Alert).count() == 0:
        now = datetime.utcnow()
        first = db.query(Device).filter(Device.external_id == "mot-001").first()
        if first:
            db.add(
                Alert(
                    device_id=first.id,
                    severity="critical",
                    metric="vibration",
                    value="4.7",
                    threshold="4.0",
                    message="Vibration exceeds critical threshold",
                    status="active",
                    created_at=now,
                    updated_at=now,
                )
            )

    plain_key = ""
    if db.query(APIKey).count() == 0:
        plain_key = "mg_" + secrets.token_urlsafe(24)
        db.add(APIKey(name="default-agent", key_hash=hash_password(plain_key), is_active=True))

    db.commit()
    return plain_key


def make_api_key_name() -> str:
    return f"key-{hashlib.sha1(secrets.token_bytes(10)).hexdigest()[:8]}"
