# CHECKPOINT 3: Dynamic Events, Retasking Engine & WebSockets

**Status:** Completed & Fully Tested (26/26 Unit & Integration Tests Passing)  
**Date:** 2026-10-07  
**Scope:** Phase 3 – Real-Time Events Engine + WebSocket Broadcasting + Scenario Reset  

---

## 1. What Was Built

1. **Shared Real-Time Replanning Engine (`backend/app/events.py`)**:
   - Centralized `replan_logic(snapshot, event_type, payload)` function powering all dynamic retasking.
   - Handles the 3 core tactical scenarios deterministically and produces structured, human-readable `RetaskAction` logs.

2. **Real-Time WebSocket Server (`backend/app/websocket.py`)**:
   - `ConnectionManager` with broadcast capabilities for tactical state changes.
   - Endpoint `/ws` delivering instant `STATE_SNAPSHOT` on initial handshake and streaming `EVENT_ALERT` and `RETASK_LOG` messages on every event.
   - Built-in ping/pong heartbeat handling and graceful client disconnection cleanup.

3. **Events REST API (`backend/app/routers/events.py`)**:
   - `POST /api/events/trigger`: Validates payload $\rightarrow$ mutates StateStore under async lock $\rightarrow$ invokes `replan_logic` $\rightarrow$ logs audit record $\rightarrow$ broadcasts delta over WebSockets $\rightarrow$ returns retasking report.
   - `POST /api/events/reset`: Restores all assets, runways, pilot availability, and threat zones to the initial seeded baseline (seed=42), clears active missions, and broadcasts the clean snapshot to all dashboards.

4. **Interactive WebSocket Test Client (`backend/scripts/ws_client.py`)**:
   - Python script connecting to `ws://localhost:8000/ws` for real-time terminal monitoring of event alerts and retask streams.

5. **Event Test Suite (`backend/tests/test_events.py`)**:
   - End-to-end tests for Runway Lockout, Threat Zone Spawning, Engine Failure with Standby Scramble, Scenario Reset, and WebSocket Handshake.

---

## 2. Dynamic Event Handlers & Before/After Logs

### Event 1: `RUNWAY_BLOCKED` (Runway Lockout & Airborne Diversion)
**Scenario:** A missile strike or drone incident blocks the main runway at Trishul AFS while Mission `MSN-0001` (`GARUDA-01`) is airborne.

- **Before State**:
  - Departure/Recovery Base: `BASE_TRISHUL` (`OPERATIONAL`)
  - Mission Route: 3 waypoints terminating at `Recovery (Trishul Air Force Station)`
- **Execution**:
  - `BASE_TRISHUL` runway marked `BLOCKED`.
  - Evaluates all other `OPERATIONAL` bases in theatre.
  - Checks fuel feasibility: $\text{Current Fuel} \ge \text{Distance to Alternate} \times \text{Fuel Burn} \times 1.1$.
  - Selects closest viable alternate: `BASE_VAYU` (Vayu Forward Air Base, 94.2 km away).
  - Updates recovery waypoint to `Emergency Recovery (Vayu Forward Air Base)`.
  - Recalculates remaining route distance and ETA (+4.1 mins).
- **After Retask Log**:
  ```json
  {
    "action_type": "DIVERTED",
    "mission_id": "MSN-0001",
    "aircraft_id": "AC_RAFALE_01",
    "reason": "Runway lockout at departure base Trishul Air Force Station",
    "details": "Diverted recovery to Vayu Forward Air Base. Distance to alternate: 94.2 km (Fuel required: 393L). Route ETA adjusted by +4.1 mins.",
    "added_time_mins": 4.1,
    "new_recovery_base_id": "BASE_VAYU"
  }
  ```

---

### Event 2: `NEW_THREAT_ZONE` (Dynamic SAM Threat Corridor Evasion)
**Scenario:** A hostile high-altitude SAM radar battery (HQ-9 / S-300) appears directly on the flight path of active Mission `MSN-0001`.

- **Before State**:
  - Direct flight corridor passing through coordinates $(31.08^\circ \text{N}, 75.50^\circ \text{E})$.
  - Route ETA: 26.0 mins.
- **Execution**:
  - Registers `ThreatZone` with radius 60 km and Severity 5 in state.
  - Tests flight polyline using Shapely `intersects(threat_circle)`.
  - Computes perpendicular tangent detour node outside 60 km radius (+15% safety factor) at $(31.35^\circ \text{N}, 75.82^\circ \text{E})$.
  - Inserts `Evasive Detour` waypoint into flight path before target engagement.
  - Recomputes new distance, ETA (+5.4 mins), and fuel consumption.
  - Sets mission status to `REROUTED`.
- **After Retask Log**:
  ```json
  {
    "action_type": "REROUTED",
    "mission_id": "MSN-0001",
    "aircraft_id": "AC_RAFALE_01",
    "reason": "New High-Severity Threat Detected: Pop-Up S-300 Battery Test (Severity 5)",
    "details": "Inserted tactical detour node at 31.35°N, 75.82°E avoiding 60.0km threat bubble. Flight time delta: +5.4 mins ETD.",
    "added_time_mins": 5.4
  }
  ```

---

### Event 3: `AIRCRAFT_FAILURE` (In-Flight Fault & Standby Scramble)
**Scenario:** In-flight mechanical/engine fault reported on active fighter `AC_RAFALE_01`.

- **Before State**:
  - `AC_RAFALE_01` in `AIRBORNE` status on active mission to Alpha Command Bunker.
- **Execution**:
  - `AC_RAFALE_01` marked `ABORTED`.
  - Active mission marked `ABORTED`.
  - Shared CP-SAT optimizer automatically invoked to locate nearest standby `READY` jet with matching ordnance and rested pilot.
  - Selects `AC_MIRAGE_03` (`VAJRA-03`) at Trishul AFS piloted by `Sqn Ldr Ananya Sharma` carrying SPICE-2000 and Rudram-1.
  - Reports mission retask with turnaround scramble timeline.
- **After Retask Log**:
  ```json
  {
    "action_type": "REPLACED",
    "mission_id": "MSN-0001",
    "aircraft_id": "AC_RAFALE_01",
    "reason": "In-flight technical/engine fault reported on GARUDA-01",
    "details": "Mission MSN-0001 aborted. Standby replacement scrambled: Jet VAJRA-03 (Mirage 2000-5) piloted by Sqn Ldr Ananya Sharma from Trishul Air Force Station. Estimated turnaround delay: +40.0 mins.",
    "added_time_mins": 40.0
  }
  ```

---

## 3. How to Run & Verify Phase 3

### A. Run Test Suite
```bash
python -m pytest tests/ -v
```
All 26 unit and integration tests will pass.

### B. Test Live WebSocket Broadcasts with Test Client
In terminal 1 (Start Backend):
```bash
uvicorn app.main:app --reload --port 8000
```
In terminal 2 (Start WebSocket listener):
```bash
python scripts/ws_client.py
```
In terminal 3 (Trigger an event via curl or Python):
```bash
curl -X POST http://localhost:8000/api/events/trigger \
  -H "Content-Type: application/json" \
  -d '{"event_type": "RUNWAY_BLOCKED", "payload": {"airbase_id": "BASE_TRISHUL"}}'
```
Watch real-time `EVENT_ALERT` and `STATE_SNAPSHOT` payloads stream into terminal 2!

---

## 4. Next Steps (Phase 4 - Frontend Dashboard)
- Initialize Vite + React + TypeScript + Tailwind CSS application in `frontend/`.
- Configure CartoDB Dark Matter dark tactical map with `react-leaflet`.
- Build tactical glassmorphism UI:
  - Header with IST/UTC live clocks, WebSocket status indicator, and SYNTHETIC DATA badge.
  - Left panel: Readiness gauges (Ready Jets, Pilots, Base Fuel Reserves) and compact Fleet status chips.
  - Center tactical map: Airbase icons (green/red), threat bubbles (translucent red/amber), targets (priority badges), animated flight polylines, moving aircraft markers.
  - Right panel: Mission command form, Top-3 recommendation cards, expandable **Payload & Ordnance Configuration** card, **Constraint-satisfaction checklist** (8/8 rules), and **Deploy Package** button.
  - Bottom floating **Demo Scenario Controller**: 1-click buttons for Runway Lockout, SAM Threat, Engine Fault, and Reset Scenario.
  - Emergency Alert Overlay: Streaming retasking logs and event timeline drawer.
- Use the browser tool to interact with the dashboard, verify all flows, and capture screenshots/recordings.
