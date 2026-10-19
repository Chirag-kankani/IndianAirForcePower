"""
Geospatial and Threat Intersection Utilities.
Uses Shapely geometry and geodesic/haversine formulas for threat exposure and detour waypoints.
"""
from __future__ import annotations

import math
from typing import List, Tuple, Optional
from shapely.geometry import LineString, Point, Polygon

from app.models import Location, ThreatZone, Waypoint


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes the great-circle distance between two points in kilometers."""
    r = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def compute_route_threat_exposure(
    start: Location,
    end: Location,
    threats: List[ThreatZone],
) -> Tuple[float, List[dict]]:
    """
    Computes total threat exposure score along a straight route segment using Shapely.
    Score = sum(threat_severity * length_of_segment_inside_threat_in_km)
    Returns: (total_score, breakdown_list)
    """
    total_score = 0.0
    breakdown = []

    # 1 degree latitude ~ 111 km. 1 degree longitude at ~28 deg lat ~ 98 km.
    # We work with normalized Cartesian coordinates mapped to kilometers for accurate geometric intersection.
    mean_lat = (start.lat + end.lat) / 2.0
    km_per_deg_lat = 111.0
    km_per_deg_lng = 111.0 * math.cos(math.radians(mean_lat))

    def to_km_coords(lat: float, lng: float) -> Tuple[float, float]:
        return ((lng - start.lng) * km_per_deg_lng, (lat - start.lat) * km_per_deg_lat)

    p_start = to_km_coords(start.lat, start.lng)
    p_end = to_km_coords(end.lat, end.lng)
    flight_line = LineString([p_start, p_end])

    for threat in threats:
        t_center = to_km_coords(threat.center_location.lat, threat.center_location.lng)
        threat_circle = Point(t_center).buffer(threat.effective_radius_km)

        if flight_line.intersects(threat_circle):
            intersection = flight_line.intersection(threat_circle)
            intersect_length_km = intersection.length
            threat_penalty = intersect_length_km * threat.threat_severity
            total_score += threat_penalty
            breakdown.append({
                "threat_id": threat.threat_id,
                "name": threat.name,
                "severity": threat.threat_severity,
                "inside_distance_km": round(intersect_length_km, 2),
                "penalty": round(threat_penalty, 2),
            })

    return round(total_score, 2), breakdown


def generate_detour_waypoints(
    start: Location,
    end: Location,
    threats: List[ThreatZone],
    margin_factor: float = 1.15,
) -> List[Waypoint]:
    """
    Generates waypoints: Start -> (optional Tangent Detour Waypoints) -> End -> Return.
    If route intersects severe threat zones (severity >= 3), computes tangent detour nodes.
    """
    waypoints: List[Waypoint] = [
        Waypoint(lat=start.lat, lng=start.lng, name=start.name or "Departure Base", action="TAKEOFF")
    ]

    mean_lat = (start.lat + end.lat) / 2.0
    km_per_deg_lat = 111.0
    km_per_deg_lng = 111.0 * math.cos(math.radians(mean_lat))

    def to_km_coords(lat: float, lng: float) -> Tuple[float, float]:
        return ((lng - start.lng) * km_per_deg_lng, (lat - start.lat) * km_per_deg_lat)

    def to_geo_coords(x_km: float, y_km: float) -> Tuple[float, float]:
        lng = start.lng + (x_km / km_per_deg_lng)
        lat = start.lat + (y_km / km_per_deg_lat)
        return round(lat, 4), round(lng, 4)

    p_start = to_km_coords(start.lat, start.lng)
    p_end = to_km_coords(end.lat, end.lng)
    flight_line = LineString([p_start, p_end])

    detour_points = []
    for threat in threats:
        # Avoid high severity SAM/Weather
        if threat.threat_severity >= 3:
            t_center = to_km_coords(threat.center_location.lat, threat.center_location.lng)
            threat_circle = Point(t_center).buffer(threat.effective_radius_km)

            if flight_line.intersects(threat_circle):
                # Calculate perpendicular tangent detour point
                dx = p_end[0] - p_start[0]
                dy = p_end[1] - p_start[1]
                line_len = math.hypot(dx, dy)
                if line_len > 0:
                    # Normal vector
                    nx = -dy / line_len
                    ny = dx / line_len

                    # Detour offset: threat center + radius * margin in normal direction
                    offset_dist = threat.effective_radius_km * margin_factor
                    detour_x = t_center[0] + nx * offset_dist
                    detour_y = t_center[1] + ny * offset_dist

                    d_lat, d_lng = to_geo_coords(detour_x, detour_y)
                    detour_points.append(
                        Waypoint(
                            lat=d_lat,
                            lng=d_lng,
                            name=f"Detour-{threat.threat_id[:10]}",
                            action="DETOUR",
                        )
                    )

    # Insert detour waypoints
    waypoints.extend(detour_points)

    # Target engagement waypoint
    waypoints.append(
        Waypoint(lat=end.lat, lng=end.lng, name=end.name or "Mission Target", action="ENGAGE")
    )

    # Return leg waypoints (mirrored or direct back)
    for dw in reversed(detour_points):
        waypoints.append(
            Waypoint(lat=dw.lat, lng=dw.lng, name=f"Return-{dw.name}", action="DETOUR")
        )

    # Recovery at base
    waypoints.append(
        Waypoint(lat=start.lat, lng=start.lng, name=f"Recovery ({start.name or 'Base'})", action="RECOVERY")
    )

    return waypoints


def compute_route_total_distance_km(waypoints: List[Waypoint]) -> float:
    """Computes total polyline distance across all waypoints in kilometers."""
    total_km = 0.0
    for i in range(len(waypoints) - 1):
        total_km += haversine_distance_km(
            waypoints[i].lat,
            waypoints[i].lng,
            waypoints[i + 1].lat,
            waypoints[i + 1].lng,
        )
    return round(total_km, 2)
