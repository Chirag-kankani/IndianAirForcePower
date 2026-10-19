"""
Replay & Debrief Router for AirPower Decision-Support Platform.
Exposes endpoints to list recorded simulation sessions, retrieve step-by-step
historical state snapshots, and generate post-scenario debrief reports.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.models import (
    DebriefReport,
    ReplaySession,
    ReplaySessionSummary,
)
from app.replay_service import replay_service

router = APIRouter(prefix="/api/replay", tags=["Event Replay & Debrief"])


class CreateSessionRequest(BaseModel):
    scenario_name: Optional[str] = None


@router.get("/sessions", response_model=List[ReplaySessionSummary], summary="List all recorded scenario simulation sessions")
async def list_replay_sessions() -> List[ReplaySessionSummary]:
    """Returns list of all available recorded simulation sessions."""
    return replay_service.list_sessions()


@router.get("/sessions/{session_id}", response_model=ReplaySession, summary="Get full recorded session details and timeline steps")
async def get_replay_session(session_id: str) -> ReplaySession:
    """Returns the full session including all historical state snapshots and timeline steps."""
    session = replay_service.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Replay session '{session_id}' not found.",
        )
    return session


@router.post("/sessions", response_model=ReplaySession, status_code=status.HTTP_201_CREATED, summary="Start a new recording session")
async def create_replay_session(req: CreateSessionRequest) -> ReplaySession:
    """Starts a new recording session, capturing baseline state and preserving earlier sessions."""
    return replay_service.start_new_session(req.scenario_name)


@router.get("/sessions/{session_id}/debrief", response_model=DebriefReport, summary="Generate post-scenario debrief report")
async def get_session_debrief(session_id: str) -> DebriefReport:
    """Generates a complete post-scenario debrief report with before/after comparisons and incident timeline."""
    try:
        return replay_service.generate_debrief(session_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/sessions/{session_id}", summary="Permanently delete a recorded session from data")
async def delete_replay_session(session_id: str):
    """
    Permanently deletes a recorded scenario replay session and purges it
    from the persistent storage file (replay_sessions.json).
    """
    success = replay_service.delete_session(session_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Replay session '{session_id}' not found.",
        )
    remaining = replay_service.list_sessions()
    return {
        "status": "SUCCESS",
        "message": f"Session '{session_id}' permanently deleted from data.",
        "deleted_session_id": session_id,
        "remaining_count": len(remaining),
        "remaining_sessions": remaining,
    }


@router.delete("/sessions", summary="Clear all recorded sessions from data")
async def clear_all_replay_sessions(
    keep_demo: bool = Query(False, description="Whether to preserve the reference baseline demo scenario")
):
    """
    Permanently purges all replay sessions from disk storage and memory.
    """
    count = replay_service.delete_all_sessions(keep_demo=keep_demo)
    return {
        "status": "SUCCESS",
        "message": f"Cleared {count} replay session(s) from persistent data.",
        "cleared_count": count,
        "remaining_sessions": replay_service.list_sessions(),
    }
