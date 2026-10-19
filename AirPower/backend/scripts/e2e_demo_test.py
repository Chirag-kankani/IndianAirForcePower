"""
End-to-End Automated Demo Verification Script.
Simulates the entire judge/commander demonstration flow.
"""
import asyncio
import json
import sys
import httpx
import websockets

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws"


async def run_e2e_demo():
    print("================================================================")
    print("   AIRPOWER - END-TO-END DEMO TEST FLOW")
    print("================================================================\n")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # Step 1: Health & Baseline State
        print("[Step 1] Checking API & Tactical State...")
        res = await client.get("/health")
        assert res.status_code == 200
        state = (await client.get("/api/state")).json()
        print(f"  [OK] System Online. Fleet: {len(state['aircraft_fleet'])} jets, {len(state['pilots'])} pilots, {len(state['airbases'])} airbases, {len(state['threat_environment'])} threat zones.\n")

        # Step 2: Mission Planning (Optimization)
        print("[Step 2] Commander Requests Mission Plan for Target: TGT_ALPHA_BUNKER (Priority 5)...")
        plan_res = await client.post("/api/missions/plan", json={
            "target_id": "TGT_ALPHA_BUNKER",
            "priority_level": 5,
        })
        assert plan_res.status_code == 200
        plan_data = plan_res.json()
        assert plan_data["status"] == "FEASIBLE"
        packages = plan_data["packages"]
        print(f"  [OK] CP-SAT Planner returned {len(packages)} distinct constrained-optimal packages:")

        for pkg in packages:
            print(f"    - Rank #{pkg['rank']} [Score: {pkg['total_score']}]: {pkg['aircraft']['callsign']} ({pkg['aircraft']['model']})")
            print(f"      Base: {pkg['airbase']['name']} | Pilot: {pkg['pilot']['name']} ({pkg['pilot']['rank']})")
            print(f"      Route: {pkg['route']['distance_km']} km, ETA: {pkg['route']['eta_mins']} mins, Fuel: {pkg['route']['fuel_needed_liters']} L")
            print(f"      Checklist: {sum(1 for c in pkg['constraint_report'] if c['passed'])}/8 constraints passed.")

        # Step 3: Package Deployment
        top_pkg = packages[0]
        pkg_id = top_pkg["package_id"]
        print(f"\n[Step 3] Commander Approves & Deploys Rank #1 Package ({pkg_id})...")
        deploy_res = await client.post(f"/api/missions/{pkg_id}/deploy")
        assert deploy_res.status_code == 200
        msn = deploy_res.json()
        msn_id = msn["mission_id"]
        print(f"  [OK] Mission {msn_id} DEPLOYED! Status: {msn['status']}, Jet: {msn['aircraft']['callsign']} is AIRBORNE.\n")

        # Step 4: Trigger Emergency Event 1 - Runway Lockout
        print("[Step 4] Triggering Emergency Scenario 1: RUNWAY_BLOCKED at departure base...")
        evt1_res = await client.post("/api/events/trigger", json={
            "event_type": "RUNWAY_BLOCKED",
            "payload": {"airbase_id": top_pkg["airbase"]["id"]},
        })
        assert evt1_res.status_code == 200
        evt1_data = evt1_res.json()
        retask1 = evt1_data["retasking_log"][0]
        print(f"  [OK] AI Retask Action: {retask1['action_type']}")
        print(f"    Details: {retask1['details']}\n")

        # Step 5: Trigger Emergency Event 2 - Pop-Up SAM Radar Threat
        print("[Step 5] Triggering Emergency Scenario 2: NEW_THREAT_ZONE (Pop-Up SAM Battery)...")
        evt2_res = await client.post("/api/events/trigger", json={
            "event_type": "NEW_THREAT_ZONE",
            "payload": {
                "name": "Pop-Up HQ-9 SAM Battery Sector",
                "type": "SAM_RADAR_BATTERY",
                "lat": 31.10,
                "lng": 75.40,
                "radius_km": 60.0,
                "severity": 5,
            },
        })
        assert evt2_res.status_code == 200
        evt2_data = evt2_res.json()
        retask2 = evt2_data["retasking_log"][0]
        print(f"  [OK] AI Retask Action: {retask2['action_type']}")
        print(f"    Details: {retask2['details']}\n")

        # Step 6: Trigger Emergency Event 3 - In-Flight Engine Fault
        print("[Step 6] Triggering Emergency Scenario 3: AIRCRAFT_FAILURE (Mid-Flight Engine Fault)...")
        evt3_res = await client.post("/api/events/trigger", json={
            "event_type": "AIRCRAFT_FAILURE",
            "payload": {"aircraft_id": top_pkg["aircraft"]["aircraft_id"]},
        })
        assert evt3_res.status_code == 200
        evt3_data = evt3_res.json()
        retask3 = evt3_data["retasking_log"][0]
        print(f"  [OK] AI Retask Action: {retask3['action_type']}")
        print(f"    Details: {retask3['details']}\n")

        # Step 7: Reset Scenario
        print("[Step 7] Resetting Tactical Scenario to Baseline...")
        reset_res = await client.post("/api/events/reset")
        assert reset_res.status_code == 200
        print(f"  [OK] Scenario cleanly reset. Ready for next demo run.\n")

    print("================================================================")
    print("   ALL DEMO FLOWS VALIDATED SUCCESSFULLY!")
    print("================================================================")


if __name__ == "__main__":
    asyncio.run(run_e2e_demo())
