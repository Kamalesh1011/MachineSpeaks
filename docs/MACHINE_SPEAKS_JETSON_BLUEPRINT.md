# Machine Speaks Jetson Blueprint

## 1) Product Goal

Build `Machine Speaks` as an edge-first monitoring platform where:

1. Software/hardware-capable devices run an agent and stream telemetry.
2. Hardware-only devices stream sensor data through gateways.
3. Jetson Nano hosts ingestion, analytics, SLM reasoning, taxonomy, and alerting.
4. Users receive proactive warnings by UI + voice.

## 2) Recommended Deployment Model

Use Jetson Nano as the **edge hub**.

### Jetson runs

1. `machine-speaks-api` (device registry, telemetry ingest, alerts, auth, UI API)
2. `machine-speaks-web` (frontend)
3. `slm-reasoner` (your SLM service + verification + taxonomy)
4. `postgres` (metadata + telemetry)
5. Optional: `redis` (queue/cache), `mosquitto` (MQTT for sensors)

### Connectivity

1. Primary data path: same network over `HTTPS`/`MQTT`, not Bluetooth.
2. Bluetooth can be optional for first-time pairing/provisioning only.
3. Jetson should have a static LAN IP.

## 3) Software Device Flow (PC/Server/GPU Workstation)

1. User opens web app.
2. User clicks `Install Agent`.
3. Agent is installed on target machine (Windows/Linux/macOS).
4. Agent collects local telemetry (CPU/GPU/memory/temp/processes/disk/net).
5. Agent sends telemetry to Jetson ingest endpoint.
6. Jetson forwards normalized telemetry to SLM diagnostics endpoint.
7. SLM returns diagnosis, risk, recommended action, and friendly voice message.
8. Alert engine stores event and pushes UI + speech.

### How to fetch telemetry from Jetson itself

Install the same agent on Jetson (`device_external_id=jetson-nano-01`) so Jetson self-monitors.

## 4) Hardware-Only Device Flow (Fan Demo First)

1. Sensors connected to MCU/edge gateway (ESP32/Arduino/RPi).
2. Gateway publishes sensor packets to Jetson (`MQTT` preferred) or REST ingest.
3. Jetson preprocessing computes required model features.
4. SLM/bearing-fault pipeline performs classification + reasoning.
5. Verification layer checks safety policy.
6. Voice + dashboard notify user.

### Fan demo recommended sensors

1. Vibration (accelerometer)
2. RPM (hall/tach)
3. Motor current
4. Motor casing temperature
5. Optional acoustic mic

## 5) Voice Interaction Requirement

You need two channels:

1. Input (mic): user asks condition questions.
2. Output (speaker): SLM speaks alerts/recommendations.

### Practical implementation

1. POC: browser mic + browser speech synthesis (already close to your setup).
2. Production edge: Jetson local STT + TTS service:
   1. STT: Whisper/Faster-Whisper
   2. TTS: Piper/Coqui
   3. Audio output through Jetson speaker
3. Keep both modes:
   1. Browser voice for remote users
   2. Jetson local voice for on-site operator station

## 6) Baseline Learning (Critical)

Yes, you must feed normal states per machine.

### Baseline policy

1. Every new device starts in `learning` mode.
2. Collect 24-72 hours of normal telemetry (or validated normal windows).
3. Build per-device baseline profile:
   1. mean/std
   2. percentile bands (p50/p90/p95/p99)
   3. trend slope bounds
4. Alerts use deviation from device baseline + absolute safety thresholds.
5. Do not update baseline during active anomaly/fault windows.

## 7) What to Store

## 7.1 In database

1. `devices`
2. `telemetry`
3. `alerts`
4. `insights`
5. `fault_taxonomy` (versioned)
6. `baseline_profiles` (per device + model version)
7. `inference_events` (input hash, output, latency, model/taxonomy version)
8. `feedback_events` (operator confirmations/corrections)
9. `agent_heartbeats`
10. `voice_events` (what was spoken, when, severity)

## 7.2 On disk (Jetson)

1. `/opt/machine-speaks/models/` (model files, checksums)
2. `/opt/machine-speaks/taxonomy/` (json versions)
3. `/opt/machine-speaks/config/` (env + policy)
4. `/opt/machine-speaks/logs/` (rotated app logs)
5. `/opt/machine-speaks/backups/` (db and taxonomy snapshots)

## 8) Suggested API Contract (Minimal)

1. `POST /telemetry/ingest` (agent telemetry)
2. `POST /telemetry/hardware/ingest` (sensor packets)
3. `POST /api/analyze-system-telemetry` (SLM system reasoning)
4. `POST /api/analyze-bearing-window` (current hardware model path)
5. `POST /api/chat` (friendly condition Q&A)
6. `WS /ws/telemetry/{device_id}` (live updates)

## 9) What You Are Lacking Right Now

1. Per-device baseline storage + training/update API.
2. Unified schema for software telemetry and hardware telemetry.
3. Hardware gateway service (MQTT consumer to feature extractor).
4. Continuous model evaluation metrics (precision/false alarms/lead time).
5. Formal model registry/versioning + rollback.
6. Voice stack decision for production (browser-only vs Jetson local TTS/STT).
7. End-to-end security hardening:
   1. HTTPS certificates
   2. API key rotation
   3. device identity/attestation (later stage)

## 10) Catastrophic Forgetting Claim (Important)

Do **not** claim "rid of catastrophic forgetting" absolutely.

Use this claim instead:

`Machine Speaks mitigates catastrophic forgetting risk through frozen base models, versioned taxonomy updates, human-in-the-loop validation, and controlled retraining pipelines.`

This is technically defensible.

## 11) Build Order (Do This Next)

1. Implement baseline tables + baseline APIs.
2. Implement baseline-aware anomaly scoring in SLM telemetry path.
3. Add hardware ingest service for fan demo sensors.
4. Add unified alert orchestration (UI + voice + acknowledgement).
5. Add Jetson deployment via `docker-compose`.
6. Run pilot with one workstation + one fan setup and measure false positives.

## 12) Final Architecture Decision

1. Keep web app as control plane.
2. Keep agent/sensors as data plane.
3. Keep SLM on Jetson as reasoning plane.
4. Keep taxonomy + feedback loop as learning plane.

This structure matches your vision and scales from demo to real deployment.
