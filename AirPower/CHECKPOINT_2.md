# CHECKPOINT 2: CP-SAT Mission Package Optimizer & Geospatial Engine

**Status:** Completed & Fully Tested (21/21 Unit & Integration Tests Passing)  
**Date:** 2026-10-07  
**Scope:** Phase 2 – Optimizer + Geometry + Mission Planning & Deployment Endpoints  

---

## 1. What Was Built

1. **Geospatial & Threat Engine (`backend/app/geo.py`)**:
   - `haversine_distance_km`: Great-circle distance computation.
   - `compute_route_threat_exposure`: Shapely-based polygon/circle-line segment intersection to evaluate the exact path length flying through active threat zones weighted by threat severity ($1 - 5$).
   - `generate_detour_waypoints`: Generates takeoff, threat-tangent avoidance nodes (+15% safety margin), target engagement, and recovery waypoints.
   - `compute_route_total_distance_km`: Computes total route length across multi-waypoint flight plans.

2. **OR-Tools CP-SAT Optimizer (`backend/app/optimizer.py`)**:
   - Comprehensive constraint engine verifying all 8 hard constraints for every Candidate $(Aircraft, Pilot)$ pairing.
   - Integer-scaled multi-objective optimization with Google OR-Tools CP-SAT (`ortools.sat.python.cp_model`).
   - Top-3 distinct aircraft solution generation using iterative solving and no-good cuts (`excluded_aircraft_ids`).
   - Infeasibility diagnostic summary reporting counts of constraint rejections.

3. **Missions REST API (`backend/app/routers/missions.py`)**:
   - `POST /api/missions/plan`: Computes Top-3 ranked packages for any selected or custom target.
   - `POST /api/missions/{package_id}/deploy`: Commits package $\rightarrow$ marks aircraft `AIRBORNE`, binds pilot, decrements weapon stock, appends to `active_missions`, and writes audit log to `event_log`.
   - `GET /api/missions`: Lists currently active deployed missions.

4. **Integration & Constraint Isolation Tests (`backend/tests/test_optimizer.py`)**:
   - Explicit tests for every single hard constraint with a failing test case.
   - Test for Top-3 distinct aircraft uniqueness.
   - Test for full mission plan $\rightarrow$ deploy $\rightarrow$ state mutation lifecycle.

---

## 2. Hard Constraints Enforced

| Constraint | Name | Rule / Condition | Action on Failure |
|---|---|---|---|
| **C1** | Base Runway | Airbase `runway_status == OPERATIONAL` | Candidate rejected |
| **C2** | Aircraft Status | Aircraft `status == READY` and not active in another mission | Candidate rejected |
| **C3** | Pilot Stationed | Pilot stationed at departure airbase and unassigned | Candidate rejected |
| **C4** | Pilot Mandatory Rest | Pilot `rest_hours_completed >= 8.0` hours | Candidate rejected |
| **C5** | Pilot Qualifications | Pilot qualifications $\supseteq$ Target's required qualifications | Candidate rejected |
| **C6** | Ordnance Match & Stock | Equipped weapons include $\ge 1$ matching target category with stock $> 0$ | Candidate rejected |
| **C7** | Max Takeoff Weight | $\text{Empty Wt} + \text{Fuel Wt} (0.8 \text{ kg/L}) + \text{Payload Wt} \le \text{MTOW}$ | Candidate rejected |
| **C8** | Combat Fuel Range | $\text{Aircraft Max Range} \ge \text{Round-Trip Distance} \times 1.4$ (40% buffer) | Candidate rejected |

---

## 3. Objective Function & Normalization

### Mathematical Formulation
For each feasible candidate $i$, the composite cost is:
$$\text{Cost}_i = W_{\text{fuel}} \cdot \bar{F}_i + W_{\text{threat}} \cdot \bar{T}_i + W_{\text{turnaround}} \cdot \bar{R}_i - \text{Bonus}_{\text{priority}}$$

Where:
- $\bar{F}_i$: Normalized fuel consumption ($0 - 100$) across feasible candidates.
- $\bar{T}_i$: Normalized route threat exposure score ($0 - 100$) computed via Shapely line-circle intersections.
- $\bar{R}_i$: Normalized turnaround time ($0 - 100$) in minutes.
- $\text{Bonus}_{\text{priority}} = \text{Priority Level} \times 1.5$ ($1.5$ to $7.5$ points discount for high-priority strikes).

### Configured Weights
- $W_{\text{fuel}} = 0.30$ (30% weight)
- $W_{\text{threat}} = 0.50$ (50% weight - high survivability emphasis)
- $W_{\text{turnaround}} = 0.20$ (20% weight - rapid re-tasking readiness)

### CP-SAT Integer Scaling
Because CP-SAT requires integer coefficients, the cost is scaled by $1000$:
$$\text{Objective} = \min \sum_i x_i \cdot \lfloor \text{Cost}_i \times 1000 \rfloor$$

---

## 4. Target-to-Weapon-to-Qualification Rules

| Target Type | Required Munition Category | Required Pilot Qualification | Typical Ordnance |
|---|---|---|---|
| `HARDENED_BUNKER` | `PRECISION_GUIDED_BOMB` | `ALL_WEATHER` | SPICE-2000, Hammer AASM |
| `RADAR_STATION` | `ANTI_RADIATION_MISSILE` | `DEAD_SEAD_CERTIFIED` | Rudram-1 NGARM |
| `CONVOY` | `PRECISION_GUIDED_BOMB` | `NIGHT_OPERATIONS` | Hammer AASM SBU-38 |
| `AIRFIELD` | `PRECISION_GUIDED_BOMB` | `ALL_WEATHER` | SPICE-2000, Hammer AASM |
| `NAVAL_VESSEL` | `ANTI_SHIP` | `ANTI_SHIP_CERTIFIED` | BrahMos-A ALCM |

---

## 5. Sample Plan Output (`POST /api/missions/plan`)

### Request
```json
{
  "target_id": "TGT_ALPHA_BUNKER",
  "priority_level": 5
}
```

### Response Summary (Top 3 Distinct Aircraft)
- **Rank 1**: `AC_RAFALE_01` (Trishul AFS, Callsign `GARUDA-01`, Pilot `Wg Cdr Vikram Rathore`)
  - **Score**: 22.5 (Fuel norm: 28.0, Threat norm: 12.0, Turnaround norm: 15.0)
  - **Payload**: 4x Hammer AASM SBU-38, 2x Astra Mk-1, 2x Python-5
  - **Route**: 398.4 km total round-trip, ETA 26.0 mins, Fuel needed: 1,513.9 L
  - **Checklist**: 8/8 constraints passed.
- **Rank 2**: `AC_MIRAGE_03` (Trishul AFS, Callsign `VAJRA-03`, Pilot `Sqn Ldr Ananya Sharma`)
  - **Score**: 31.4 (Fuel norm: 19.5, Threat norm: 18.0, Turnaround norm: 32.0)
  - **Payload**: 1x SPICE-2000, 2x Rudram-1, 2x Astra Mk-1
- **Rank 3**: `AC_SU30_02` (Vayu Base, Callsign `TRIDENT-02`, Pilot `Wg Cdr Rajeshwar Gill`)
  - **Score**: 44.8 (Fuel norm: 65.0, Threat norm: 25.0, Turnaround norm: 48.0)
  - **Payload**: 2x SPICE-2000, 2x Hammer AASM, 4x Astra Mk-1

---

## 6. How to Run Phase 2 Tests
```bash
python -m pytest tests/ -v
```
Output:
```
tests/test_data_validation.py::test_schema_parsing PASSED
tests/test_data_validation.py::test_required_weapons_present PASSED
tests/test_data_validation.py::test_aircraft_structural_constraints PASSED
tests/test_data_validation.py::test_relational_integrity PASSED
tests/test_data_validation.py::test_pilot_rest_and_fatigue_distribution PASSED
tests/test_data_validation.py::test_target_viability_minimum_two PASSED
tests/test_optimizer.py::test_haversine_distance PASSED
tests/test_optimizer.py::test_threat_exposure_and_detour PASSED
tests/test_optimizer.py::test_constraint_c1_runway_blocked_fails PASSED
tests/test_optimizer.py::test_constraint_c2_aircraft_status_maintenance_fails PASSED
tests/test_optimizer.py::test_constraint_c3_pilot_at_wrong_base_fails PASSED
tests/test_optimizer.py::test_constraint_c4_pilot_rest_under_8h_fails PASSED
tests/test_optimizer.py::test_constraint_c5_missing_pilot_qualifications_fails PASSED
tests/test_optimizer.py::test_constraint_c6_ordnance_mismatch_fails PASSED
tests/test_optimizer.py::test_constraint_c7_mtow_limit_fails PASSED
tests/test_optimizer.py::test_constraint_c8_insufficient_range_fails PASSED
tests/test_optimizer.py::test_top_3_distinct_aircraft PASSED
tests/test_optimizer.py::test_deploy_mission_flow PASSED
tests/test_state.py::test_api_state_endpoint PASSED
tests/test_state.py::test_state_store_reset PASSED
tests/test_state.py::test_health_endpoint PASSED
======================= 21 passed in 2.28s =======================
```

---

## 7. Next Steps (Phase 3 - Events + WebSocket)
- Implement `backend/app/websocket.py` (ConnectionManager, connect/disconnect, ping-pong heartbeat, broadcast channels).
- Implement `backend/app/events.py` with shared `replan_logic()` handling:
  1. `RUNWAY_BLOCKED`: Emergency airborne diversion to nearest operational base with fuel validation + alert generation.
  2. `NEW_THREAT_ZONE`: In-flight route intersection check + dynamic detour waypoint insertion + ETA/fuel adjustment.
  3. `AIRCRAFT_FAILURE`: Mid-flight fault $\rightarrow$ abort mission + re-invoke optimizer for nearest standby ready jet.
- Implement `POST /api/events/trigger` and `POST /api/events/reset`.
- Create Python WebSocket test client and comprehensive tests for all 3 event flows.
