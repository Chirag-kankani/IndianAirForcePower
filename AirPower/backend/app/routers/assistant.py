"""
API Router for AI Operations Assistant.
Exposes endpoints for natural language inquiries, allowlisted direct queries,
and supported operations discovery.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Query, status

from app.assistant_models import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantOperationName,
    DirectQueryRequest,
    DirectQueryResponse,
    OperationMetadata,
)
from app.assistant_service import OPERATIONS_METADATA, assistant_service

router = APIRouter(prefix="/api/assistant", tags=["AI Operations Assistant"])


@router.post("/chat", response_model=AssistantChatResponse, summary="Natural language operational query")
async def assistant_chat_endpoint(req: AssistantChatRequest) -> AssistantChatResponse:
    """
    Receives an operator question, classifies operational intent,
    executes an allowlisted read-only query against actual application datasets,
    and returns a factual structured response with matching evidence records and navigation targets.
    """
    try:
        return await assistant_service.handle_chat_query(req)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assistant query execution failed: {str(e)}",
        )


@router.get("/operations", response_model=List[OperationMetadata], summary="List approved read-only operations")
async def list_operations_endpoint() -> List[OperationMetadata]:
    """
    Returns the complete allowlist of approved read-only operations,
    including parameter schemas, descriptions, and example questions.
    """
    return assistant_service.get_supported_operations()


@router.post("/query", response_model=DirectQueryResponse, summary="Directly execute an approved read-only operation")
async def direct_query_endpoint(req: DirectQueryRequest) -> DirectQueryResponse:
    """
    Directly invokes an approved read-only operation with validated parameters,
    bypassing NLP classification (useful for programmatic dashboards and tests).
    """
    start_time = time.perf_counter()

    if req.operation not in OPERATIONS_METADATA or req.operation == AssistantOperationName.UNSUPPORTED_OR_UNKNOWN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Operation '{req.operation}' is not an approved read-only operation.",
        )

    records, summary = await assistant_service.execute_operation(
        req.operation, req.parameters, limit=req.limit
    )
    exec_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return DirectQueryResponse(
        operation=req.operation.value,
        record_count=len(records),
        records=records,
        summary=summary,
        execution_time_ms=exec_ms,
    )


@router.get("/suggested-questions", response_model=Dict[str, Any], summary="Get suggested operational questions")
async def get_suggested_questions() -> Dict[str, Any]:
    """
    Returns curated operational questions grouped by operational domain.
    """
    return {
        "categories": [
            {
                "category": "Maintenance & Logistics",
                "icon": "Wrench",
                "questions": [
                    {"text": "Which maintenance work orders are overdue?", "operation": "getOverdueMaintenance"},
                    {"text": "Summarise inventory shortages.", "operation": "getInventoryShortages"},
                    {"text": "Show open depot work orders.", "operation": "getMaintenanceWorkOrders"},
                ],
            },
            {
                "category": "Data Trust & Integrity",
                "icon": "Database",
                "questions": [
                    {"text": "Which data sources have stale records?", "operation": "getStaleDataSources"},
                    {"text": "Show aircraft records with missing airbase references.", "operation": "getAircraftWithMissingReferences"},
                    {"text": "Show all data quality anomalies.", "operation": "getDataQualityIssues"},
                ],
            },
            {
                "category": "Fleet & Operations",
                "icon": "Plane",
                "questions": [
                    {"text": "Which aircraft have incomplete readiness information?", "operation": "getAircraftReadinessSummary"},
                    {"text": "Show me the records that need attention.", "operation": "getRecordsNeedingAttention"},
                    {"text": "Which runways are currently operational or blocked?", "operation": "getAirbaseStatus"},
                ],
            },
            {
                "category": "Weather & Simulations",
                "icon": "CloudRain",
                "questions": [
                    {"text": "Summarise the latest weather alerts.", "operation": "getWeatherAlerts"},
                    {"text": "What changed in the last simulation?", "operation": "getLatestSimulationSummary"},
                    {"text": "Show recent tactical events.", "operation": "getRecentSimulationEvents"},
                ],
            },
        ]
    }
