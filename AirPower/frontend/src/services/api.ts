import {
  EventType,
  PlanMissionResponse,
  StateSnapshot,
  ActiveMission,
  TargetType,
  ReplaySessionSummary,
  ReplaySession,
  DebriefReport,
  WeatherStateResponse,
  AirbaseWeatherData,
  WeatherScenarioType,
  TaskWeatherImpactResponse,
  AssistantChatRequest,
  AssistantChatResponse,
  OperationMetadata,
  SuggestedQuestionCategory,
} from '../types';

const BASE_URL = '/api';

export async function fetchState(): Promise<StateSnapshot> {
  const res = await fetch(`${BASE_URL}/state`);
  if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);
  return res.json();
}

export async function planMission(params: {
  target_id?: string;
  custom_target?: { lat: number; lng: number; name?: string };
  target_type?: TargetType;
  priority_level?: number;
}): Promise<PlanMissionResponse> {
  const res = await fetch(`${BASE_URL}/missions/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to plan mission');
  }
  return res.json();
}

export async function deployPackage(packageId: string): Promise<ActiveMission> {
  const res = await fetch(`${BASE_URL}/missions/${packageId}/deploy`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to deploy package');
  }
  return res.json();
}

export async function triggerEvent(
  eventType: EventType,
  payload: Record<string, any> = {}
): Promise<any> {
  const res = await fetch(`${BASE_URL}/events/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to trigger event');
  }
  return res.json();
}

export async function closeMission(missionId: string): Promise<ActiveMission> {
  const res = await fetch(`${BASE_URL}/missions/${missionId}/close`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to close mission');
  }
  return res.json();
}

export async function resetScenario(): Promise<any> {
  const res = await fetch(`${BASE_URL}/events/reset`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to reset scenario: ${res.statusText}`);
  return res.json();
}

// ─── DATA FUSION & QUALITY ──────────────────────────────────────────────────
export async function fetchDataFusionReport(): Promise<any> {
  const res = await fetch(`${BASE_URL}/data-fusion/trust`);
  if (!res.ok) throw new Error(`Failed to fetch data fusion report: ${res.statusText}`);
  return res.json();
}

export async function inspectSourceCollection(collectionName: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/data-fusion/source/${collectionName}`);
  if (!res.ok) throw new Error(`Failed to inspect source collection: ${res.statusText}`);
  return res.json();
}

export async function forceRevalidateData(): Promise<any> {
  const res = await fetch(`${BASE_URL}/data-fusion/revalidate`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to force revalidate: ${res.statusText}`);
  return res.json();
}

// ─── MAINTENANCE & LOGISTICS ────────────────────────────────────────────────
export async function fetchMaintenanceSummary(): Promise<any> {
  const res = await fetch(`${BASE_URL}/maintenance/summary`);
  if (!res.ok) throw new Error(`Failed to fetch maintenance summary: ${res.statusText}`);
  return res.json();
}

export async function fetchAircraftMaintenanceHistory(aircraftId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/maintenance/history/${aircraftId}`);
  if (!res.ok) throw new Error(`Failed to fetch aircraft maintenance history: ${res.statusText}`);
  return res.json();
}

export async function fetchMaintenanceRecords(params?: {
  status?: string;
  airbase_id?: string;
  priority?: string;
  resource_id?: string;
}): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'ALL') query.append('status', params.status);
  if (params?.airbase_id && params.airbase_id !== 'ALL') query.append('airbase_id', params.airbase_id);
  if (params?.priority && params.priority !== 'ALL') query.append('priority', params.priority);
  if (params?.resource_id && params.resource_id !== 'ALL') query.append('resource_id', params.resource_id);

  const res = await fetch(`${BASE_URL}/maintenance?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch maintenance records: ${res.statusText}`);
  return res.json();
}

export async function createMaintenanceRecord(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/maintenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create work order');
  }
  return res.json();
}

export async function updateMaintenanceStatus(
  recordId: string,
  status: string,
  actualDurationHours?: number,
  notes?: string
): Promise<any> {
  const res = await fetch(`${BASE_URL}/maintenance/${recordId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      actual_duration_hours: actualDurationHours,
      technician_notes: notes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update work order');
  }
  return res.json();
}

export async function fetchSupportInventory(params?: {
  category?: string;
  airbase_id?: string;
  low_stock_only?: boolean;
}): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'ALL') query.append('category', params.category);
  if (params?.airbase_id && params.airbase_id !== 'ALL') query.append('airbase_id', params.airbase_id);
  if (params?.low_stock_only) query.append('low_stock_only', 'true');

  const res = await fetch(`${BASE_URL}/inventory?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch support inventory: ${res.statusText}`);
  return res.json();
}

export async function adjustInventory(
  itemId: string,
  adjustmentQuantity: number,
  reason: string
): Promise<any> {
  const res = await fetch(`${BASE_URL}/inventory/${itemId}/adjust`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adjustment_quantity: adjustmentQuantity, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to adjust inventory');
  }
  return res.json();
}

// ─── APPROVAL WORKFLOW ──────────────────────────────────────────────────────
export async function fetchApprovals(statusFilter?: string): Promise<any[]> {
  const query = statusFilter && statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
  const res = await fetch(`${BASE_URL}/approvals${query}`);
  if (!res.ok) throw new Error(`Failed to fetch approvals: ${res.statusText}`);
  return res.json();
}

export async function createApprovalProposal(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create proposal');
  }
  return res.json();
}

export async function decideApproval(
  approvalId: string,
  params: {
    decision: 'APPROVED' | 'REJECTED';
    reviewer_id: string;
    reviewer_role: string;
    rationale?: string;
  }
): Promise<any> {
  const res = await fetch(`${BASE_URL}/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to submit approval decision');
  }
  return res.json();
}

// ─── HISTORICAL ANALYTICS & FORECASTING ─────────────────────────────────────
export async function fetchHistoricalAnalytics(days: number = 30): Promise<any> {
  const res = await fetch(`${BASE_URL}/analytics/historical?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch analytics: ${res.statusText}`);
  return res.json();
}

export async function fetchForecast(days: number = 14): Promise<any> {
  const res = await fetch(`${BASE_URL}/analytics/forecast?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch forecast: ${res.statusText}`);
  return res.json();
}

// ─── SCENARIO BEFORE/AFTER COMPARISON ───────────────────────────────────────
export async function fetchScenarioComparison(): Promise<any> {
  const res = await fetch(`${BASE_URL}/events/comparison`);
  if (!res.ok) throw new Error(`Failed to fetch scenario comparison: ${res.statusText}`);
  return res.json();
}

// ─── EVENT REPLAY & DEBRIEF ─────────────────────────────────────────────────
export async function fetchReplaySessions(): Promise<ReplaySessionSummary[]> {
  const res = await fetch(`${BASE_URL}/replay/sessions`);
  if (!res.ok) throw new Error(`Failed to fetch replay sessions: ${res.statusText}`);
  return res.json();
}

export async function fetchReplaySession(sessionId: string): Promise<ReplaySession> {
  const res = await fetch(`${BASE_URL}/replay/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Failed to fetch replay session: ${res.statusText}`);
  return res.json();
}

export async function fetchDebriefReport(sessionId: string): Promise<DebriefReport> {
  const res = await fetch(`${BASE_URL}/replay/sessions/${sessionId}/debrief`);
  if (!res.ok) throw new Error(`Failed to fetch debrief report: ${res.statusText}`);
  return res.json();
}

export async function startNewReplaySession(name?: string): Promise<ReplaySession> {
  const res = await fetch(`${BASE_URL}/replay/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_name: name }),
  });
  if (!res.ok) throw new Error(`Failed to start replay session: ${res.statusText}`);
  return res.json();
}

export async function deleteReplaySession(sessionId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/replay/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to delete replay session');
  }
  return res.json();
}

export async function clearAllReplaySessions(keepDemo: boolean = false): Promise<any> {
  const res = await fetch(`${BASE_URL}/replay/sessions?keep_demo=${keepDemo}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to clear replay sessions');
  }
  return res.json();
}

// ─── LIVE WEATHER & ENVIRONMENTAL RISK ──────────────────────────────────────
export async function fetchTheatreWeather(forceRefresh: boolean = false): Promise<WeatherStateResponse> {
  const res = await fetch(`${BASE_URL}/weather/theatre${forceRefresh ? '?force_refresh=true' : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch theatre weather: ${res.statusText}`);
  return res.json();
}

export async function fetchAirbaseWeather(airbaseId: string, forceRefresh: boolean = false): Promise<AirbaseWeatherData> {
  const res = await fetch(`${BASE_URL}/weather/airbase/${airbaseId}${forceRefresh ? '?force_refresh=true' : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch airbase weather: ${res.statusText}`);
  return res.json();
}

export async function acknowledgeWeatherAlert(alertId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/weather/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to acknowledge alert: ${res.statusText}`);
  return res.json();
}

export async function injectWeatherScenario(
  airbaseId: string,
  scenarioType: WeatherScenarioType,
  customLabel?: string
): Promise<AirbaseWeatherData> {
  const res = await fetch(`${BASE_URL}/weather/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_type: scenarioType,
      airbase_id: airbaseId,
      custom_label: customLabel,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to inject weather scenario');
  }
  return res.json();
}

export async function resetWeatherScenario(airbaseId?: string): Promise<any> {
  const url = airbaseId
    ? `${BASE_URL}/weather/simulate/reset?airbase_id=${encodeURIComponent(airbaseId)}`
    : `${BASE_URL}/weather/simulate/reset`;
  const res = await fetch(url, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to reset weather scenario');
  }
  return res.json();
}

export async function fetchTaskWeatherImpact(
  departureAirbaseId: string,
  targetId?: string,
  scheduledTime?: string
): Promise<TaskWeatherImpactResponse> {
  let url = `${BASE_URL}/weather/task-impact?departure_airbase_id=${encodeURIComponent(departureAirbaseId)}`;
  if (targetId) url += `&target_id=${encodeURIComponent(targetId)}`;
  if (scheduledTime) url += `&scheduled_time=${encodeURIComponent(scheduledTime)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch task weather impact: ${res.statusText}`);
  return res.json();
}

// -------------------------------------------------------------
// AI Operations Assistant API
// -------------------------------------------------------------

export async function sendAssistantChat(
  req: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const res = await fetch(`${BASE_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Assistant query failed');
  }
  return res.json();
}

export async function fetchAssistantOperations(): Promise<OperationMetadata[]> {
  const res = await fetch(`${BASE_URL}/assistant/operations`);
  if (!res.ok) throw new Error(`Failed to fetch assistant operations: ${res.statusText}`);
  return res.json();
}

export async function fetchSuggestedQuestions(): Promise<{
  categories: SuggestedQuestionCategory[];
}> {
  const res = await fetch(`${BASE_URL}/assistant/suggested-questions`);
  if (!res.ok) throw new Error(`Failed to fetch suggested questions: ${res.statusText}`);
  return res.json();
}



