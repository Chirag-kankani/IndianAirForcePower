"""
Synthetic Data Generation Engine for AirPower Platform.
Reproducible seeded generation (seed=42) producing valid, constrained mock scenario.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Any, Dict, List

from app.models import (
    Aircraft,
    AircraftStatus,
    Airbase,
    EquippedWeapon,
    GuidanceType,
    Location,
    MissionTarget,
    Pilot,
    PilotQualification,
    RunwayStatus,
    StateSnapshot,
    TargetType,
    ThreatType,
    ThreatZone,
    Weapon,
    WeaponCategory,
)


def generate_synthetic_data(seed: int = 42) -> Dict[str, Any]:
    random.seed(seed)

    # -------------------------------------------------------------
    # 1. WEAPONS INVENTORY
    # -------------------------------------------------------------
    weapons: List[Weapon] = [
        Weapon(
            weapon_id="WEP_ASTRA_MK1",
            name="Astra Mk-1 BVR-AAM",
            category=WeaponCategory.AIR_TO_AIR_MISSILE,
            guidance_type=GuidanceType.ACTIVE_RADAR,
            weight_kg=154.0,
            effective_range_km=110.0,
            stock_count=36,
            effective_against=[],
        ),
        Weapon(
            weapon_id="WEP_SPICE_2000",
            name="SPICE-2000 Penetrator PGB",
            category=WeaponCategory.PRECISION_GUIDED_BOMB,
            guidance_type=GuidanceType.GPS_ELECTRO_OPTICAL,
            weight_kg=900.0,
            effective_range_km=60.0,
            stock_count=24,
            effective_against=[TargetType.HARDENED_BUNKER, TargetType.AIRFIELD],
        ),
        Weapon(
            weapon_id="WEP_RUDRAM_1",
            name="Rudram-1 NGARM",
            category=WeaponCategory.ANTI_RADIATION_MISSILE,
            guidance_type=GuidanceType.PASSIVE_HOMING,
            weight_kg=140.0,
            effective_range_km=150.0,
            stock_count=22,
            effective_against=[TargetType.RADAR_STATION],
        ),
        Weapon(
            weapon_id="WEP_BRAHMOS_A",
            name="BrahMos-A ALCM",
            category=WeaponCategory.ANTI_SHIP,
            guidance_type=GuidanceType.ACTIVE_RADAR,
            weight_kg=2500.0,
            effective_range_km=300.0,
            stock_count=12,
            effective_against=[TargetType.NAVAL_VESSEL],
        ),
        Weapon(
            weapon_id="WEP_HAMMER_AASM",
            name="Hammer AASM SBU-38",
            category=WeaponCategory.PRECISION_GUIDED_BOMB,
            guidance_type=GuidanceType.GPS_ELECTRO_OPTICAL,
            weight_kg=330.0,
            effective_range_km=70.0,
            stock_count=30,
            effective_against=[TargetType.CONVOY, TargetType.HARDENED_BUNKER, TargetType.AIRFIELD],
        ),
        Weapon(
            weapon_id="WEP_PYTHON_5",
            name="Python-5 WVRAAM",
            category=WeaponCategory.AIR_TO_AIR_MISSILE,
            guidance_type=GuidanceType.PASSIVE_HOMING,
            weight_kg=105.0,
            effective_range_km=20.0,
            stock_count=40,
            effective_against=[],
        ),
    ]

    # -------------------------------------------------------------
    # 2. AIRBASES (Fictionalized Northern & Western Theatre)
    # -------------------------------------------------------------
    airbases: List[Airbase] = [
        Airbase(
            id="BASE_TRISHUL",
            name="Trishul Air Force Station",
            lat=30.36,
            lng=76.81,
            runway_status=RunwayStatus.OPERATIONAL,
            available_fuel_liters=480000.0,
            stored_weapons=[
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=8),
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=12),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=14),
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=6),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=10),
            ],
        ),
        Airbase(
            id="BASE_GARUDA",
            name="Garuda Tactical Base",
            lat=26.25,
            lng=73.04,
            runway_status=RunwayStatus.OPERATIONAL,
            available_fuel_liters=550000.0,
            stored_weapons=[
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=12),
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=6),
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=10),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=14),
                EquippedWeapon(weapon_id="WEP_BRAHMOS_A", quantity=4),
            ],
        ),
        Airbase(
            id="BASE_VAYU",
            name="Vayu Forward Air Base",
            lat=30.75,
            lng=75.63,
            runway_status=RunwayStatus.OPERATIONAL,
            available_fuel_liters=390000.0,
            stored_weapons=[
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=8),
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=8),
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=8),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=8),
            ],
        ),
        Airbase(
            id="BASE_MARUT",
            name="Marut Combat Station",
            lat=23.28,
            lng=69.67,
            runway_status=RunwayStatus.OPERATIONAL,
            available_fuel_liters=420000.0,
            stored_weapons=[
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=6),
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=6),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=8),
            ],
        ),
        Airbase(
            id="BASE_VARUN",
            name="Varun Naval Air Enclave",
            lat=22.46,
            lng=70.01,
            runway_status=RunwayStatus.OPERATIONAL,
            available_fuel_liters=510000.0,
            stored_weapons=[
                EquippedWeapon(weapon_id="WEP_BRAHMOS_A", quantity=8),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=8),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=8),
            ],
        ),
        Airbase(
            id="BASE_SHAKTI",
            name="Shakti High-Altitude Base",
            lat=33.87,
            lng=74.97,
            runway_status=RunwayStatus.OPERATIONAL,
            available_fuel_liters=280000.0,
            stored_weapons=[
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=4),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=6),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=6),
            ],
        ),
    ]

    # -------------------------------------------------------------
    # 3. AIRCRAFT FLEET (15 combat jets with distinct roles/loadouts)
    # -------------------------------------------------------------
    aircraft_fleet: List[Aircraft] = [
        # Rafale Squadrons (Trishul & Garuda)
        Aircraft(
            aircraft_id="AC_RAFALE_01",
            model="Rafale EH",
            callsign="GARUDA-01",
            home_base_id="BASE_TRISHUL",
            status=AircraftStatus.READY,
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=6800.0,
            max_takeoff_weight_kg=24500.0,
            empty_weight_kg=10300.0,
            hardpoints_count=14,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=4),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=35,
            fuel_burn_liters_per_km=3.8,
            cruise_speed_kmph=920.0,
        ),
        Aircraft(
            aircraft_id="AC_RAFALE_02",
            model="Rafale EH",
            callsign="GARUDA-02",
            home_base_id="BASE_TRISHUL",
            status=AircraftStatus.READY,
            current_fuel_pct=92.0,
            max_fuel_capacity_liters=6800.0,
            max_takeoff_weight_kg=24500.0,
            empty_weight_kg=10300.0,
            hardpoints_count=14,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=2),
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
            ],
            turnaround_time_mins=35,
            fuel_burn_liters_per_km=3.8,
            cruise_speed_kmph=920.0,
        ),
        Aircraft(
            aircraft_id="AC_RAFALE_03",
            model="Rafale DH",
            callsign="GARUDA-03",
            home_base_id="BASE_GARUDA",
            status=AircraftStatus.READY,
            current_fuel_pct=88.0,
            max_fuel_capacity_liters=6800.0,
            max_takeoff_weight_kg=24500.0,
            empty_weight_kg=10600.0,
            hardpoints_count=14,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=4),
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
            ],
            turnaround_time_mins=35,
            fuel_burn_liters_per_km=3.8,
            cruise_speed_kmph=920.0,
        ),
        Aircraft(
            aircraft_id="AC_RAFALE_04",
            model="Rafale EH",
            callsign="GARUDA-04",
            home_base_id="BASE_GARUDA",
            status=AircraftStatus.MAINTENANCE,  # In maintenance for constraint testing
            current_fuel_pct=50.0,
            max_fuel_capacity_liters=6800.0,
            max_takeoff_weight_kg=24500.0,
            empty_weight_kg=10300.0,
            hardpoints_count=14,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=2),
            ],
            turnaround_time_mins=120,
            fuel_burn_liters_per_km=3.8,
            cruise_speed_kmph=920.0,
        ),

        # Su-30MKI Heavy Strike / Air Dominance (Vayu, Garuda, Varun)
        Aircraft(
            aircraft_id="AC_SU30_01",
            model="Su-30MKI",
            callsign="TRIDENT-01",
            home_base_id="BASE_VAYU",
            status=AircraftStatus.READY,
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=12000.0,
            max_takeoff_weight_kg=38800.0,
            empty_weight_kg=18400.0,
            hardpoints_count=12,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=4),
            ],
            turnaround_time_mins=45,
            fuel_burn_liters_per_km=5.4,
            cruise_speed_kmph=950.0,
        ),
        Aircraft(
            aircraft_id="AC_SU30_02",
            model="Su-30MKI",
            callsign="TRIDENT-02",
            home_base_id="BASE_VAYU",
            status=AircraftStatus.READY,
            current_fuel_pct=92.0,
            max_fuel_capacity_liters=12000.0,
            max_takeoff_weight_kg=38800.0,
            empty_weight_kg=18400.0,
            hardpoints_count=12,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=2),
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=4),
            ],
            turnaround_time_mins=45,
            fuel_burn_liters_per_km=5.4,
            cruise_speed_kmph=950.0,
        ),
        Aircraft(
            aircraft_id="AC_SU30_03",
            model="Su-30MKI",
            callsign="TRIDENT-03",
            home_base_id="BASE_VARUN",
            status=AircraftStatus.READY,
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=12000.0,
            max_takeoff_weight_kg=38800.0,
            empty_weight_kg=18400.0,
            hardpoints_count=12,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_BRAHMOS_A", quantity=1),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=4),
            ],
            turnaround_time_mins=50,
            fuel_burn_liters_per_km=5.4,
            cruise_speed_kmph=950.0,
        ),
        Aircraft(
            aircraft_id="AC_SU30_04",
            model="Su-30MKI",
            callsign="TRIDENT-04",
            home_base_id="BASE_MARUT",
            status=AircraftStatus.READY,
            current_fuel_pct=94.0,
            max_fuel_capacity_liters=12000.0,
            max_takeoff_weight_kg=38800.0,
            empty_weight_kg=18400.0,
            hardpoints_count=12,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_BRAHMOS_A", quantity=1),
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
            ],
            turnaround_time_mins=50,
            fuel_burn_liters_per_km=5.4,
            cruise_speed_kmph=950.0,
        ),

        # Tejas Mk1A Light Combat Jets (Marut & Shakti)
        Aircraft(
            aircraft_id="AC_TEJAS_01",
            model="Tejas Mk1A",
            callsign="LIGHTNING-01",
            home_base_id="BASE_MARUT",
            status=AircraftStatus.READY,
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=3000.0,
            max_takeoff_weight_kg=13500.0,
            empty_weight_kg=6560.0,
            hardpoints_count=8,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=2),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=30,
            fuel_burn_liters_per_km=2.2,
            cruise_speed_kmph=850.0,
        ),
        Aircraft(
            aircraft_id="AC_TEJAS_02",
            model="Tejas Mk1A",
            callsign="LIGHTNING-02",
            home_base_id="BASE_MARUT",
            status=AircraftStatus.READY,
            current_fuel_pct=90.0,
            max_fuel_capacity_liters=3000.0,
            max_takeoff_weight_kg=13500.0,
            empty_weight_kg=6560.0,
            hardpoints_count=8,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
            ],
            turnaround_time_mins=30,
            fuel_burn_liters_per_km=2.2,
            cruise_speed_kmph=850.0,
        ),
        Aircraft(
            aircraft_id="AC_TEJAS_03",
            model="Tejas Mk1A",
            callsign="LIGHTNING-03",
            home_base_id="BASE_SHAKTI",
            status=AircraftStatus.READY,
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=3000.0,
            max_takeoff_weight_kg=13500.0,
            empty_weight_kg=6560.0,
            hardpoints_count=8,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=2),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=30,
            fuel_burn_liters_per_km=2.2,
            cruise_speed_kmph=850.0,
        ),
        Aircraft(
            aircraft_id="AC_TEJAS_04",
            model="Tejas Mk1A",
            callsign="LIGHTNING-04",
            home_base_id="BASE_SHAKTI",
            status=AircraftStatus.MAINTENANCE,  # In maintenance
            current_fuel_pct=40.0,
            max_fuel_capacity_liters=3000.0,
            max_takeoff_weight_kg=13500.0,
            empty_weight_kg=6560.0,
            hardpoints_count=8,
            equipped_weapons=[],
            turnaround_time_mins=90,
            fuel_burn_liters_per_km=2.2,
            cruise_speed_kmph=850.0,
        ),

        # Mirage 2000-5 Multi-role (Garuda & Trishul)
        Aircraft(
            aircraft_id="AC_MIRAGE_01",
            model="Mirage 2000-5",
            callsign="VAJRA-01",
            home_base_id="BASE_GARUDA",
            status=AircraftStatus.READY,
            current_fuel_pct=94.0,
            max_fuel_capacity_liters=4300.0,
            max_takeoff_weight_kg=17000.0,
            empty_weight_kg=7500.0,
            hardpoints_count=9,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=1),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=40,
            fuel_burn_liters_per_km=2.9,
            cruise_speed_kmph=890.0,
        ),
        Aircraft(
            aircraft_id="AC_MIRAGE_02",
            model="Mirage 2000-5",
            callsign="VAJRA-02",
            home_base_id="BASE_GARUDA",
            status=AircraftStatus.READY,
            current_fuel_pct=92.0,
            max_fuel_capacity_liters=4300.0,
            max_takeoff_weight_kg=17000.0,
            empty_weight_kg=7500.0,
            hardpoints_count=9,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_HAMMER_AASM", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
            ],
            turnaround_time_mins=40,
            fuel_burn_liters_per_km=2.9,
            cruise_speed_kmph=890.0,
        ),
        Aircraft(
            aircraft_id="AC_MIRAGE_03",
            model="Mirage 2000-5",
            callsign="VAJRA-03",
            home_base_id="BASE_TRISHUL",
            status=AircraftStatus.READY,
            current_fuel_pct=92.0,
            max_fuel_capacity_liters=4300.0,
            max_takeoff_weight_kg=17000.0,
            empty_weight_kg=7500.0,
            hardpoints_count=9,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_SPICE_2000", quantity=1),
                EquippedWeapon(weapon_id="WEP_RUDRAM_1", quantity=2),
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
            ],
            turnaround_time_mins=40,
            fuel_burn_liters_per_km=2.9,
            cruise_speed_kmph=890.0,
        ),

        # Rotary-Wing: Combat Rescue (CSAR) & Heavy Transport Helicopters
        Aircraft(
            aircraft_id="AC_HELI_MI17_01",
            model="Mi-17V5 SAR",
            callsign="RESCUE-01",
            home_base_id="BASE_SHAKTI",
            status=AircraftStatus.READY,
            asset_type="RESCUE_HELICOPTER",
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=2617.0,
            max_takeoff_weight_kg=13000.0,
            empty_weight_kg=7489.0,
            hardpoints_count=4,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=25,
            fuel_burn_liters_per_km=2.4,
            cruise_speed_kmph=250.0,
        ),
        Aircraft(
            aircraft_id="AC_HELI_MI17_02",
            model="Mi-17V5 CSAR",
            callsign="RESCUE-02",
            home_base_id="BASE_GARUDA",
            status=AircraftStatus.READY,
            asset_type="RESCUE_HELICOPTER",
            current_fuel_pct=92.0,
            max_fuel_capacity_liters=2617.0,
            max_takeoff_weight_kg=13000.0,
            empty_weight_kg=7489.0,
            hardpoints_count=4,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=25,
            fuel_burn_liters_per_km=2.4,
            cruise_speed_kmph=250.0,
        ),
        Aircraft(
            aircraft_id="AC_HELI_MI17_03",
            model="Mi-17V5 Tactical SAR",
            callsign="RESCUE-03",
            home_base_id="BASE_MARUT",
            status=AircraftStatus.READY,
            asset_type="RESCUE_HELICOPTER",
            current_fuel_pct=88.0,
            max_fuel_capacity_liters=2617.0,
            max_takeoff_weight_kg=13000.0,
            empty_weight_kg=7489.0,
            hardpoints_count=4,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=25,
            fuel_burn_liters_per_km=2.4,
            cruise_speed_kmph=250.0,
        ),
        Aircraft(
            aircraft_id="AC_HELI_CHINOOK_01",
            model="CH-47F Chinook",
            callsign="TITAN-01",
            home_base_id="BASE_TRISHUL",
            status=AircraftStatus.READY,
            asset_type="TRANSPORT_HELICOPTER",
            current_fuel_pct=90.0,
            max_fuel_capacity_liters=3914.0,
            max_takeoff_weight_kg=22680.0,
            empty_weight_kg=11150.0,
            hardpoints_count=2,
            equipped_weapons=[],
            turnaround_time_mins=30,
            fuel_burn_liters_per_km=3.2,
            cruise_speed_kmph=290.0,
        ),
        Aircraft(
            aircraft_id="AC_HELI_CHINOOK_02",
            model="CH-47F Chinook Heavy",
            callsign="TITAN-02",
            home_base_id="BASE_VAYU",
            status=AircraftStatus.READY,
            asset_type="TRANSPORT_HELICOPTER",
            current_fuel_pct=94.0,
            max_fuel_capacity_liters=3914.0,
            max_takeoff_weight_kg=22680.0,
            empty_weight_kg=11150.0,
            hardpoints_count=2,
            equipped_weapons=[],
            turnaround_time_mins=30,
            fuel_burn_liters_per_km=3.2,
            cruise_speed_kmph=290.0,
        ),
        Aircraft(
            aircraft_id="AC_HELI_CHINOOK_03",
            model="CH-47F Chinook Cargo",
            callsign="TITAN-03",
            home_base_id="BASE_VARUN",
            status=AircraftStatus.READY,
            asset_type="TRANSPORT_HELICOPTER",
            current_fuel_pct=91.0,
            max_fuel_capacity_liters=3914.0,
            max_takeoff_weight_kg=22680.0,
            empty_weight_kg=11150.0,
            hardpoints_count=2,
            equipped_weapons=[],
            turnaround_time_mins=30,
            fuel_burn_liters_per_km=3.2,
            cruise_speed_kmph=290.0,
        ),
        Aircraft(
            aircraft_id="AC_HELI_PRACHAND_01",
            model="HAL Prachand LCH",
            callsign="PRACHAND-01",
            home_base_id="BASE_GARUDA",
            status=AircraftStatus.READY,
            asset_type="RESCUE_HELICOPTER",
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=1400.0,
            max_takeoff_weight_kg=5800.0,
            empty_weight_kg=2250.0,
            hardpoints_count=4,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=20,
            fuel_burn_liters_per_km=1.8,
            cruise_speed_kmph=268.0,
        ),
        Aircraft(
            aircraft_id="AC_HELI_PRACHAND_02",
            model="HAL Prachand LCH",
            callsign="PRACHAND-02",
            home_base_id="BASE_SHAKTI",
            status=AircraftStatus.READY,
            asset_type="RESCUE_HELICOPTER",
            current_fuel_pct=95.0,
            max_fuel_capacity_liters=1400.0,
            max_takeoff_weight_kg=5800.0,
            empty_weight_kg=2250.0,
            hardpoints_count=4,
            equipped_weapons=[
                EquippedWeapon(weapon_id="WEP_ASTRA_MK1", quantity=2),
                EquippedWeapon(weapon_id="WEP_PYTHON_5", quantity=2),
            ],
            turnaround_time_mins=20,
            fuel_burn_liters_per_km=1.8,
            cruise_speed_kmph=268.0,
        ),
    ]

    # -------------------------------------------------------------
    # 4. PILOTS (20 pilots with qualified profiles, some fatigued)
    # -------------------------------------------------------------
    pilots: List[Pilot] = [
        # Trishul Base Pilots
        Pilot(
            pilot_id="PLT_01",
            name="Wg Cdr Vikram Rathore",
            rank="Wing Commander",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=14.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_TRISHUL",
        ),
        Pilot(
            pilot_id="PLT_02",
            name="Sqn Ldr Ananya Sharma",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=12.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_TRISHUL",
        ),
        Pilot(
            pilot_id="PLT_03",
            name="Flt Lt Rohan Mehra",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ALL_WEATHER,
            ],
            rest_hours_completed=5.5,  # Fatigued (< 8h) to test pilot rest constraint
            consecutive_flight_hours=4.5,
            home_base_id="BASE_TRISHUL",
        ),
        Pilot(
            pilot_id="PLT_04",
            name="Sqn Ldr Kabir Sen",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=11.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_TRISHUL",
        ),

        # Garuda Base Pilots
        Pilot(
            pilot_id="PLT_05",
            name="Gp Capt Devendra Nath",
            rank="Group Captain",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=16.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_GARUDA",
        ),
        Pilot(
            pilot_id="PLT_06",
            name="Sqn Ldr Priya Nair",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.NIGHT_OPERATIONS,
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=10.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_GARUDA",
        ),
        Pilot(
            pilot_id="PLT_07",
            name="Flt Lt Aditya Rawat",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.DEAD_SEAD_CERTIFIED,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=9.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_GARUDA",
        ),
        Pilot(
            pilot_id="PLT_08",
            name="Sqn Ldr Tarun Verma",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
            ],
            rest_hours_completed=6.0,  # Fatigued (< 8h)
            consecutive_flight_hours=5.0,
            home_base_id="BASE_GARUDA",
        ),

        # Vayu Base Pilots
        Pilot(
            pilot_id="PLT_09",
            name="Wg Cdr Rajeshwar Gill",
            rank="Wing Commander",
            qualifications=[
                PilotQualification.DEAD_SEAD_CERTIFIED,
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=15.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VAYU",
        ),
        Pilot(
            pilot_id="PLT_10",
            name="Sqn Ldr Gurpreet Singh",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=13.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VAYU",
        ),
        Pilot(
            pilot_id="PLT_11",
            name="Flt Lt Amanullah Khan",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=10.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VAYU",
        ),

        # Marut Base Pilots
        Pilot(
            pilot_id="PLT_12",
            name="Wg Cdr Hardeep Sandhu",
            rank="Wing Commander",
            qualifications=[
                PilotQualification.NIGHT_OPERATIONS,
                PilotQualification.DEAD_SEAD_CERTIFIED,
                PilotQualification.ALL_WEATHER,
                PilotQualification.ANTI_SHIP_CERTIFIED,
            ],
            rest_hours_completed=14.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_MARUT",
        ),
        Pilot(
            pilot_id="PLT_13",
            name="Sqn Ldr Jayesh Patel",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.NIGHT_OPERATIONS,
                PilotQualification.ALL_WEATHER,
                PilotQualification.ANTI_SHIP_CERTIFIED,
            ],
            rest_hours_completed=11.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_MARUT",
        ),
        Pilot(
            pilot_id="PLT_14",
            name="Flt Lt Sameer Joshi",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ANTI_SHIP_CERTIFIED,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=12.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_MARUT",
        ),

        # Varun Base Pilots (Naval / Coastal Strike)
        Pilot(
            pilot_id="PLT_15",
            name="Cdr Arvind Menon",
            rank="Commander",
            qualifications=[
                PilotQualification.ANTI_SHIP_CERTIFIED,
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=18.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VARUN",
        ),
        Pilot(
            pilot_id="PLT_16",
            name="Lt Cdr Neil Deshmukh",
            rank="Lt Commander",
            qualifications=[
                PilotQualification.ANTI_SHIP_CERTIFIED,
                PilotQualification.ALL_WEATHER,
            ],
            rest_hours_completed=13.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VARUN",
        ),
        Pilot(
            pilot_id="PLT_17",
            name="Lt Raghav Kulkarni",
            rank="Lieutenant",
            qualifications=[
                PilotQualification.ANTI_SHIP_CERTIFIED,
            ],
            rest_hours_completed=9.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VARUN",
        ),

        # Shakti Base Pilots
        Pilot(
            pilot_id="PLT_18",
            name="Wg Cdr Tenzing Norbu",
            rank="Wing Commander",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=15.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_SHAKTI",
        ),
        Pilot(
            pilot_id="PLT_19",
            name="Sqn Ldr Bilal Ahmed",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=10.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_SHAKTI",
        ),
        Pilot(
            pilot_id="PLT_20",
            name="Flt Lt Siddharth Roy",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=4.0,  # Fatigued
            consecutive_flight_hours=6.0,
            home_base_id="BASE_SHAKTI",
        ),
        Pilot(
            pilot_id="PLT_21",
            name="Sqn Ldr Karan Thapar",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=12.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_SHAKTI",
        ),
        Pilot(
            pilot_id="PLT_22",
            name="Flt Lt Sneha Kulkarni",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=11.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_TRISHUL",
        ),
        Pilot(
            pilot_id="PLT_23",
            name="Sqn Ldr Rajeshwar Singh",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.NIGHT_OPERATIONS,
                PilotQualification.ALL_WEATHER,
            ],
            rest_hours_completed=14.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_GARUDA",
        ),
        Pilot(
            pilot_id="PLT_24",
            name="Flt Lt Manav Joshi",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.ANTI_SHIP_CERTIFIED,
            ],
            rest_hours_completed=10.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VAYU",
        ),
        Pilot(
            pilot_id="PLT_25",
            name="Sqn Ldr Devendra Nair",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=11.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_GARUDA",
        ),
        Pilot(
            pilot_id="PLT_26",
            name="Flt Lt Karthik Sundaram",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.DEAD_SEAD_CERTIFIED,
            ],
            rest_hours_completed=13.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_MARUT",
        ),
        Pilot(
            pilot_id="PLT_27",
            name="Wg Cdr Harpreet Gill",
            rank="Wing Commander",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=12.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_TRISHUL",
        ),
        Pilot(
            pilot_id="PLT_28",
            name="Sqn Ldr Mohit Chawla",
            rank="Squadron Leader",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=10.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VAYU",
        ),
        Pilot(
            pilot_id="PLT_29",
            name="Flt Lt Aditya Verma",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.ANTI_SHIP_CERTIFIED,
            ],
            rest_hours_completed=14.0,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_VARUN",
        ),
        Pilot(
            pilot_id="PLT_30",
            name="Flt Lt Pranav Rao",
            rank="Flight Lieutenant",
            qualifications=[
                PilotQualification.ALL_WEATHER,
                PilotQualification.NIGHT_OPERATIONS,
            ],
            rest_hours_completed=11.5,
            consecutive_flight_hours=0.0,
            home_base_id="BASE_SHAKTI",
        ),
    ]

    # -------------------------------------------------------------
    # 5. THREAT ENVIRONMENT (4 Tactical Threat Zones)
    # -------------------------------------------------------------
    threat_environment: List[ThreatZone] = [
        ThreatZone(
            threat_id="THREAT_SAM_NORTH",
            name="HQ-9 SAM Battery Sector Alpha",
            type=ThreatType.SAM_RADAR_BATTERY,
            center_location=Location(lat=32.20, lng=74.60, name="Sector Alpha SAM"),
            effective_radius_km=70.0,
            threat_severity=5,
            countermeasure_required="DEAD_SEAD_CHAFF_FLARES",
        ),
        ThreatZone(
            threat_id="THREAT_EW_CENTRAL",
            name="Krasukha-4 Jamming Corridor",
            type=ThreatType.EW_JAMMING_CORRIDOR,
            center_location=Location(lat=28.50, lng=71.80, name="Central Desert Jammer"),
            effective_radius_km=85.0,
            threat_severity=3,
            countermeasure_required="HOJ_BURST_COMM",
        ),
        ThreatZone(
            threat_id="THREAT_STORM_WEST",
            name="Monsoon Severe Squall Front",
            type=ThreatType.SEVERE_WEATHER,
            center_location=Location(lat=24.80, lng=70.50, name="West Coast Front"),
            effective_radius_km=60.0,
            threat_severity=4,
            countermeasure_required="TERRAIN_AVOIDANCE_RADAR",
        ),
        ThreatZone(
            threat_id="THREAT_SAM_SOUTH",
            name="FM-90 Short Range Air Defense Cluster",
            type=ThreatType.SAM_RADAR_BATTERY,
            center_location=Location(lat=22.80, lng=68.90, name="Gulf Point SAM"),
            effective_radius_km=50.0,
            threat_severity=4,
            countermeasure_required="ANTI_RADIATION_STANDOFF",
        ),
    ]

    # -------------------------------------------------------------
    # 6. MISSION TARGETS (6 Operational Targets)
    # -------------------------------------------------------------
    mission_targets: List[MissionTarget] = [
        MissionTarget(
            target_id="TGT_ALPHA_BUNKER",
            name="Alpha Command Bunker Citadel",
            location=Location(lat=31.80, lng=74.20, name="Citadel Underground Complex"),
            target_type=TargetType.HARDENED_BUNKER,
            required_weapon_category=WeaponCategory.PRECISION_GUIDED_BOMB,
            priority_level=5,
            time_window_mins=45,
            required_pilot_qualifications=[PilotQualification.ALL_WEATHER],
        ),
        MissionTarget(
            target_id="TGT_BRAVO_RADAR",
            name="Bravo Early Warning Radar Station",
            location=Location(lat=32.60, lng=74.40, name="Ridge Radar Station"),
            target_type=TargetType.RADAR_STATION,
            required_weapon_category=WeaponCategory.ANTI_RADIATION_MISSILE,
            priority_level=4,
            time_window_mins=60,
            required_pilot_qualifications=[PilotQualification.DEAD_SEAD_CERTIFIED],
        ),
        MissionTarget(
            target_id="TGT_CHARLIE_CONVOY",
            name="Charlie Armored Logistics Column",
            location=Location(lat=28.10, lng=71.30, name="Desert Highway Convoy"),
            target_type=TargetType.CONVOY,
            required_weapon_category=WeaponCategory.PRECISION_GUIDED_BOMB,
            priority_level=3,
            time_window_mins=90,
            required_pilot_qualifications=[PilotQualification.NIGHT_OPERATIONS],
        ),
        MissionTarget(
            target_id="TGT_DELTA_AIRFIELD",
            name="Delta Forward Air Base Runway",
            location=Location(lat=30.15, lng=72.35, name="Delta Runway Interdiction"),
            target_type=TargetType.AIRFIELD,
            required_weapon_category=WeaponCategory.PRECISION_GUIDED_BOMB,
            priority_level=5,
            time_window_mins=40,
            required_pilot_qualifications=[PilotQualification.ALL_WEATHER],
        ),
        MissionTarget(
            target_id="TGT_ECHO_FRIGATE",
            name="Echo Guided Missile Frigate",
            location=Location(lat=22.10, lng=67.90, name="Arabian Sea Patrol Frigate"),
            target_type=TargetType.NAVAL_VESSEL,
            required_weapon_category=WeaponCategory.ANTI_SHIP,
            priority_level=4,
            time_window_mins=75,
            required_pilot_qualifications=[PilotQualification.ANTI_SHIP_CERTIFIED],
        ),
        MissionTarget(
            target_id="TGT_FOXTROT_RADAR",
            name="Foxtrot Sector Surveillance Radar",
            location=Location(lat=27.20, lng=70.90, name="West Sector Radar Node"),
            target_type=TargetType.RADAR_STATION,
            required_weapon_category=WeaponCategory.ANTI_RADIATION_MISSILE,
            priority_level=3,
            time_window_mins=120,
            required_pilot_qualifications=[PilotQualification.DEAD_SEAD_CERTIFIED],
        ),
    ]

    snapshot = StateSnapshot(
        weapons_inventory=weapons,
        aircraft_fleet=aircraft_fleet,
        airbases=airbases,
        pilots=pilots,
        threat_environment=threat_environment,
        mission_targets=mission_targets,
        active_missions=[],
        event_log=[],
        last_updated="2026-10-07T06:00:00Z",
    )

    return snapshot.model_dump()


def validate_consistency(data: Dict[str, Any]) -> None:
    """
    Strict validation of relational and domain consistency.
    Fails loudly if any reference is dangling or physical constraint is violated.
    """
    # 1. Schema check
    snapshot = StateSnapshot.model_validate(data)

    airbase_ids = {base.id for base in snapshot.airbases}
    weapon_map = {w.weapon_id: w for w in snapshot.weapons_inventory}

    # 2. Check Aircraft constraints
    for ac in snapshot.aircraft_fleet:
        if ac.home_base_id not in airbase_ids:
            raise ValueError(f"Aircraft {ac.aircraft_id} references unknown base {ac.home_base_id}")

        # Hardpoints check
        total_weapons = sum(eq.quantity for eq in ac.equipped_weapons)
        if total_weapons > ac.hardpoints_count:
            raise ValueError(
                f"Aircraft {ac.aircraft_id} overloaded hardpoints: {total_weapons} > {ac.hardpoints_count}"
            )

        # Weight check: empty + fuel + weapons <= MTOW
        fuel_weight_kg = ac.current_fuel_liters * 0.8  # Jet-A fuel density ~0.8 kg/L
        weapon_weight_kg = sum(
            weapon_map[eq.weapon_id].weight_kg * eq.quantity
            for eq in ac.equipped_weapons
        )
        total_weight_kg = ac.empty_weight_kg + fuel_weight_kg + weapon_weight_kg
        if total_weight_kg > ac.max_takeoff_weight_kg:
            raise ValueError(
                f"Aircraft {ac.aircraft_id} exceeds MTOW: {total_weight_kg:.1f} kg > {ac.max_takeoff_weight_kg} kg"
            )

    # 3. Check Pilots
    for p in snapshot.pilots:
        if p.home_base_id not in airbase_ids:
            raise ValueError(f"Pilot {p.pilot_id} references unknown base {p.home_base_id}")

    # 4. Check Target Compatibility (Every target must have >= 2 theoretically viable combos)
    from geopy.distance import geodesic

    for target in snapshot.mission_targets:
        viable_count = 0
        viable_details = []
        for ac in snapshot.aircraft_fleet:
            if ac.status != AircraftStatus.READY:
                continue

            base = next(b for b in snapshot.airbases if b.id == ac.home_base_id)
            if base.runway_status != RunwayStatus.OPERATIONAL:
                continue

            # Check weapon category match
            has_matching_weapon = any(
                weapon_map[eq.weapon_id].category == target.required_weapon_category
                for eq in ac.equipped_weapons
            )
            if not has_matching_weapon:
                continue

            # Check range (round trip + 40% margin)
            dist_km = geodesic((base.lat, base.lng), (target.location.lat, target.location.lng)).km
            required_range_km = dist_km * 2 * 1.4
            if ac.max_range_km < required_range_km:
                continue

            # Check for at least one qualified, rested pilot at base
            compatible_pilots = [
                plt for plt in snapshot.pilots
                if plt.home_base_id == ac.home_base_id
                and plt.rest_hours_completed >= 8.0
                and all(q in plt.qualifications for q in target.required_pilot_qualifications)
            ]

            if compatible_pilots:
                viable_count += 1
                viable_details.append(f"{ac.aircraft_id}@{base.id} ({len(compatible_pilots)} pilots)")

        if viable_count < 2:
            raise ValueError(
                f"Target {target.target_id} ({target.name}) only has {viable_count} viable aircraft options: {viable_details} (minimum required is 2)"
            )


def save_mock_data(output_path: Path, seed: int = 42) -> None:
    data = generate_synthetic_data(seed=seed)
    validate_consistency(data)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"[AirPower Generator] Successfully generated and validated mock data -> {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AirPower Synthetic Data Generator")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    parser.add_argument(
        "--output",
        type=str,
        default=str(Path(__file__).parent.parent / "data" / "mock_data.json"),
        help="Target JSON file path",
    )
    args = parser.parse_args()
    save_mock_data(Path(args.output), seed=args.seed)
