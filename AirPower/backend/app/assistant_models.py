"""
Data models and schemas for AirPower AI Operations Assistant.
Strictly typed Pydantic models for queries, allowlisted operations,
conversation context, and structured record evidence.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AssistantOperationName(str, Enum):
    GET_OVERDUE_MAINTENANCE = "getOverdueMaintenance"
    GET_MAINTENANCE_WORK_ORDERS = "getMaintenanceWorkOrders"
    GET_STALE_DATA_SOURCES = "getStaleDataSources"
    GET_DATA_QUALITY_ISSUES = "getDataQualityIssues"
    GET_AIRCRAFT_WITH_MISSING_REFERENCES = "getAircraftWithMissingReferences"
    GET_AIRCRAFT_READINESS_SUMMARY = "getAircraftReadinessSummary"
    GET_INVENTORY_SHORTAGES = "getInventoryShortages"
    GET_LATEST_SIMULATION_SUMMARY = "getLatestSimulationSummary"
    GET_RECENT_SIMULATION_EVENTS = "getRecentSimulationEvents"
    GET_WEATHER_ALERTS = "getWeatherAlerts"
    GET_RECORDS_NEEDING_ATTENTION = "getRecordsNeedingAttention"
    GET_AIRBASE_STATUS = "getAirbaseStatus"
    UNSUPPORTED_OR_UNKNOWN = "unsupportedOrUnknown"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str
    timestamp: Optional[str] = None
    operation_used: Optional[str] = None
    record_count: Optional[int] = None


class StructuredRecordItem(BaseModel):
    record_id: str
    title: str
    category: str
    status: str
    severity: str  # "CRITICAL" | "HIGH" | "WARNING" | "INFO" | "OVERDUE" | "NOMINAL"
    match_reason: str
    source_module: str  # "MAINTENANCE" | "DATA_FUSION" | "AIRCRAFT" | "INVENTORY" | "WEATHER" | "SIMULATION" | "AIRBASE"
    timestamp: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    target_view: Optional[str] = None  # "MAINTENANCE" | "DATA_FUSION" | "DASHBOARD" | "WEATHER" | "MAP" | "REPLAY" | "AUDIT"
    target_id: Optional[str] = None


class AssistantChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000, description="Natural language question from operator")
    conversation_history: List[ChatMessage] = Field(default_factory=list, description="Recent conversation turns in current session")
    session_id: Optional[str] = None
    max_records: int = Field(default=20, ge=1, le=50, description="Maximum matching records to return")


class AssistantChatResponse(BaseModel):
    answer_markdown: str
    operation_used: str
    operation_display_name: str
    parameters_used: Dict[str, Any] = Field(default_factory=dict)
    total_matching_records: int = 0
    returned_records: List[StructuredRecordItem] = Field(default_factory=list)
    suggested_followups: List[str] = Field(default_factory=list)
    navigation_link: Optional[str] = None
    limitations_notice: Optional[str] = None
    data_freshness_timestamp: str
    provider_used: str
    execution_time_ms: float


class DirectQueryRequest(BaseModel):
    operation: AssistantOperationName
    parameters: Dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=20, ge=1, le=50)


class DirectQueryResponse(BaseModel):
    operation: str
    record_count: int
    records: List[StructuredRecordItem]
    summary: str
    execution_time_ms: float


class OperationMetadata(BaseModel):
    operation_name: str
    display_name: str
    description: str
    supported_parameters: Dict[str, str]
    target_module: str
    example_questions: List[str]
