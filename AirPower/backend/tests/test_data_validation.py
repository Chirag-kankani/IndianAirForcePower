"""
Unit and Consistency Tests for AirPower Domain Model & Synthetic Dataset.
"""
import json
from pathlib import Path
from geopy.distance import geodesic
import pytest

from app.models import (
    AircraftStatus,
    GuidanceType,
    PilotQualification,
    RunwayStatus,
    StateSnapshot,
    TargetType,
    WeaponCategory,
)
from app.data_generator import generate_synthetic_data, validate_consistency


@pytest.fixture
def mock_data():
    data_path = Path(__file__).parent.parent / "data" / "mock_data.json"
    if not data_path.exists():
        return generate_synthetic_data(seed=42)
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_schema_parsing(mock_data):
    """Verify that synthetic data strictly validates against Pydantic StateSnapshot."""
    snapshot = StateSnapshot.model_validate(mock_data)
    assert len(snapshot.weapons_inventory) >= 6
    assert len(snapshot.aircraft_fleet) >= 12
    assert len(snapshot.airbases) >= 5
    assert len(snapshot.pilots) >= len(snapshot.aircraft_fleet) * 1.2
    assert len(snapshot.threat_environment) >= 3
    assert len(snapshot.mission_targets) >= 5


def test_required_weapons_present(mock_data):
    """Verify required weapon types and specifications exist."""
    snapshot = StateSnapshot.model_validate(mock_data)
    weapon_names = {w.name for w in snapshot.weapons_inventory}
    weapon_ids = {w.weapon_id for w in snapshot.weapons_inventory}

    assert any("Astra" in name for name in weapon_names)
    assert any("SPICE" in name for name in weapon_names)
    assert any("Rudram" in name for name in weapon_names)
    assert any("BrahMos" in name for name in weapon_names)
    assert any("Hammer" in name for name in weapon_names)

    # Check categories
    categories = {w.category for w in snapshot.weapons_inventory}
    assert WeaponCategory.AIR_TO_AIR_MISSILE in categories
    assert WeaponCategory.PRECISION_GUIDED_BOMB in categories
    assert WeaponCategory.ANTI_RADIATION_MISSILE in categories
    assert WeaponCategory.ANTI_SHIP in categories


def test_aircraft_structural_constraints(mock_data):
    """Verify no hardpoint overloading and MTOW constraints are obeyed."""
    snapshot = StateSnapshot.model_validate(mock_data)
    weapon_map = {w.weapon_id: w for w in snapshot.weapons_inventory}

    for ac in snapshot.aircraft_fleet:
        # Check hardpoints
        total_weapons = sum(eq.quantity for eq in ac.equipped_weapons)
        assert total_weapons <= ac.hardpoints_count, f"{ac.aircraft_id} exceeded hardpoint count"

        # Check MTOW
        fuel_weight = ac.current_fuel_liters * 0.8
        weapons_weight = sum(weapon_map[eq.weapon_id].weight_kg * eq.quantity for eq in ac.equipped_weapons)
        total_takeoff_weight = ac.empty_weight_kg + fuel_weight + weapons_weight
        assert total_takeoff_weight <= ac.max_takeoff_weight_kg, f"{ac.aircraft_id} exceeded MTOW"


def test_relational_integrity(mock_data):
    """Verify all foreign keys (base_id, weapon_id) point to valid existing entities."""
    snapshot = StateSnapshot.model_validate(mock_data)
    base_ids = {b.id for b in snapshot.airbases}
    weapon_ids = {w.weapon_id for w in snapshot.weapons_inventory}

    for ac in snapshot.aircraft_fleet:
        assert ac.home_base_id in base_ids
        for eq in ac.equipped_weapons:
            assert eq.weapon_id in weapon_ids

    for pilot in snapshot.pilots:
        assert pilot.home_base_id in base_ids


def test_pilot_rest_and_fatigue_distribution(mock_data):
    """Ensure we have both well-rested pilots and fatigue edge cases."""
    snapshot = StateSnapshot.model_validate(mock_data)
    fatigued = [p for p in snapshot.pilots if p.rest_hours_completed < 8.0]
    rested = [p for p in snapshot.pilots if p.rest_hours_completed >= 8.0]

    assert len(fatigued) >= 2, "Must include at least 2 fatigued pilots to test constraint filtering"
    assert len(rested) >= 12, "Must have sufficient rested pilots for operations"


def test_target_viability_minimum_two(mock_data):
    """Ensure every target has AT LEAST 2 viable READY aircraft + qualified rested pilot options."""
    snapshot = StateSnapshot.model_validate(mock_data)
    weapon_map = {w.weapon_id: w for w in snapshot.weapons_inventory}

    for target in snapshot.mission_targets:
        viable_count = 0
        for ac in snapshot.aircraft_fleet:
            if ac.status != AircraftStatus.READY:
                continue

            base = next(b for b in snapshot.airbases if b.id == ac.home_base_id)
            if base.runway_status != RunwayStatus.OPERATIONAL:
                continue

            # Weapon check
            has_matching_weapon = any(
                weapon_map[eq.weapon_id].category == target.required_weapon_category
                for eq in ac.equipped_weapons
            )
            if not has_matching_weapon:
                continue

            # Range check with 1.4 safety multiplier
            dist_km = geodesic((base.lat, base.lng), (target.location.lat, target.location.lng)).km
            if ac.max_range_km < dist_km * 2 * 1.4:
                continue

            # Pilot check
            compatible_pilots = [
                plt for plt in snapshot.pilots
                if plt.home_base_id == ac.home_base_id
                and plt.rest_hours_completed >= 8.0
                and all(q in plt.qualifications for q in target.required_pilot_qualifications)
            ]

            if compatible_pilots:
                viable_count += 1

        assert viable_count >= 2, f"Target {target.target_id} only has {viable_count} viable options (min 2 required)"
