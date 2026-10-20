"""
AirPower Decision-Support Backend Main Application.
"""
import os
import sys
import asyncio

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routers import events as events_router
from app.routers import missions as missions_router
from app.routers import state as state_router
from app.routers import data_fusion as data_fusion_router
from app.routers import maintenance as maintenance_router
from app.routers import approvals as approvals_router
from app.routers import analytics as analytics_router
from app.routers import replay as replay_router
from app.routers import weather as weather_router
from app.routers import assistant as assistant_router
from app.websocket import router as ws_router
from app.state import state_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure mock data and initial state are loaded
    state_store.load_from_disk()
    snapshot = state_store.get_snapshot()
    print(
        f"[AirPower] System initialized with {len(snapshot.aircraft_fleet)} jets, "
        f"{len(snapshot.pilots)} pilots, {len(snapshot.airbases)} airbases, "
        f"{len(snapshot.threat_environment)} threat zones, {len(snapshot.mission_targets)} targets, "
        f"{len(snapshot.maintenance_records)} work orders, {len(snapshot.support_inventory)} spares, "
        f"{len(snapshot.approval_requests)} approvals."
    )
    yield
    # Shutdown logic if needed
    print("[AirPower] Shutting down.")


app = FastAPI(
    title="AirPower Decision-Support API",
    description="Dynamic Air Operations & Resource Optimisation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend Vite/React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(state_router.router)
app.include_router(missions_router.router)
app.include_router(events_router.router)
app.include_router(data_fusion_router.router)
app.include_router(maintenance_router.router)
app.include_router(approvals_router.router)
app.include_router(analytics_router.router)
app.include_router(replay_router.router)
app.include_router(weather_router.router)
app.include_router(assistant_router.router)
app.include_router(ws_router)


@app.head("/", include_in_schema=False)
async def root_head():
    return Response(status_code=200)


@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
async def health_check():
    return {"status": "HEALTHY", "state_loaded": state_store.get_snapshot() is not None}


# Locate production frontend build if available (Container / Local monorepo)
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_repo_dir = os.path.dirname(_backend_dir)
_candidate_paths = [
    os.path.join(_backend_dir, "static"),
    os.path.join(_repo_dir, "frontend", "dist"),
]

frontend_dist = next((p for p in _candidate_paths if os.path.exists(p) and os.path.isdir(p)), None)

if frontend_dist:
    # Mount static assets (/assets/...)
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Serve index.html and any static files for SPA frontend
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_frontend(request: Request, full_path: str):
        if full_path.startswith(("api", "ws", "docs", "openapi.json")):
            return Response(status_code=404)
        if request.method == "HEAD":
            return Response(status_code=200)
        if full_path in ("", "/") and "text/html" not in request.headers.get("accept", ""):
            return {
                "system": "AirPower Decision-Support Platform",
                "status": "OPERATIONAL",
                "synthetic_data_badge": "SYNTHETIC DATA – DEMO",
                "docs": "/docs",
            }
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.api_route("/", methods=["GET", "HEAD"], tags=["Health"])
    async def root():
        return {
            "system": "AirPower Decision-Support Platform",
            "status": "OPERATIONAL",
            "synthetic_data_badge": "SYNTHETIC DATA – DEMO",
            "docs": "/docs",
        }
