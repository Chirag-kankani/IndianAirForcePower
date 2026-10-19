export type WeaponCategory =
  | 'AIR_TO_AIR_MISSILE'
  | 'PRECISION_GUIDED_BOMB'
  | 'ANTI_RADIATION_MISSILE'
  | 'ANTI_SHIP';

export type GuidanceType = 'ACTIVE_RADAR' | 'GPS_ELECTRO_OPTICAL' | 'PASSIVE_HOMING';

export type AircraftStatus = 'READY' | 'MAINTENANCE' | 'AIRBORNE' | 'ABORTED';

export type RunwayStatus = 'OPERATIONAL' | 'BLOCKED';

export type PilotQualification =
  | 'NIGHT_OPERATIONS'
  | 'DEAD_SEAD_CERTIFIED'
  | 'ALL_WEATHER'
  | 'ANTI_SHIP_CERTIFIED';

export type ThreatType = 'SAM_RADAR_BATTERY' | 'EW_JAMMING_CORRIDOR' | 'SEVERE_WEATHER';

export type TargetType =
  | 'HARDENED_BUNKER'
  | 'RADAR_STATION'
  | 'CONVOY'
  | 'AIRFIELD'
  | 'NAVAL_VESSEL';

export type MissionStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'REROUTED'
  | 'RETURNING'
  | 'COMPLETED'
  | 'ABORTED';

export type EventType =
  | 'RUNWAY_BLOCKED'
  | 'NEW_THREAT_ZONE'
  | 'AIRCRAFT_FAILURE'
  | 'WEATHER_ALERT'
  | 'WEATHER_SCENARIO_INJECTED'
  | 'WEATHER_SCENARIO_RESET';

export interface Location {
  lat: float;
  lng: float;
  name?: string;
}

export type float = number;

export interface Waypoint {
  lat: number;
  lng: number;
  name: string;
  action?: string;
}

export interface Weapon {
  weapon_id: string;
  name: string;
  category: WeaponCategory;
  guidance_type: GuidanceType;
  weight_kg: number;
  effective_range_km: number;
  stock_count: number;
  effective_against: TargetType[];
}

export interface EquippedWeapon {
  weapon_id: string;
  quantity: number;
}

export interface Aircraft {
  aircraft_id: string;
  model: string;
  callsign: string;
  home_base_id: string;
  status: AircraftStatus;
  asset_type?: 'COMBAT_JET' | 'RESCUE_HELICOPTER' | 'TRANSPORT_HELICOPTER';
  current_fuel_pct: number;
  max_fuel_capacity_liters: number;
  max_takeoff_weight_kg: number;
  empty_weight_kg: number;
  hardpoints_count: number;
  equipped_weapons: EquippedWeapon[];
  turnaround_time_mins: number;
  fuel_burn_liters_per_km: number;
  cruise_speed_kmph: number;
  current_fuel_liters: number;
  max_range_km: number;
  total_equipped_weapons_count: number;
}

export interface Airbase {
  id: string;
  name: string;
  lat: number;
  lng: number;
  runway_status: RunwayStatus;
  available_fuel_liters: number;
  stored_weapons?: EquippedWeapon[];
}

export interface Pilot {
  pilot_id: string;
  name: string;
  rank: string;
  qualifications: PilotQualification[];
  rest_hours_completed: number;
  consecutive_flight_hours: number;
  assigned_aircraft_id?: string | null;
  home_base_id: string;
}

export interface ThreatZone {
  threat_id: string;
  name: string;
  type: ThreatType;
  center_location: Location;
  effective_radius_km: number;
  threat_severity: number;
  countermeasure_required: string;
}

export interface MissionTarget {
  target_id: string;
  name: string;
  location: Location;
  target_type: TargetType;
  required_weapon_category: WeaponCategory;
  priority_level: number;
  time_window_mins: number;
  required_pilot_qualifications: PilotQualification[];
}

export interface ConstraintCheck {
  constraint: string;
  passed: boolean;
  actual_value: string;
  required_value: string;
  explanation: string;
}

export interface ScoreBreakdown {
  fuel: number;
  threat: number;
  turnaround: number;
  priority_bonus: number;
  base_cost?: number;
  fuel_cost_inr?: number;
  flight_hours_cost_inr?: number;
  munitions_cost_inr?: number;
  ground_support_inr?: number;
  total_estimated_cost_inr?: number;
  estimated_cost_lakhs?: number;
}

export interface OrdnancePayloadItem {
  weapon_id: string;
  name: string;
  qty: number;
  weight_kg: number;
  category: WeaponCategory;
}

export interface RouteInfo {
  waypoints: Waypoint[];
  distance_km: number;
  eta_mins: number;
  fuel_needed_liters: number;
  threat_exposure_score: number;
  rerouted: boolean;
  detour_notes?: string;
}

export interface MissionPackage {
  package_id: string;
  rank: number;
  total_score: number;
  target_id: string;
  aircraft: Aircraft;
  pilot: Pilot;
  airbase: Airbase;
  ordnance_payload: OrdnancePayloadItem[];
  route: RouteInfo;
  score_breakdown: ScoreBreakdown;
  constraint_report: ConstraintCheck[];
  estimated_cost_lakhs?: number;
}

export interface ActiveMission {
  mission_id: string;
  package_id: string;
  target: MissionTarget;
  aircraft: Aircraft;
  pilot: Pilot;
  airbase: Airbase;
  ordnance_payload: OrdnancePayloadItem[];
  route: RouteInfo;
  status: MissionStatus;
  deployed_at: string;
  current_waypoint_index: number;
  current_position: Location;
}

export interface RetaskAction {
  mission_id: string;
  aircraft_id: string;
  action_type: string;
  reason: string;
  details: string;
  added_time_mins?: number;
  new_recovery_base_id?: string;
}

export type MaintenanceCategory =
  | 'SCHEDULED_INSPECTION'
  | 'AVIONICS_REPAIR'
  | 'ENGINE_OVERHAUL'
  | 'HYDRAULIC_SERVICE'
  | 'AIRFRAME_STRUCTURAL'
  | 'UNSCHEDULED_FAULT';

export type MaintenanceStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'OVERDUE';
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MaintenancePartRequirement {
  item_id: string;
  item_name?: string;
  quantity_needed: number;
}

export interface MaintenanceRecord {
  record_id: string;
  resource_id: string;
  resource_type: string;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  airbase_id: string;
  planned_start: string;
  planned_completion: string;
  actual_completion?: string | null;
  estimated_duration_hours: number;
  actual_duration_hours?: number | null;
  description: string;
  technician_lead: string;
  last_update: string;
  required_parts?: MaintenancePartRequirement[];
  technician_notes?: string | null;
  created_at?: string | null;
}

export interface MaintenanceSummary {
  total_work_orders: number;
  scheduled_open: number;
  in_progress: number;
  completed: number;
  overdue: number;
  on_hold: number;
  cancelled: number;
  total_support_inventory_items: number;
  low_stock_alerts_count: number;
  critical_reorder_count: number;
  blocked_work_orders_count: number;
  last_updated: string;
}

export type InventoryCategory =
  | 'PROPULSION_SPARE'
  | 'AVIONICS_LRU'
  | 'GROUND_SUPPORT_EQUIPMENT'
  | 'HYDRAULIC_FLUID'
  | 'OXYGEN_CANISTER'
  | 'MUNITION_COMPONENT';

export type InventoryStatus = 'ADEQUATE' | 'LOW_STOCK' | 'CRITICAL_REORDER';

export interface SupportInventory {
  item_id: string;
  item_name: string;
  category: InventoryCategory;
  airbase_id: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  unit: string;
  reorder_threshold: number;
  supplier_lead_time_days: number;
  last_audit: string;
  status: InventoryStatus;
  created_at?: string | null;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ProposalType =
  | 'CONTINGENCY_DIVERSION'
  | 'MAINTENANCE_SCHEDULE_OVERRIDE'
  | 'RESOURCE_REALLOCATION'
  | 'FLIGHT_CREW_EXTENSION';

export interface ApprovalRequest {
  approval_id: string;
  proposal_id: string;
  title: string;
  proposal_type: ProposalType;
  requesting_agent: string;
  reviewer_role_required: string;
  reviewer_id?: string | null;
  reviewer_role?: string | null;
  status: ApprovalStatus;
  created_at: string;
  decided_at?: string | null;
  reviewer_rationale?: string | null;
  impact_summary?: Record<string, any>;
  proposal_version: number;
}

export interface DataQualityAnomaly {
  anomaly_id: string;
  collection: string;
  record_id: string;
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  rule_name: string;
  description: string;
  detected_at: string;
  recommended_action: string;
}

export interface DataSourceMeta {
  collection: string;
  name: string;
  record_count: number;
  source_type: string;
  provenance: string;
  schema_version: string;
  record_level_timestamps: boolean;
  last_updated: string;
  calculated_age_hours: number;
  freshness_threshold_hours: number;
  freshness: 'FRESH' | 'STALE' | 'VALIDATION_REQUIRED';
  validation_status: 'PASSED' | 'WARNING' | 'FAILED';
  detected_issues_count: number;
}

export interface DataQualityReport {
  overall_quality_score: number;
  dataset_last_updated: string;
  import_timestamp?: string;
  sources: DataSourceMeta[];
  anomalies: DataQualityAnomaly[];
  freshness_summary: {
    fresh: number;
    stale: number;
    validation_required: number;
    total_anomalies: number;
    critical_anomalies: number;
    warning_anomalies: number;
    info_anomalies?: number;
  };
  summary_stats?: {
    total_records_examined?: number;
    records_passing_validation?: number;
    records_requiring_review?: number;
    collections_count?: number;
    synthetic_disclaimer?: string;
  };
}

export interface ScenarioComparisonMetric {
  metric_name: string;
  category: string;
  baseline_value: number;
  simulated_value: number;
  delta: number;
  unit: string;
  impact: 'IMPROVED' | 'DEGRADED' | 'NEUTRAL';
}

export interface ScenarioComparison {
  scenario_id: string;
  scenario_name: string;
  applied_at: string;
  metrics: ScenarioComparisonMetric[];
  affected_records: Array<{
    entity_type: string;
    entity_id: string;
    label: string;
    baseline_state: string;
    simulated_state: string;
    notes: string;
  }>;
  conflicts_detected: string[];
  status: string;
}

export interface HistoricalAnalyticsResponse {
  time_horizon_days: number;
  readiness_trend: Array<{
    date: string;
    readiness_pct: number;
    ready_aircraft: number;
    total_aircraft: number;
  }>;
  work_orders_throughput: Array<{
    date: string;
    completed: number;
    open: number;
    overdue: number;
  }>;
  inventory_turnover: Array<{
    date: string;
    average_stock_health_pct: number;
    reorders_triggered: number;
  }>;
  data_quality_trend: Array<{
    date: string;
    quality_score: number;
    anomalies_detected: number;
  }>;
  scenario_frequency: Array<{
    date: string;
    incident_count: number;
    mean_resolution_mins: number;
  }>;
  metadata: Record<string, any>;
}

export interface ForecastResponse {
  forecast_horizon_days: number;
  model_methodology: string;
  assumptions: string[];
  maintenance_workload_forecast: Array<{
    date: string;
    forecast_day: number;
    projected_new_work_orders: number;
    estimated_labor_hours: number;
    confidence_band_lower: number;
    confidence_band_upper: number;
    primary_driver: string;
  }>;
  inventory_depletion_forecast: Array<{
    item_id: string;
    item_name: string;
    category: string;
    airbase_id: string;
    current_stock: number;
    reorder_threshold: number;
    projected_days_to_reorder: number;
    lead_time_days: number;
    recommended_action: string;
  }>;
  confidence_level: number;
  synthetic_notice: string;
}

export interface EventLogEntry {
  event_id: string;
  timestamp: string;
  event_type: any;
  description: string;
  affected_assets: string[];
  retasking_actions: RetaskAction[];
  entity_type?: string;
  entity_id?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'ALERT';
  source?: string;
  scenario_id?: string;
  details?: Record<string, any>;
}

export interface StateSnapshot {
  weapons_inventory: Weapon[];
  aircraft_fleet: Aircraft[];
  airbases: Airbase[];
  pilots: Pilot[];
  threat_environment: ThreatZone[];
  mission_targets: MissionTarget[];
  active_missions: ActiveMission[];
  event_log: EventLogEntry[];
  maintenance_records?: MaintenanceRecord[];
  support_inventory?: SupportInventory[];
  approval_requests?: ApprovalRequest[];
  active_scenario_comparison?: ScenarioComparison | null;
  last_updated: string;
}

export interface PlanMissionResponse {
  status: 'FEASIBLE' | 'INFEASIBLE';
  target: MissionTarget;
  packages: MissionPackage[];
  infeasibility_summary?: {
    total_evaluated_combinations: number;
    feasible_combinations_count?: number;
    rejection_reasons?: Record<string, number>;
  };
  message: string;
}

export interface ReplayStep {
  step_index: number;
  event_id: string;
  timestamp: string;
  elapsed_seconds: number;
  event_type: string;
  category: 'INFRASTRUCTURE' | 'THREAT' | 'AIRCRAFT_FAULT' | 'SORTIE' | 'LIFECYCLE' | 'MAINTENANCE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  affected_entity_ids: string[];
  state_delta: Record<string, any>;
  state_snapshot: StateSnapshot;
}

export interface ReplaySessionSummary {
  session_id: string;
  scenario_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  event_count: number;
  warnings_count: number;
  critical_count: number;
  status: 'COMPLETED' | 'RECORDING' | 'RESET';
}

export interface ReplaySession {
  session_id: string;
  scenario_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  event_count: number;
  warnings_count: number;
  critical_count: number;
  status: string;
  baseline_snapshot: StateSnapshot;
  final_snapshot?: StateSnapshot | null;
  steps: ReplayStep[];
}

export interface DebriefComparisonItem {
  entity_type: string;
  entity_id: string;
  name: string;
  property_name: string;
  baseline_value: any;
  final_value: any;
  responsible_event?: string;
  returned_to_baseline: boolean;
}

export interface DebriefIncidentItem {
  incident_id: string;
  timestamp: string;
  elapsed_seconds: number;
  title: string;
  severity: string;
  trigger_event: string;
  affected_entities: string[];
  retasking_summary: string;
  status_transition: string;
  recovery_status: string;
  recovery_timestamp?: string | null;
}

export interface DebriefReport {
  session_id: string;
  scenario_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  total_events: number;
  warnings_count: number;
  critical_count: number;
  final_state_summary: Record<string, any>;
  event_breakdown_by_category: Record<string, number>;
  event_breakdown_by_severity: Record<string, number>;
  chronological_events: Array<{
    step_index: number;
    event_id: string;
    timestamp: string;
    elapsed_seconds: number;
    title: string;
    event_type: string;
    category: string;
    severity: string;
    description: string;
    affected_entities: string[];
  }>;
  before_and_after_comparison: DebriefComparisonItem[];
  incident_and_recovery_timeline: DebriefIncidentItem[];
  lessons_and_observations: string[];
  synthetic_notice: string;
}

export type WeatherRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';

export type WeatherAlertCategory =
  | 'WIND'
  | 'PRECIPITATION'
  | 'VISIBILITY'
  | 'THUNDERSTORM'
  | 'STALE_DATA'
  | 'EXTREME_TEMPERATURE';

export type WeatherAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ContributingFactor {
  factor: string;
  measured_value: any;
  threshold_value: any;
  severity: 'MODERATE' | 'HIGH' | 'INFO';
  is_forecast: boolean;
  timestamp: string;
  rule_triggered: string;
  explanation: string;
}

export interface EnvironmentalRiskAssessment {
  overall_risk: WeatherRiskLevel;
  confidence: string;
  is_forecast: boolean;
  evaluated_at: string;
  contributing_factors: ContributingFactor[];
  summary_assessment: string;
  advisory_notice: string;
}

export interface CurrentWeather {
  time: string;
  temperature_c: number;
  relative_humidity_pct: number;
  precipitation_mm: number;
  rain_mm: number;
  weather_code: number;
  weather_description: string;
  cloud_cover_pct: number;
  pressure_hpa: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  wind_gusts_kmh: number;
  visibility_m?: number | null;
}

export interface HourlyForecastItem {
  time: string;
  temperature_c: number;
  precipitation_probability_pct?: number | null;
  precipitation_mm: number;
  rain_mm: number;
  weather_code: number;
  weather_description: string;
  cloud_cover_pct: number;
  pressure_hpa: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  wind_gusts_kmh: number;
  visibility_m?: number | null;
  forecast_risk?: EnvironmentalRiskAssessment | null;
}

export interface AirbaseWeatherData {
  airbase_id: string;
  airbase_name: string;
  lat: number;
  lng: number;
  current?: CurrentWeather | null;
  hourly: HourlyForecastItem[];
  observation_time?: string | null;
  data_source: string;
  provider_name: string;
  last_updated: string;
  status: string; // 'LIVE' | 'SIMULATED' | 'STALE' | 'ERROR' | 'NO_DATA'
  is_live: boolean;
  is_synthetic: boolean;
  is_stale: boolean;
  error_message?: string | null;
  risk_assessment: EnvironmentalRiskAssessment;
  live_backup?: Record<string, any> | null;
}

export interface WeatherAlert {
  alert_id: string;
  airbase_id: string;
  airbase_name: string;
  category: WeatherAlertCategory;
  severity: WeatherAlertSeverity;
  triggering_variable: string;
  measured_value: string;
  threshold_value: string;
  observation_timestamp: string;
  created_at: string;
  data_source: string;
  acknowledged: boolean;
  status: 'ACTIVE' | 'CLEARED' | 'ACKNOWLEDGED';
  message: string;
}

export interface WeatherRiskConfig {
  wind_speed_moderate_kmh: number;
  wind_speed_high_kmh: number;
  wind_gust_moderate_kmh: number;
  wind_gust_high_kmh: number;
  precipitation_moderate_mm: number;
  precipitation_heavy_mm: number;
  visibility_low_meters: number;
  visibility_critical_meters: number;
  cloud_cover_high_pct: number;
  stale_threshold_minutes: number;
  severe_weather_codes: number[];
}

export type WeatherScenarioType =
  | 'GALE_WINDS'
  | 'MONSOON_DOWNPOUR'
  | 'DENSE_FOG'
  | 'THUNDERSTORM_SQUALL';

export interface WeatherStateResponse {
  airbases: AirbaseWeatherData[];
  alerts: WeatherAlert[];
  theatre_summary: {
    total_monitored_airbases: number;
    low_risk_count: number;
    moderate_risk_count: number;
    high_risk_count: number;
    unknown_risk_count: number;
    active_alerts_count: number;
    simulated_airbases_count: number;
    theatre_environmental_status: string;
    primary_provider: string;
    provider_attribution: string;
    cache_freshness_seconds: number;
  };
  config: WeatherRiskConfig;
  simulated_airbase_ids: string[];
  last_synced_at: string;
  data_provider: string;
}

export interface TaskWeatherImpactResponse {
  departure_airbase?: AirbaseWeatherData | null;
  target_location_weather?: AirbaseWeatherData | null;
  scheduled_time?: string | null;
  target_id?: string | null;
  combined_risk: WeatherRiskLevel;
  primary_risk_factors: ContributingFactor[];
  advisory_recommendation: string;
  data_freshness_status: string;
}

// ==========================================
// AI OPERATIONS ASSISTANT TYPES
// ==========================================

export interface AssistantChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  operation_used?: string;
  record_count?: number;
}

export interface StructuredRecordItem {
  record_id: string;
  title: string;
  category: string;
  status: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO' | 'OVERDUE' | 'NOMINAL' | string;
  match_reason: string;
  source_module: string;
  timestamp?: string;
  details: Record<string, any>;
  target_view?: 'MAINTENANCE' | 'DATA_FUSION' | 'DASHBOARD' | 'WEATHER' | 'MAP' | 'REPLAY' | 'AUDIT' | string;
  target_id?: string;
}

export interface AssistantChatRequest {
  question: string;
  conversation_history?: AssistantChatMessage[];
  session_id?: string;
  max_records?: number;
}

export interface AssistantChatResponse {
  answer_markdown: str;
  operation_used: string;
  operation_display_name: string;
  parameters_used: Record<string, any>;
  total_matching_records: number;
  returned_records: StructuredRecordItem[];
  suggested_followups: string[];
  navigation_link?: string | null;
  limitations_notice?: string | null;
  data_freshness_timestamp: string;
  provider_used: string;
  execution_time_ms: number;
}

export type str = string;

export interface OperationMetadata {
  operation_name: string;
  display_name: string;
  description: string;
  supported_parameters: Record<string, string>;
  target_module: string;
  example_questions: string[];
}

export interface SuggestedQuestionItem {
  text: string;
  operation: string;
}

export interface SuggestedQuestionCategory {
  category: string;
  icon: string;
  questions: SuggestedQuestionItem[];
}



