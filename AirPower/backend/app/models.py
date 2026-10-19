"""
Pydantic Models and Schemas for AirPower Decision-Support Platform.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, computed_field, model_validator


# ==========================================
# ENUMS
# ==========================================

class WeaponCategory(str, Enum):
    AIR_TO_AIR_MISSILE = "AIR_TO_AIR_MISSILE"
    PRECISION_GUIDED_BOMB = "PRECISION_GUIDED_BOMB"
    ANTI_RADIATION_MISSILE = "ANTI_RADIATION_MISSILE"
    ANTI_SHIP = "ANTI_SHIP"


class GuidanceType(str, Enum):
    ACTIVE_RADAR = "ACTIVE_RADAR"
    GPS_ELECTRO_OPTICAL = "GPS_ELECTRO_OPTICAL"
    PASSIVE_HOMING = "PASSIVE_HOMING"


class AircraftStatus(str, Enum):
    READY = "READY"
    MAINTENANCE = "MAINTENANCE"
    AIRBORNE = "AIRBORNE"
    ABORTED = "ABORTED"


class RunwayStatus(str, Enum):
    OPERATIONAL = "OPERATIONAL"
    BLOCKED = "BLOCKED"


class PilotQualification(str, Enum):
    NIGHT_OPERATIONS = "NIGHT_OPERATIONS"
    DEAD_SEAD_CERTIFIED = "DEAD_SEAD_CERTIFIED"
    ALL_WEATHER = "ALL_WEATHER"
    ANTI_SHIP_CERTIFIED = "ANTI_SHIP_CERTIFIED"


class ThreatType(str, Enum):
    SAM_RADAR_BATTERY = "SAM_RADAR_BATTERY"
    EW_JAMMING_CORRIDOR = "EW_JAMMING_CORRIDOR"
    SEVERE_WEATHER = "SEVERE_WEATHER"


class TargetType(str, Enum):
    HARDENED_BUNKER = "HARDENED_BUNKER"
    RADAR_STATION = "RADAR_STATION"
    CONVOY = "CONVOY"
    AIRFIELD = "AIRFIELD"
    NAVAL_VESSEL = "NAVAL_VESSEL"


class MissionStatus(str, Enum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    REROUTED = "REROUTED"
    RETURNING = "RETURNING"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"


class EventType(str, Enum):
    RUNWAY_BLOCKED = "RUNWAY_BLOCKED"
    NEW_THREAT_ZONE = "NEW_THREAT_ZONE"
    AIRCRAFT_FAILURE = "AIRCRAFT_FAILURE"
    MAINTENANCE_UPDATE = "MAINTENANCE_UPDATE"
    MISSION_DEPLOYED = "MISSION_DEPLOYED"
    APPROVAL_DECISION = "APPROVAL_DECISION"
    SCENARIO_INJECTED = "SCENARIO_INJECTED"
    RESET = "RESET"
    SYSTEM_VALIDATION = "SYSTEM_VALIDATION"
    WEATHER_ALERT = "WEATHER_ALERT"
    WEATHER_SCENARIO_INJECTED = "WEATHER_SCENARIO_INJECTED"
    WEATHER_SCENARIO_RESET = "WEATHER_SCENARIO_RESET"


class MaintenanceCategory(str, Enum):
    SCHEDULED_INSPECTION = "SCHEDULED_INSPECTION"
    AVIONICS_REPAIR = "AVIONICS_REPAIR"
    ENGINE_OVERHAUL = "ENGINE_OVERHAUL"
    HYDRAULIC_SERVICE = "HYDRAULIC_SERVICE"
    AIRFRAME_STRUCTURAL = "AIRFRAME_STRUCTURAL"
    UNSCHEDULED_FAULT = "UNSCHEDULED_FAULT"


class MaintenanceStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"


class MaintenancePriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class InventoryCategory(str, Enum):
    PROPULSION_SPARE = "PROPULSION_SPARE"
    AVIONICS_LRU = "AVIONICS_LRU"
    GROUND_SUPPORT_EQUIPMENT = "GROUND_SUPPORT_EQUIPMENT"
    HYDRAULIC_FLUID = "HYDRAULIC_FLUID"
    OXYGEN_CANISTER = "OXYGEN_CANISTER"
    MUNITION_COMPONENT = "MUNITION_COMPONENT"


class InventoryStatus(str, Enum):
    ADEQUATE = "ADEQUATE"
    LOW_STOCK = "LOW_STOCK"
    CRITICAL_REORDER = "CRITICAL_REORDER"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ProposalType(str, Enum):
    CONTINGENCY_DIVERSION = "CONTINGENCY_DIVERSION"
    MAINTENANCE_SCHEDULE_OVERRIDE = "MAINTENANCE_SCHEDULE_OVERRIDE"
    RESOURCE_REALLOCATION = "RESOURCE_REALLOCATION"
    FLIGHT_CREW_EXTENSION = "FLIGHT_CREW_EXTENSION"


# ==========================================
# GEOMETRY / LOCATION
# ==========================================

class Location(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    name: Optional[str] = None


class Waypoint(BaseModel):
    lat: float
    lng: float
    name: str
    action: Optional[str] = "FLYBY"  # TAKEOFF, ENGAGE, DETOUR, RECOVERY


# ==========================================
# DOMAIN ENTITIES
# ==========================================

class Weapon(BaseModel):
    weapon_id: str
    name: str
    category: WeaponCategory
    guidance_type: GuidanceType
    weight_kg: float = Field(..., gt=0)
    effective_range_km: float = Field(..., gt=0)
    stock_count: int = Field(..., ge=0)
    effective_against: List[TargetType] = Field(default_factory=list)


class EquippedWeapon(BaseModel):
    weapon_id: str
    quantity: int = Field(..., ge=1)


class Aircraft(BaseModel):
    aircraft_id: str
    model: str  # e.g., Rafale, Su-30MKI, Tejas Mk1A, Mirage 2000, Mi-17V5 SAR, CH-47F
    callsign: str
    home_base_id: str
    status: AircraftStatus
    asset_type: str = "COMBAT_JET"  # COMBAT_JET, RESCUE_HELICOPTER, TRANSPORT_HELICOPTER
    current_fuel_pct: float = Field(..., ge=0.0, le=100.0)
    max_fuel_capacity_liters: float = Field(..., gt=0)
    max_takeoff_weight_kg: float = Field(..., gt=0)
    empty_weight_kg: float = Field(..., gt=0)
    hardpoints_count: int = Field(..., ge=1)
    equipped_weapons: List[EquippedWeapon] = Field(default_factory=list)
    turnaround_time_mins: int = Field(..., ge=10)
    fuel_burn_liters_per_km: float = Field(..., gt=0)
    cruise_speed_kmph: float = Field(..., gt=0)

    @computed_field
    @property
    def current_fuel_liters(self) -> float:
        return round((self.current_fuel_pct / 100.0) * self.max_fuel_capacity_liters, 2)

    @computed_field
    @property
    def max_range_km(self) -> float:
        if self.fuel_burn_liters_per_km <= 0:
            return 0.0
        return round(self.current_fuel_liters / self.fuel_burn_liters_per_km, 2)

    @computed_field
    @property
    def total_equipped_weapons_count(self) -> int:
        return sum(w.quantity for w in self.equipped_weapons)


class Airbase(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    runway_status: RunwayStatus = RunwayStatus.OPERATIONAL
    available_fuel_liters: float = Field(..., ge=0)
    stored_weapons: List[EquippedWeapon] = Field(default_factory=list)


class Pilot(BaseModel):
    pilot_id: str
    name: str
    rank: str  # e.g., Group Captain, Wing Commander, Squadron Leader, Flight Lieutenant
    qualifications: List[PilotQualification] = Field(default_factory=list)
    rest_hours_completed: float = Field(..., ge=0.0)
    consecutive_flight_hours: float = Field(..., ge=0.0)
    assigned_aircraft_id: Optional[str] = None
    home_base_id: str


class ThreatZone(BaseModel):
    threat_id: str
    name: str
    type: ThreatType
    center_location: Location
    effective_radius_km: float = Field(..., gt=0)
    threat_severity: int = Field(..., ge=1, le=5)
    countermeasure_required: str


class MissionTarget(BaseModel):
    target_id: str
    name: str
    location: Location
    target_type: TargetType
    required_weapon_category: WeaponCategory
    priority_level: int = Field(..., ge=1, le=5)
    time_window_mins: int = Field(..., ge=1)
    required_pilot_qualifications: List[PilotQualification] = Field(default_factory=list)


# ==========================================
# MAPPING RULES CONFIGURATION
# ==========================================

TARGET_MAPPING_RULES: Dict[TargetType, Dict[str, Any]] = {
    TargetType.HARDENED_BUNKER: {
        "required_weapon_category": WeaponCategory.PRECISION_GUIDED_BOMB,
        "required_pilot_qualifications": [PilotQualification.ALL_WEATHER],
        "description": "Reinforced subterranean or concrete command shelter requiring deep penetration PGBs.",
    },
    TargetType.RADAR_STATION: {
        "required_weapon_category": WeaponCategory.ANTI_RADIATION_MISSILE,
        "required_pilot_qualifications": [PilotQualification.DEAD_SEAD_CERTIFIED],
        "description": "High-frequency air defense radar array susceptible to anti-radiation homing ordnance.",
    },
    TargetType.CONVOY: {
        "required_weapon_category": WeaponCategory.PRECISION_GUIDED_BOMB,
        "required_pilot_qualifications": [PilotQualification.NIGHT_OPERATIONS],
        "description": "Mobile mechanized transport column requiring thermal/GPS guided standoff munitions.",
    },
    TargetType.AIRFIELD: {
        "required_weapon_category": WeaponCategory.PRECISION_GUIDED_BOMB,
        "required_pilot_qualifications": [PilotQualification.ALL_WEATHER],
        "description": "Hostile runway and shelter complex requiring runway-cratering and precision standoff strikes.",
    },
    TargetType.NAVAL_VESSEL: {
        "required_weapon_category": WeaponCategory.ANTI_SHIP,
        "required_pilot_qualifications": [PilotQualification.ANTI_SHIP_CERTIFIED],
        "description": "Offshore combatant vessel requiring active sea-skimming anti-ship cruise missiles.",
    },
}


# ==========================================
# OPTIMIZER & MISSION SCHEMAS
# ==========================================

class ConstraintCheck(BaseModel):
    constraint: str
    passed: bool
    actual_value: str
    required_value: str
    explanation: str


class ScoreBreakdown(BaseModel):
    fuel: float
    threat: float
    turnaround: float
    priority_bonus: float
    base_cost: float = 15.0
    fuel_cost_inr: float = 0.0
    flight_hours_cost_inr: float = 0.0
    munitions_cost_inr: float = 0.0
    ground_support_inr: float = 0.0
    total_estimated_cost_inr: float = 0.0
    estimated_cost_lakhs: float = 0.0


class OrdnancePayloadItem(BaseModel):
    weapon_id: str
    name: str
    qty: int
    weight_kg: float
    category: WeaponCategory


class RouteInfo(BaseModel):
    waypoints: List[Waypoint]
    distance_km: float
    eta_mins: float
    fuel_needed_liters: float
    threat_exposure_score: float
    rerouted: bool = False
    detour_notes: Optional[str] = None


class MissionPackage(BaseModel):
    package_id: str
    rank: int
    total_score: float
    target_id: str
    aircraft: Aircraft
    pilot: Pilot
    airbase: Airbase
    ordnance_payload: List[OrdnancePayloadItem]
    route: RouteInfo
    score_breakdown: ScoreBreakdown
    constraint_report: List[ConstraintCheck]
    estimated_cost_lakhs: float = 0.0


class PlanMissionRequest(BaseModel):
    target_id: Optional[str] = None
    custom_target: Optional[Location] = None
    target_type: Optional[TargetType] = None
    priority_level: int = Field(default=3, ge=1, le=5)
    required_weapon_category: Optional[WeaponCategory] = None


class PlanMissionResponse(BaseModel):
    status: str  # "FEASIBLE" | "INFEASIBLE"
    target: MissionTarget
    packages: List[MissionPackage] = Field(default_factory=list)
    infeasibility_summary: Optional[Dict[str, Any]] = None
    message: str


class ActiveMission(BaseModel):
    mission_id: str
    package_id: str
    target: MissionTarget
    aircraft: Aircraft
    pilot: Pilot
    airbase: Airbase
    ordnance_payload: List[OrdnancePayloadItem]
    route: RouteInfo
    status: MissionStatus = MissionStatus.ACTIVE
    deployed_at: str
    current_waypoint_index: int = 0
    current_position: Location


# ==========================================
# EVENT TRIGGER & LOG SCHEMAS
# ==========================================

class TriggerEventRequest(BaseModel):
    event_type: EventType
    payload: Dict[str, Any] = Field(default_factory=dict)


class RetaskAction(BaseModel):
    mission_id: str
    aircraft_id: str
    action_type: str  # "DIVERTED" | "REROUTED" | "REPLACED" | "ABORTED"
    reason: str
    details: str
    added_time_mins: Optional[float] = None
    new_recovery_base_id: Optional[str] = None


class EventLogEntry(BaseModel):
    event_id: str
    timestamp: str
    event_type: Any  # EventType or str
    description: str
    affected_assets: List[str] = Field(default_factory=list)
    retasking_actions: List[RetaskAction] = Field(default_factory=list)
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    severity: str = "INFO"  # INFO, WARNING, CRITICAL, ALERT
    source: str = "SYSTEM"  # AI_OPTIMIZER, MANUAL_OVERRIDE, TELEMETRY_FEED, CONTINGENCY_SIMULATOR, HUMAN_COMMANDER
    scenario_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class TriggerEventResponse(BaseModel):
    status: str
    event_id: str
    event_type: Any
    retasking_log: List[RetaskAction]
    message: str


# ==========================================
# MAINTENANCE & LOGISTICS DOMAIN ENTITIES
# ==========================================

class MaintenanceRecord(BaseModel):
    record_id: str
    resource_id: str
    resource_type: str = "AIRCRAFT"
    category: MaintenanceCategory
    status: MaintenanceStatus
    priority: MaintenancePriority = MaintenancePriority.MEDIUM
    airbase_id: str
    planned_start: str
    planned_completion: str
    actual_completion: Optional[str] = None
    estimated_duration_hours: float
    actual_duration_hours: Optional[float] = None
    description: str
    technician_lead: str
    last_update: str
    required_parts: List[Dict[str, Any]] = Field(default_factory=list)
    technician_notes: Optional[str] = None
    created_at: Optional[str] = None


class SupportInventory(BaseModel):
    item_id: str
    item_name: str
    category: InventoryCategory
    airbase_id: str
    quantity_on_hand: int = Field(..., ge=0)
    reserved_quantity: int = Field(default=0, ge=0)
    unit: str
    reorder_threshold: int = Field(..., ge=0)
    supplier_lead_time_days: int = Field(default=7, ge=1)
    last_audit: str
    status: InventoryStatus = InventoryStatus.ADEQUATE
    created_at: Optional[str] = None


# ==========================================
# APPROVAL WORKFLOW ENTITIES
# ==========================================

class ApprovalRequest(BaseModel):
    approval_id: str
    proposal_id: str
    title: str
    proposal_type: ProposalType
    requesting_agent: str
    reviewer_role_required: str
    reviewer_id: Optional[str] = None
    reviewer_role: Optional[str] = None
    status: ApprovalStatus = ApprovalStatus.PENDING
    created_at: str
    decided_at: Optional[str] = None
    reviewer_rationale: Optional[str] = None
    impact_summary: Dict[str, Any] = Field(default_factory=dict)
    proposal_version: int = 1


class ApprovalDecisionRequest(BaseModel):
    decision: str  # "APPROVED" | "REJECTED"
    reviewer_id: str
    reviewer_role: str
    rationale: Optional[str] = None


# ==========================================
# DATA FUSION & QUALITY AUDIT ENTITIES
# ==========================================

class DataQualityAnomaly(BaseModel):
    anomaly_id: str
    collection: str
    record_id: str
    category: str = "SCHEMA_VALIDATION"  # "SCHEMA_VALIDATION" | "RELATIONAL_INTEGRITY" | "BUSINESS_RULE" | "TEMPORAL_FRESHNESS" | "OPERATIONAL_CONFLICT"
    severity: str  # "CRITICAL" | "WARNING" | "INFO"
    rule_name: str
    description: str
    detected_at: str
    recommended_action: str


class DataQualityReport(BaseModel):
    overall_quality_score: float  # 0 to 100
    dataset_last_updated: str
    import_timestamp: str = "2026-10-07T06:00:00Z"
    sources: List[Dict[str, Any]]
    anomalies: List[DataQualityAnomaly]
    freshness_summary: Dict[str, Any]
    summary_stats: Dict[str, Any] = Field(default_factory=dict)


# ==========================================
# SCENARIO SIMULATION RESULTS & COMPARISON
# ==========================================

class ScenarioComparisonMetric(BaseModel):
    metric_name: str
    category: str
    baseline_value: float
    simulated_value: float
    delta: float
    unit: str
    impact: str  # "IMPROVED" | "DEGRADED" | "NEUTRAL"


class ScenarioComparison(BaseModel):
    scenario_id: str
    scenario_name: str
    applied_at: str
    metrics: List[ScenarioComparisonMetric]
    affected_records: List[Dict[str, Any]]
    conflicts_detected: List[str]
    status: str


# ==========================================
# HISTORICAL ANALYTICS & FORECASTING ENTITIES
# ==========================================

class HistoricalAnalyticsResponse(BaseModel):
    time_horizon_days: int
    readiness_trend: List[Dict[str, Any]]
    work_orders_throughput: List[Dict[str, Any]]
    inventory_turnover: List[Dict[str, Any]]
    data_quality_trend: List[Dict[str, Any]]
    scenario_frequency: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class ForecastResponse(BaseModel):
    forecast_horizon_days: int
    model_methodology: str
    assumptions: List[str]
    maintenance_workload_forecast: List[Dict[str, Any]]
    inventory_depletion_forecast: List[Dict[str, Any]]
    confidence_level: float
    synthetic_notice: str


# ==========================================
# STATE & SNAPSHOT
# ==========================================

class StateSnapshot(BaseModel):
    weapons_inventory: List[Weapon]
    aircraft_fleet: List[Aircraft]
    airbases: List[Airbase]
    pilots: List[Pilot]
    threat_environment: List[ThreatZone]
    mission_targets: List[MissionTarget]
    active_missions: List[ActiveMission] = Field(default_factory=list)
    event_log: List[EventLogEntry] = Field(default_factory=list)
    maintenance_records: List[MaintenanceRecord] = Field(default_factory=list)
    support_inventory: List[SupportInventory] = Field(default_factory=list)
    approval_requests: List[ApprovalRequest] = Field(default_factory=list)
    active_scenario_comparison: Optional[ScenarioComparison] = None
    last_updated: str


# ==========================================
# EVENT REPLAY & DEBRIEF SCHEMAS
# ==========================================

class ReplayStep(BaseModel):
    step_index: int
    event_id: str
    timestamp: str
    elapsed_seconds: float
    event_type: str
    category: str  # "INFRASTRUCTURE", "THREAT", "AIRCRAFT_FAULT", "SORTIE", "LIFECYCLE", "MAINTENANCE"
    severity: str  # "INFO", "WARNING", "CRITICAL"
    title: str
    description: str
    affected_entity_ids: List[str] = Field(default_factory=list)
    state_delta: Dict[str, Any] = Field(default_factory=dict)
    state_snapshot: StateSnapshot


class ReplaySessionSummary(BaseModel):
    session_id: str
    scenario_name: str
    start_time: str
    end_time: str
    duration_seconds: float
    event_count: int
    warnings_count: int
    critical_count: int
    status: str  # "COMPLETED", "RECORDING", "RESET"


class ReplaySession(BaseModel):
    session_id: str
    scenario_name: str
    start_time: str
    end_time: str
    duration_seconds: float
    event_count: int
    warnings_count: int
    critical_count: int
    status: str
    baseline_snapshot: StateSnapshot
    final_snapshot: Optional[StateSnapshot] = None
    steps: List[ReplayStep] = Field(default_factory=list)


class DebriefComparisonItem(BaseModel):
    entity_type: str  # "AIRCRAFT", "AIRBASE", "THREAT", "MISSION", "WORK_ORDER"
    entity_id: str
    name: str
    property_name: str
    baseline_value: Any
    final_value: Any
    responsible_event: Optional[str] = None
    returned_to_baseline: bool = False


class DebriefIncidentItem(BaseModel):
    incident_id: str
    timestamp: str
    elapsed_seconds: float
    title: str
    severity: str
    trigger_event: str
    affected_entities: List[str] = Field(default_factory=list)
    retasking_summary: str
    status_transition: str
    recovery_status: str  # e.g. "Resolved via Evasive Detour", "Resolved via Airbase Diversion", "Resolved via Standby Scramble", "Not recorded"
    recovery_timestamp: Optional[str] = None


class DebriefReport(BaseModel):
    session_id: str
    scenario_name: str
    start_time: str
    end_time: str
    duration_seconds: float
    total_events: int
    warnings_count: int
    critical_count: int
    final_state_summary: Dict[str, Any]
    event_breakdown_by_category: Dict[str, int]
    event_breakdown_by_severity: Dict[str, int]
    chronological_events: List[Dict[str, Any]]
    before_and_after_comparison: List[DebriefComparisonItem]
    incident_and_recovery_timeline: List[DebriefIncidentItem]
    lessons_and_observations: List[str]
    synthetic_notice: str = "Debrief report generated from synthetic operational simulation telemetry."

