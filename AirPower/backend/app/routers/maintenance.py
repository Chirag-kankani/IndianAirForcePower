"""
Maintenance & Logistics Router: Manage aircraft work orders, depot schedules,
and ground support equipment / spare parts inventory.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.models import (
    AircraftStatus,
    EventLogEntry,
    InventoryCategory,
    InventoryStatus,
    MaintenanceCategory,
    MaintenancePriority,
    MaintenanceRecord,
    MaintenanceStatus,
    StateSnapshot,
    SupportInventory,
)
from app.state import state_store
from app.websocket import manager

router = APIRouter(prefix="/api", tags=["Maintenance & Logistics"])

# Valid state machine transitions for maintenance work orders
VALID_TRANSITIONS: Dict[str, List[str]] = {
    "OPEN": ["IN_PROGRESS", "ON_HOLD", "CANCELLED", "OVERDUE"],
    "IN_PROGRESS": ["COMPLETED", "ON_HOLD", "CANCELLED", "OVERDUE"],
    "ON_HOLD": ["IN_PROGRESS", "CANCELLED"],
    "OVERDUE": ["IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"],
    "COMPLETED": [],  # Terminal
    "CANCELLED": [],  # Terminal
}


class CreateWorkOrderRequest(BaseModel):
    resource_id: str
    resource_type: str = "AIRCRAFT"
    category: MaintenanceCategory
    priority: MaintenancePriority = MaintenancePriority.MEDIUM
    airbase_id: str
    planned_start: str
    planned_completion: str
    estimated_duration_hours: float = Field(..., gt=0)
    description: str
    technician_lead: str
    required_parts: List[Dict[str, Any]] = Field(default_factory=list)
    technician_notes: Optional[str] = None


class UpdateWorkOrderStatusRequest(BaseModel):
    status: MaintenanceStatus
    actual_duration_hours: Optional[float] = None
    technician_notes: Optional[str] = None


class AdjustInventoryRequest(BaseModel):
    adjustment_quantity: int
    reason: str


@router.get("/maintenance/summary", summary="Get aggregate metrics for maintenance workload and logistics")
async def get_maintenance_summary() -> Dict[str, Any]:
    snapshot = await state_store.get_snapshot_async()
    now = datetime.now(timezone.utc)

    total_wo = len(snapshot.maintenance_records)
    open_cnt = 0
    in_prog_cnt = 0
    completed_cnt = 0
    overdue_cnt = 0
    on_hold_cnt = 0
    cancelled_cnt = 0

    for wo in snapshot.maintenance_records:
        st = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
        if st == "COMPLETED":
            completed_cnt += 1
        elif st == "IN_PROGRESS":
            in_prog_cnt += 1
        elif st == "OPEN":
            open_cnt += 1
        elif st == "OVERDUE":
            overdue_cnt += 1
        elif st == "ON_HOLD":
            on_hold_cnt += 1
        elif st == "CANCELLED":
            cancelled_cnt += 1

    low_stock_items = [i for i in snapshot.support_inventory if i.quantity_on_hand <= i.reorder_threshold]
    critical_stock_items = [i for i in snapshot.support_inventory if i.quantity_on_hand <= 1]

    # Calculate blocked work orders due to lack of support inventory
    blocked_wo_count = 0
    inventory_by_id = {i.item_id: i for i in snapshot.support_inventory}
    for wo in snapshot.maintenance_records:
        st = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
        if st in ("OPEN", "IN_PROGRESS", "ON_HOLD", "OVERDUE"):
            for part in wo.required_parts:
                part_id = part.get("item_id")
                qty_needed = part.get("quantity_needed", 1)
                inv_item = inventory_by_id.get(part_id)
                if inv_item and inv_item.quantity_on_hand < qty_needed:
                    blocked_wo_count += 1
                    break

    return {
        "total_work_orders": total_wo,
        "scheduled_open": open_cnt,
        "in_progress": in_prog_cnt,
        "completed": completed_cnt,
        "overdue": overdue_cnt,
        "on_hold": on_hold_cnt,
        "cancelled": cancelled_cnt,
        "total_support_inventory_items": len(snapshot.support_inventory),
        "low_stock_alerts_count": len(low_stock_items),
        "critical_reorder_count": len(critical_stock_items),
        "blocked_work_orders_count": blocked_wo_count,
        "last_updated": snapshot.last_updated,
    }


@router.get("/maintenance", response_model=List[MaintenanceRecord], summary="List maintenance work orders")
async def list_maintenance_records(
    status_filter: Optional[str] = Query(None, alias="status"),
    airbase_filter: Optional[str] = Query(None, alias="airbase_id"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    resource_filter: Optional[str] = Query(None, alias="resource_id"),
) -> List[MaintenanceRecord]:
    snapshot = await state_store.get_snapshot_async()
    records = snapshot.maintenance_records

    if status_filter and status_filter != "ALL":
        records = [r for r in records if (r.status.value if hasattr(r.status, "value") else str(r.status)) == status_filter]
    if airbase_filter and airbase_filter != "ALL":
        records = [r for r in records if r.airbase_id == airbase_filter]
    if priority_filter and priority_filter != "ALL":
        records = [r for r in records if (r.priority.value if hasattr(r.priority, "value") else str(r.priority)) == priority_filter]
    if resource_filter and resource_filter != "ALL":
        records = [r for r in records if r.resource_id == resource_filter]

    return records


@router.get("/maintenance/history/{aircraft_id}", summary="Get asset-level maintenance history")
async def get_aircraft_maintenance_history(aircraft_id: str) -> Dict[str, Any]:
    snapshot = await state_store.get_snapshot_async()
    ac = next((a for a in snapshot.aircraft_fleet if a.aircraft_id == aircraft_id), None)
    if not ac:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Aircraft '{aircraft_id}' not found.")

    wo_list = [w for w in snapshot.maintenance_records if w.resource_id == aircraft_id]
    related_events = [e for e in snapshot.event_log if e.entity_id == aircraft_id or aircraft_id in (e.affected_assets or [])]

    return {
        "aircraft": ac.model_dump(),
        "work_orders": [w.model_dump() for w in wo_list],
        "events": [e.model_dump() for e in related_events],
        "total_maintenance_cycles": len(wo_list),
        "synthetic_notice": "Asset maintenance records generated for Smart India Hackathon operational simulation.",
    }


@router.get("/maintenance/{record_id}", response_model=MaintenanceRecord, summary="Get details for a single work order")
async def get_maintenance_record(record_id: str) -> MaintenanceRecord:
    snapshot = await state_store.get_snapshot_async()
    wo = next((w for w in snapshot.maintenance_records if w.record_id == record_id), None)
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Work order '{record_id}' not found.")
    return wo


@router.post("/maintenance", response_model=MaintenanceRecord, status_code=status.HTTP_201_CREATED, summary="Create a new maintenance work order")
async def create_maintenance_record(req: CreateWorkOrderRequest) -> MaintenanceRecord:
    snapshot = await state_store.get_snapshot_async()

    # Validate that resource exists
    ac = next((a for a in snapshot.aircraft_fleet if a.aircraft_id == req.resource_id), None)
    if not ac:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Target aircraft '{req.resource_id}' does not exist.")

    # Validate that airbase exists
    base = next((b for b in snapshot.airbases if b.id == req.airbase_id), None)
    if not base:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Target airbase '{req.airbase_id}' does not exist.")

    record_id = f"WO-2026-{uuid.uuid4().hex[:4].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    new_wo = MaintenanceRecord(
        record_id=record_id,
        resource_id=req.resource_id,
        resource_type=req.resource_type,
        category=req.category,
        status=MaintenanceStatus.OPEN,
        priority=req.priority,
        airbase_id=req.airbase_id,
        planned_start=req.planned_start,
        planned_completion=req.planned_completion,
        actual_completion=None,
        estimated_duration_hours=req.estimated_duration_hours,
        actual_duration_hours=None,
        description=req.description,
        technician_lead=req.technician_lead,
        required_parts=req.required_parts,
        technician_notes=req.technician_notes,
        created_at=now_iso,
        last_update=now_iso,
    )

    def _mutator(snap: StateSnapshot):
        snap.maintenance_records.append(new_wo)

        # Log event
        evt = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=now_iso,
            event_type="MAINTENANCE_UPDATE",
            entity_type="AIRCRAFT" if req.resource_type == "AIRCRAFT" else "EQUIPMENT",
            entity_id=req.resource_id,
            severity="INFO" if req.priority in (MaintenancePriority.LOW, MaintenancePriority.MEDIUM) else "WARNING",
            source="DEPOT_LOGISTICS_ERP",
            description=f"Created work order {record_id} for {req.resource_id}: {req.description}",
            affected_assets=[req.resource_id, req.airbase_id],
            details={"work_order_id": record_id, "category": req.category.value if hasattr(req.category, "value") else str(req.category)},
        )
        snap.event_log.append(evt)
        return new_wo, snap.model_copy(deep=True)

    result_wo, updated_snap = await state_store.mutate(_mutator)
    await manager.broadcast("STATE_SNAPSHOT", updated_snap.model_dump())
    return result_wo


@router.patch("/maintenance/{record_id}/status", response_model=MaintenanceRecord, summary="Update work order status with transition validation")
async def update_work_order_status(record_id: str, req: UpdateWorkOrderStatusRequest) -> MaintenanceRecord:
    now_iso = datetime.now(timezone.utc).isoformat()

    def _mutator(snap: StateSnapshot):
        wo = next((w for w in snap.maintenance_records if w.record_id == record_id), None)
        if not wo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Work order '{record_id}' not found.")

        old_status = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
        new_status = req.status.value if hasattr(req.status, "value") else str(req.status)

        # Check if already in terminal state
        if old_status in ("COMPLETED", "CANCELLED") and old_status != new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Work order '{record_id}' is in terminal state '{old_status}' and cannot be transitioned to '{new_status}'.",
            )

        # Validate transition
        allowed = VALID_TRANSITIONS.get(old_status, [])
        if new_status != old_status and new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid maintenance transition: '{old_status}' -> '{new_status}'. Allowed transitions: {allowed}",
            )

        wo.status = req.status
        wo.last_update = now_iso
        if req.technician_notes:
            wo.technician_notes = req.technician_notes

        # Transition to IN_PROGRESS: Aircraft becomes unserviceable / in maintenance
        if req.status == MaintenanceStatus.IN_PROGRESS:
            ac = next((a for a in snap.aircraft_fleet if a.aircraft_id == wo.resource_id), None)
            if ac and ac.status == AircraftStatus.READY:
                ac.status = AircraftStatus.MAINTENANCE

        # Transition to COMPLETED
        if req.status == MaintenanceStatus.COMPLETED:
            wo.actual_completion = now_iso
            if req.actual_duration_hours:
                wo.actual_duration_hours = req.actual_duration_hours
            elif not wo.actual_duration_hours:
                wo.actual_duration_hours = wo.estimated_duration_hours

            # If aircraft was in MAINTENANCE, check if any open/in-progress/overdue work orders remain
            ac = next((a for a in snap.aircraft_fleet if a.aircraft_id == wo.resource_id), None)
            if ac and ac.status in (AircraftStatus.MAINTENANCE, AircraftStatus.ABORTED):
                remaining_active = [
                    w for w in snap.maintenance_records
                    if w.resource_id == ac.aircraft_id
                    and w.record_id != record_id
                    and (w.status.value if hasattr(w.status, "value") else str(w.status)) in ("OPEN", "IN_PROGRESS", "OVERDUE", "ON_HOLD")
                ]
                if not remaining_active:
                    ac.status = AircraftStatus.READY

        # Log event
        evt = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=now_iso,
            event_type="MAINTENANCE_UPDATE",
            entity_type="AIRCRAFT",
            entity_id=wo.resource_id,
            severity="INFO",
            source="DEPOT_LOGISTICS_ERP",
            description=f"Work order {record_id} ({wo.resource_id}) transitioned from {old_status} to {new_status}.",
            affected_assets=[wo.resource_id, wo.airbase_id],
            details={"work_order_id": record_id, "old_status": old_status, "new_status": new_status},
        )
        snap.event_log.append(evt)
        return wo, snap.model_copy(deep=True)

    result_wo, updated_snap = await state_store.mutate(_mutator)
    await manager.broadcast("STATE_SNAPSHOT", updated_snap.model_dump())
    return result_wo


# -------------------------------------------------------------
# SUPPORT LOGISTICS INVENTORY ENDPOINTS
# -------------------------------------------------------------

@router.get("/inventory", response_model=List[SupportInventory], summary="List support equipment and spare parts inventory")
async def list_support_inventory(
    category_filter: Optional[str] = Query(None, alias="category"),
    airbase_filter: Optional[str] = Query(None, alias="airbase_id"),
    low_stock_only: bool = Query(False, alias="low_stock_only"),
) -> List[SupportInventory]:
    snapshot = await state_store.get_snapshot_async()
    items = snapshot.support_inventory

    if category_filter and category_filter != "ALL":
        items = [i for i in items if (i.category.value if hasattr(i.category, "value") else str(i.category)) == category_filter]
    if airbase_filter and airbase_filter != "ALL":
        items = [i for i in items if i.airbase_id == airbase_filter]
    if low_stock_only:
        items = [i for i in items if i.quantity_on_hand <= i.reorder_threshold]

    return items


@router.patch("/inventory/{item_id}/adjust", response_model=SupportInventory, summary="Adjust inventory on-hand quantity with transaction validation")
async def adjust_inventory(item_id: str, req: AdjustInventoryRequest) -> SupportInventory:
    now_iso = datetime.now(timezone.utc).isoformat()

    def _mutator(snap: StateSnapshot):
        item = next((i for i in snap.support_inventory if i.item_id == item_id), None)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inventory item '{item_id}' not found.")

        old_qty = item.quantity_on_hand
        new_qty = old_qty + req.adjustment_quantity

        if new_qty < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Adjustment of {req.adjustment_quantity} would result in negative stock ({new_qty}). Available: {old_qty}",
            )

        if item.reserved_quantity > new_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reduce stock to {new_qty} because {item.reserved_quantity} units are already reserved for active work orders.",
            )

        item.quantity_on_hand = new_qty
        item.last_audit = now_iso

        # Update status
        if item.quantity_on_hand <= 1 and item.reorder_threshold > 1:
            item.status = InventoryStatus.CRITICAL_REORDER
        elif item.quantity_on_hand <= item.reorder_threshold:
            item.status = InventoryStatus.LOW_STOCK
        else:
            item.status = InventoryStatus.ADEQUATE

        # Log event
        evt = EventLogEntry(
            event_id=f"EVT-{uuid.uuid4().hex[:6].upper()}",
            timestamp=now_iso,
            event_type="SYSTEM_VALIDATION",
            entity_type="EQUIPMENT",
            entity_id=item.item_id,
            severity="WARNING" if item.status != InventoryStatus.ADEQUATE else "INFO",
            source="SUPPLY_CHAIN_INVENTORY_FEED",
            description=f"Stock adjusted for {item.item_name} at {item.airbase_id}: {old_qty} -> {new_qty} {item.unit}. Reason: {req.reason}",
            affected_assets=[item.airbase_id],
            details={"item_id": item_id, "old_qty": old_qty, "new_qty": new_qty, "reason": req.reason},
        )
        snap.event_log.append(evt)
        return item, snap.model_copy(deep=True)

    result_item, updated_snap = await state_store.mutate(_mutator)
    await manager.broadcast("STATE_SNAPSHOT", updated_snap.model_dump())
    return result_item
