# CHECKPOINT 1: Foundation, Domain Models & Synthetic Data Engine

**Status:** Completed & Tested (9/9 Unit Tests Passing)  
**Date:** 2026-10-07  
**Scope:** Phase 1 – Foundation + Synthetic Data + State Store + State API  

---

## 1. What Was Built

1. **Repo Scaffolding & Dependencies (`backend/requirements.txt`)**:
   - Python 3.10+ / 3.11+, FastAPI, Uvicorn, Pydantic v2, Google OR-Tools CP-SAT, Shapely, Geopy, Pytest, HTTPX.

2. **Domain Models & Pydantic Schemas (`backend/app/models.py`)**:
   - Strictly typed data structures for:
     - `Weapon` (AAM, PGB, ARM, Anti-Ship with guidance, weight, ranges, and target effectiveness).
     - `Aircraft` (Rafale, Su-30MKI, Tejas Mk1A, Mirage 2000 with fuel capacity, burn rate, MTOW, hardpoints, cruise speed, and derived `max_range_km`).
     - `Airbase` (5–6 tactical northern/western bases with runway status and fuel reserves).
     - `Pilot` (ranks, rest hours, flight fatigue, home base, qualifications like SEAD, All-Weather, Night Ops, Anti-Ship).
     - `ThreatZone` (SAM radar batteries, EW jamming corridors, severe weather with polygon/circular radius and severity).
     - `MissionTarget` (Hardened bunker, radar station, convoy, airfield, naval frigate).
     - `StateSnapshot`, `MissionPackage`, `RouteInfo`, `ScoreBreakdown`, `ConstraintCheck`.

3. **Seeded Synthetic Data Engine (`backend/app/data_generator.py` → `backend/data/mock_data.json`)**:
   - Seeded with `seed=42` for strict reproducibility.
   - Generates realistic operational scenarios in Northern/Western India with fictionalized callsigns and base names.
   - Built-in `validate_consistency()` pass enforcing:
     - No dangling foreign keys.
     - Hardpoint capacity limits (equipped weapons count $\le$ hardpoints).
     - Maximum Take-off Weight (MTOW) limits: $\text{Empty Weight} + (\text{Fuel Liters} \times 0.8) + \sum \text{Weapons Weight} \le \text{MTOW}$.
     - Multi-candidate viability: Every target is guaranteed to have $\ge 2$ theoretically viable, in-range aircraft/pilot combinations with matching ordnance.

4. **In-Memory Thread-Safe StateStore (`backend/app/state.py`)**:
   - Asyncio lock protected in-memory state store.
   - Deep-copy snapshot retrieval (`get_snapshot()`, `get_snapshot_async()`).
   - Atomic state mutations (`mutate(mutator_fn)`).
   - Scenario reset capability (`reset_to_initial()`).

5. **FastAPI Application & State Endpoint (`backend/app/main.py`, `backend/app/routers/state.py`)**:
   - `GET /api/state` returning the full tactical snapshot.
   - `GET /health` and `GET /` root endpoints with `"SYNTHETIC DATA – DEMO"` badge.
   - Permissive CORS configuration for Vite/React frontend.

6. **Test Suite (`backend/tests/`)**:
   - `test_schema_parsing`: verifies all entities conform to Pydantic v2 schemas.
   - `test_required_weapons_present`: checks Astra Mk-1, SPICE-2000, Rudram-1, BrahMos-A, Hammer AASM, Python-5.
   - `test_aircraft_structural_constraints`: hardpoint limits and MTOW limits.
   - `test_relational_integrity`: foreign key consistency.
   - `test_pilot_rest_and_fatigue_distribution`: verifies rested pilots and fatigue edge cases (< 8h rest).
   - `test_target_viability_minimum_two`: verifies $\ge 2$ feasible aircraft/pilot combos per target.
   - `test_api_state_endpoint`, `test_state_store_reset`, `test_health_endpoint`: validates API contracts.

---

## 2. Asset & Weapon Specification Tables

### A. Weapons Inventory

| Weapon ID | Name | Category | Guidance Type | Weight (kg) | Range (km) | Stock | Primary Effectiveness |
|---|---|---|---|---|---|---|---|
| `WEP_ASTRA_MK1` | Astra Mk-1 BVR-AAM | `AIR_TO_AIR_MISSILE` | Active Radar | 154.0 | 110.0 | 36 | Air Defense / Self-Protection Escort |
| `WEP_SPICE_2000` | SPICE-2000 Penetrator | `PRECISION_GUIDED_BOMB` | GPS / Electro-Optical | 900.0 | 60.0 | 24 | `HARDENED_BUNKER`, `AIRFIELD` |
| `WEP_RUDRAM_1` | Rudram-1 NGARM | `ANTI_RADIATION_MISSILE` | Passive Homing | 140.0 | 150.0 | 22 | `RADAR_STATION` (SEAD) |
| `WEP_BRAHMOS_A` | BrahMos-A ALCM | `ANTI_SHIP` | Active Radar | 2500.0 | 300.0 | 12 | `NAVAL_VESSEL` |
| `WEP_HAMMER_AASM` | Hammer AASM SBU-38 | `PRECISION_GUIDED_BOMB` | GPS / Electro-Optical | 330.0 | 70.0 | 30 | `CONVOY`, `HARDENED_BUNKER`, `AIRFIELD`|
| `WEP_PYTHON_5` | Python-5 WVRAAM | `AIR_TO_AIR_MISSILE` | Passive Infrared/EO | 105.0 | 20.0 | 40 | Close Combat / Self-Defense |

---

### B. Aircraft Fleet Specifications

| Aircraft ID | Model | Callsign | Base | Status | Empty Wt (kg) | MTOW (kg) | Fuel Cap (L) | Burn (L/km) | Max Range (km) | Hardpoints | Equipped Loadout |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `AC_RAFALE_01` | Rafale EH | `GARUDA-01` | Trishul AFS | `READY` | 10,300 | 24,500 | 6,800 | 3.8 | ~1,700 | 14 | 4x Hammer, 2x Astra, 2x Python-5 |
| `AC_RAFALE_02` | Rafale EH | `GARUDA-02` | Trishul AFS | `READY` | 10,300 | 24,500 | 6,800 | 3.8 | ~1,646 | 14 | 2x SPICE-2000, 2x Rudram-1, 2x Astra |
| `AC_RAFALE_03` | Rafale DH | `GARUDA-03` | Garuda Base | `READY` | 10,600 | 24,500 | 6,800 | 3.8 | ~1,575 | 14 | 4x Hammer, 2x Rudram-1, 2x Astra |
| `AC_RAFALE_04` | Rafale EH | `GARUDA-04` | Garuda Base | `MAINTENANCE` | 10,300 | 24,500 | 6,800 | 3.8 | ~894 | 14 | 2x SPICE-2000 |
| `AC_SU30_01` | Su-30MKI | `TRIDENT-01` | Vayu Base | `READY` | 18,400 | 38,800 | 12,000 | 5.4 | ~2,111 | 12 | 2x Rudram-1, 2x SPICE-2000, 4x Astra |
| `AC_SU30_02` | Su-30MKI | `TRIDENT-02` | Vayu Base | `READY` | 18,400 | 38,800 | 12,000 | 5.4 | ~2,044 | 12 | 2x SPICE-2000, 2x Hammer, 4x Astra |
| `AC_SU30_03` | Su-30MKI | `TRIDENT-03` | Varun Base | `READY` | 18,400 | 38,800 | 12,000 | 5.4 | ~2,111 | 12 | 1x BrahMos-A, 4x Astra |
| `AC_SU30_04` | Su-30MKI | `TRIDENT-04` | Marut Base | `READY` | 18,400 | 38,800 | 12,000 | 5.4 | ~2,088 | 12 | 1x BrahMos-A, 2x Rudram-1, 2x Astra |
| `AC_TEJAS_01` | Tejas Mk1A | `LIGHTNING-01`| Marut Base | `READY` | 6,560 | 13,500 | 3,000 | 2.2 | ~1,295 | 8 | 2x Hammer, 2x Python-5 |
| `AC_TEJAS_02` | Tejas Mk1A | `LIGHTNING-02`| Marut Base | `READY` | 6,560 | 13,500 | 3,000 | 2.2 | ~1,227 | 8 | 2x Rudram-1, 2x Astra |
| `AC_TEJAS_03` | Tejas Mk1A | `LIGHTNING-03`| Shakti Base | `READY` | 6,560 | 13,500 | 3,000 | 2.2 | ~1,295 | 8 | 2x Rudram-1, 2x Hammer, 2x Python-5 |
| `AC_TEJAS_04` | Tejas Mk1A | `LIGHTNING-04`| Shakti Base | `MAINTENANCE` | 6,560 | 13,500 | 3,000 | 2.2 | ~545 | 8 | Empty |
| `AC_MIRAGE_01`| Mirage 2000-5 | `VAJRA-01` | Garuda Base | `READY` | 7,500 | 17,000 | 4,300 | 2.9 | ~1,393 | 9 | 1x SPICE-2000, 2x Python-5 |
| `AC_MIRAGE_02`| Mirage 2000-5 | `VAJRA-02` | Garuda Base | `READY` | 7,500 | 17,000 | 4,300 | 2.9 | ~1,364 | 9 | 2x Rudram-1, 2x Hammer, 2x Astra |
| `AC_MIRAGE_03`| Mirage 2000-5 | `VAJRA-03` | Trishul AFS | `READY` | 7,500 | 17,000 | 4,300 | 2.9 | ~1,364 | 9 | 1x SPICE-2000, 2x Rudram-1, 2x Astra |

---

### C. Airbases

| Airbase ID | Name | Coordinates | Runway Status | Available Fuel (Liters) |
|---|---|---|---|---|
| `BASE_TRISHUL` | Trishul Air Force Station | 30.36° N, 76.81° E | `OPERATIONAL` | 480,000 |
| `BASE_GARUDA` | Garuda Tactical Base | 26.25° N, 73.04° E | `OPERATIONAL` | 550,000 |
| `BASE_VAYU` | Vayu Forward Air Base | 30.75° N, 75.63° E | `OPERATIONAL` | 390,000 |
| `BASE_MARUT` | Marut Combat Station | 23.28° N, 69.67° E | `OPERATIONAL` | 420,000 |
| `BASE_VARUN` | Varun Naval Air Enclave | 22.46° N, 70.01° E | `OPERATIONAL` | 510,000 |
| `BASE_SHAKTI` | Shakti High-Altitude Base | 33.87° N, 74.97° E | `OPERATIONAL` | 280,000 |

---

### D. Mission Targets

| Target ID | Name | Location | Target Type | Req. Weapon Category | Priority | Time Window | Req. Pilot Qualifications |
|---|---|---|---|---|---|---|---|
| `TGT_ALPHA_BUNKER` | Alpha Command Bunker Citadel | 31.80° N, 74.20° E | `HARDENED_BUNKER` | `PRECISION_GUIDED_BOMB` | 5 | 45 min | `ALL_WEATHER` |
| `TGT_BRAVO_RADAR` | Bravo Early Warning Radar | 32.60° N, 74.40° E | `RADAR_STATION` | `ANTI_RADIATION_MISSILE` | 4 | 60 min | `DEAD_SEAD_CERTIFIED` |
| `TGT_CHARLIE_CONVOY`| Charlie Armored Logistics Column | 28.10° N, 71.30° E | `CONVOY` | `PRECISION_GUIDED_BOMB` | 3 | 90 min | `NIGHT_OPERATIONS` |
| `TGT_DELTA_AIRFIELD` | Delta Forward Runway | 30.15° N, 72.35° E | `AIRFIELD` | `PRECISION_GUIDED_BOMB` | 5 | 40 min | `ALL_WEATHER` |
| `TGT_ECHO_FRIGATE` | Echo Guided Missile Frigate | 22.10° N, 67.90° E | `NAVAL_VESSEL` | `ANTI_SHIP` | 4 | 75 min | `ANTI_SHIP_CERTIFIED` |
| `TGT_FOXTROT_RADAR` | Foxtrot Surveillance Radar | 27.20° N, 70.90° E | `RADAR_STATION` | `ANTI_RADIATION_MISSILE` | 3 | 120 min | `DEAD_SEAD_CERTIFIED` |

---

## 3. How to Run Phase 1

### A. Run Data Generator (Seeded)
```bash
python -m app.data_generator --seed 42
```

### B. Run Backend Tests
```bash
python -m pytest tests/ -v
```

### C. Start FastAPI Backend Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Test endpoints:
- Root: `http://localhost:8000/`
- State: `http://localhost:8000/api/state`
- Interactive API Docs: `http://localhost:8000/docs`

---

## 4. Key Design Decisions Made

1. **Strict Jet-A Fuel Density Factor (0.8 kg/L)**: Used across MTOW checks so fuel weight dynamically contributes to takeoff weight calculations alongside structural and payload weights.
2. **Range Safety Margin (1.4x)**: Hard-coded 40% margin over round-trip distance ($2 \times \text{distance} \times 1.4$) ensuring jets have sufficient fuel reserve for combat maneuvers and holding patterns.
3. **Pilot Fatigue Edge Cases**: Intentionally seeded pilots with $<8$ hours rest (`PLT_03` at 5.5h, `PLT_08` at 6.0h, `PLT_20` at 4.0h) alongside aircraft in maintenance (`AC_RAFALE_04`, `AC_TEJAS_04`) to exercise and demonstrate hard constraint filtering in the optimizer.

---

## 5. Next Steps (Phase 2 - Optimizer)
- Implement `backend/app/geo.py` (haversine, geodesic, circle-line segment intersection with Shapely, threat exposure calculations).
- Implement `backend/app/optimizer.py` (Google OR-Tools CP-SAT integer-scaled model, hard constraint filters, multi-objective ranking, Top-3 distinct packages generation, structured constraint checklist).
- Implement `POST /api/missions/plan`, `POST /api/missions/{package_id}/deploy`, `GET /api/missions`.
- Write unit tests for all individual hard constraints (one failing test case per constraint) and top-3 distinctness.
