"""
Approval Workflow Router: Human-supervised decision review for administrative
schedule revisions, maintenance overrides, and resource reallocations.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.models import (
    ApprovalDecisionRequest,
    ApprovalRequest,
    ApprovalStatus,
    EventLogEntry,
    ProposalType,
    StateSnapshot,
)
from app.state import state_store
from app.websocket import manager

router = APIRouter(prefix="/api/approvals", tags=["Approval Workflow"])

# Permitted roles hierarchy
AUTHORIZED_ROLES = {"AIR_COMMODORE", "WING_COMMANDER", "SENIOR_OPS_OFFICER"}


class CreateProposalRequest(BaseModel):
    title: str
    proposal_type: ProposalType
    requesting_agent: str = "AI_DECISION_SUPPORT_V2"
    reviewer_role_required: str = "WING_COMMANDER"
    impact_summary: Dict[str, Any] = Field(default_factory=dict)


@router.get("", response_model=List[ApprovalRequest], summary="List approval requests and decision history")
async def list_approvals(
    status_filter: Optional[str] = Query(None, alias="status"),
) -> List[ApprovalRequest]:
    snapshot = await state_store.get_snapshot_async()
    approvals = snapshot.approval_requests

    if status_filter and status_filter != "ALL":
        approvals = [a for a in approvals if a.status.value == status_filter or str(a.status) == status_filter]

    # Return newest first
    return list(reversed(approvals))


@router.post("", response_model=ApprovalRequest, status_code=status.HTTP_201_CREATED, summary="Submit a new resource/schedule revision proposal")
async def create_proposal(req: CreateProposalRequest) -> ApprovalRequest:
    approval_id = f"APP-2026-{uuid.uuid4().hex[:3].upper()}"
    proposal_id = f"PROP-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    new_approval = ApprovalRequest(
        approval_id=approval_id,
        proposal_id=proposal_id,
        title=req.title,
        proposal_type=req.proposal_type,
        requesting_agent=req.requesting_agent,
        reviewer_role_required=req.reviewer_role_required,
        reviewer_id=None,
        reviewer_role=None,
        status=ApprovalStatus.PENDING,
        created_at=now_iso,
        decided_at=None,
        reviewer_rationale=None,
        impact_summary=req.impact_summary,
        proposal_version=1,
    )

    def _mutator(snap: StateSnapshot):
        snap.approval_requests.append(new_approval)

        # Log event
        evt = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=now_iso,
            event_type="APPROVAL_DECISION",
            entity_type="APPROVAL",
            entity_id=approval_id,
            severity="INFO",
            source="HUMAN_SUPERVISION",
            description=f"New approval proposal submitted [{approval_id}]: '{req.title}' pending review by {req.reviewer_role_required}.",
            affected_assets=[],
            details={"approval_id": approval_id, "proposal_type": req.proposal_type.value},
        )
        snap.event_log.append(evt)
        return new_approval, snap.model_copy(deep=True)

    result_app, updated_snap = await state_store.mutate(_mutator)
    await manager.broadcast("STATE_SNAPSHOT", updated_snap.model_dump())
    return result_app


@router.post("/{approval_id}/decide", response_model=ApprovalRequest, summary="Approve or Reject a proposal with mandatory rationale")
async def decide_approval(approval_id: str, req: ApprovalDecisionRequest) -> ApprovalRequest:
    # 1. Enforce backend permission checks
    normalized_role = req.reviewer_role.upper().replace(" ", "_")
    if normalized_role not in AUTHORIZED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unauthorized: Role '{req.reviewer_role}' does not possess operational command authority to decide proposals. Minimum role required: Wing Commander or Senior Ops Officer.",
        )

    # 2. Mandatory rationale on rejection
    decision_clean = req.decision.upper()
    if decision_clean == "REJECTED" and (not req.rationale or len(req.rationale.strip()) < 8):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reviewer rationale is mandatory when rejecting an operational or administrative proposal (minimum 8 characters).",
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    def _mutator(snap: StateSnapshot):
        target = next((a for a in snap.approval_requests if a.approval_id == approval_id), None)
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Proposal '{approval_id}' not found.")

        if target.status != ApprovalStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Proposal '{approval_id}' has already been finalized as {target.status.value} on {target.decided_at}.",
            )

        if decision_clean == "APPROVED":
            target.status = ApprovalStatus.APPROVED
        elif decision_clean == "REJECTED":
            target.status = ApprovalStatus.REJECTED
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid decision '{req.decision}'. Must be APPROVED or REJECTED.")

        target.reviewer_id = req.reviewer_id
        target.reviewer_role = req.reviewer_role
        target.reviewer_rationale = req.rationale
        target.decided_at = now_iso

        # Log decision into event history
        evt = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=now_iso,
            event_type="APPROVAL_DECISION",
            entity_type="APPROVAL",
            entity_id=approval_id,
            severity="WARNING" if target.status == ApprovalStatus.REJECTED else "INFO",
            source="HUMAN_COMMANDER",
            description=(
                f"Proposal [{approval_id}] '{target.title}' was {target.status.value} by "
                f"{req.reviewer_id} ({req.reviewer_role}). "
                + (f"Rationale: {req.rationale}" if req.rationale else "Approved with standard procedural concurrence.")
            ),
            affected_assets=[],
            details={
                "approval_id": approval_id,
                "status": target.status.value,
                "reviewer": req.reviewer_id,
                "rationale": req.rationale,
            },
        )
        snap.event_log.append(evt)
        return target, snap.model_copy(deep=True)

    result_app, updated_snap = await state_store.mutate(_mutator)
    await manager.broadcast("STATE_SNAPSHOT", updated_snap.model_dump())
    return result_app
