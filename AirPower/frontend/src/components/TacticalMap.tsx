import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  GeoJSON,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Satellite,
  Moon,
  Map as MapIcon,
  ShieldAlert,
  Info,
  X,
  Plane,
  Crosshair,
  Fuel,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  CloudRain,
  CloudLightning,
  Wind,
  Thermometer,
  Compass,
  RefreshCw,
  Eye,
  AlertOctagon,
  Zap,
} from 'lucide-react';

// Fix Leaflet default icon paths in Vite/React builds
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

import type {
  Airbase,
  ThreatZone,
  MissionTarget,
  ActiveMission,
  MissionPackage,
  Location,
  AirbaseWeatherData,
} from '../types';
import { fetchTheatreWeather, resetWeatherScenario } from '../services/api';

export type MapTileStyle = 'satellite' | 'hybrid' | 'dark' | 'osm';

export type DetectedWeatherScenario =
  | 'THUNDERSTORM_SQUALL'
  | 'GALE_WINDS'
  | 'MONSOON_DOWNPOUR'
  | 'DENSE_FOG'
  | null;

/**
 * Meteorological Wind Direction Convention:
 * Open-Meteo reports wind_direction_deg as degrees FROM WHICH the wind blows
 * (0° = North, 90° = East, 180° = South, 270° = West).
 * Visual downstream vectors pointing in the airflow travel direction must point to (wind_direction + 180) % 360.
 */
export const getDownstreamHeading = (deg: number): number => (deg + 180) % 360;

export const getWindCardinal = (deg: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg % 360) / 22.5)) % 16;
  return directions[index];
};

export const detectWeatherScenario = (weather?: AirbaseWeatherData): DetectedWeatherScenario => {
  if (!weather?.current) return null;
  const desc = (weather.current.weather_description || '').toLowerCase();
  const code = weather.current.weather_code;
  const wind = weather.current.wind_speed_kmh;
  const rain = weather.current.rain_mm;
  const vis = weather.current.visibility_m;

  if (desc.includes('squall') || desc.includes('supercell') || code === 99 || code === 95 || code === 96) {
    return 'THUNDERSTORM_SQUALL';
  }
  if (desc.includes('gale') || desc.includes('crosswind') || (wind >= 60 && code === 2)) {
    return 'GALE_WINDS';
  }
  if (desc.includes('monsoon') || desc.includes('cloudburst') || code === 65 || rain >= 20) {
    return 'MONSOON_DOWNPOUR';
  }
  if (desc.includes('fog') || code === 45 || (vis !== null && vis !== undefined && vis <= 500)) {
    return 'DENSE_FOG';
  }
  return null;
};

// Compute parallel directional wind streamlines across an airbase (for Gale scenarios)
export const computeCrosswindStreamlines = (lat: number, lng: number, dirDeg: number): [number, number][][] => {
  const downstream = (dirDeg + 180) % 360;
  const rad = (downstream * Math.PI) / 180;
  const perpRad = rad + Math.PI / 2;

  const halfLen = 0.16; // approx 18km length
  const offsets = [-0.08, 0, 0.08]; // 3 parallel corridors

  return offsets.map((off) => {
    const cLat = lat + Math.cos(perpRad) * off;
    const cLng = lng + Math.sin(perpRad) * off;
    const start: [number, number] = [cLat - Math.cos(rad) * halfLen, cLng - Math.sin(rad) * halfLen];
    const end: [number, number] = [cLat + Math.cos(rad) * halfLen, cLng + Math.sin(rad) * halfLen];
    return [start, end];
  });
};

// Illustrative simulation banner icon for active weather hazards
export const createScenarioBannerIcon = (scenario: DetectedWeatherScenario, weather: AirbaseWeatherData) => {
  let badgeBorder = '#DC2626';
  let badgeColor = '#EF4444';
  let icon = '⚠️';
  let title = 'WEATHER HAZARD';
  let details = '';

  if (scenario === 'THUNDERSTORM_SQUALL') {
    badgeBorder = '#C084FC';
    badgeColor = '#9333EA';
    icon = '⚡';
    title = 'THUNDERSTORM SQUALL [SYNTHETIC SIMULATION]';
    details = `Microburst Gusts ${weather.current?.wind_gusts_kmh.toFixed(0)} km/h • Convective Radar Core`;
  } else if (scenario === 'GALE_WINDS') {
    badgeBorder = '#F59E0B';
    badgeColor = '#D97706';
    icon = '💨';
    title = 'GALE CROSSWINDS [SYNTHETIC SIMULATION]';
    details = `Crosswind Shear ${weather.current?.wind_speed_kmh.toFixed(0)} km/h • Runway Takeoff Limit Exceeded`;
  } else if (scenario === 'MONSOON_DOWNPOUR') {
    badgeBorder = '#38BDF8';
    badgeColor = '#0284C7';
    icon = '🌧️';
    title = 'MONSOON DOWNPOUR [SYNTHETIC SIMULATION]';
    details = `Precipitation Rate ${weather.current?.rain_mm.toFixed(1)} mm/h • Severe Hydroplaning Risk`;
  } else if (scenario === 'DENSE_FOG') {
    badgeBorder = '#94A3B8';
    badgeColor = '#475569';
    icon = '🌫️';
    title = 'DENSE RADIATION FOG [SYNTHETIC SIMULATION]';
    details = `RVR ${weather.current?.visibility_m ? `${weather.current.visibility_m}m` : '<400m'} • Ceiling 0 AGL (CAT IIIB Only)`;
  }

  return L.divIcon({
    className: 'custom-scenario-banner',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 4px 16px rgba(0,0,0,0.95)); cursor:pointer;">
        <div style="font-family:ui-monospace, SFMono-Regular, monospace; font-size:10px; font-weight:900; color:#FFFFFF; background:rgba(7,11,20,0.95); padding:3px 9px; border-radius:5px; border:1.5px solid ${badgeBorder}; box-shadow:0 0 16px ${badgeColor}90; display:flex; align-items:center; gap:5px; white-space:nowrap;">
          <span style="font-size:12px;">${icon}</span>
          <span>${title}</span>
        </div>
        <div style="font-family:ui-monospace, monospace; font-size:8.5px; font-weight:700; color:${badgeBorder}; background:rgba(7,11,20,0.94); padding:1.5px 7px; border-radius:3px; margin-top:3px; border:1px solid ${badgeBorder}60; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.8);">
          ${details}
        </div>
      </div>
    `,
    iconSize: [260, 48],
    iconAnchor: [130, 44],
  });
};

// Dedicated downstream wind vector marker with orientation and velocity
export const createWindVectorMarkerIcon = (weather: AirbaseWeatherData) => {
  if (!weather.current) return null;
  const speed = weather.current.wind_speed_kmh;
  const dir = weather.current.wind_direction_deg;
  const downstream = getDownstreamHeading(dir);
  const cardinal = getWindCardinal(dir);
  const color = speed >= 55 ? '#EF4444' : (speed >= 35 ? '#F59E0B' : '#10B981');

  return L.divIcon({
    className: 'custom-wind-vector-marker',
    html: `
      <div style="display:flex; align-items:center; gap:4px; font-family:ui-monospace,monospace; font-size:9px; font-weight:800; color:${color}; background:rgba(7,11,20,0.94); border:1.5px solid ${color}; padding:2.5px 7px; border-radius:4px; box-shadow:0 3px 10px rgba(0,0,0,0.9); white-space:nowrap;" title="Wind origin: ${dir.toFixed(0)}° (${cardinal}). Downstream travel heading: ${downstream.toFixed(0)}° at ${speed.toFixed(0)} km/h">
        <svg style="width:12px; height:12px; transform: rotate(${downstream}deg); transition: transform 0.3s ease; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
        <span>${speed.toFixed(0)} km/h</span>
        <span style="font-size:7.5px; opacity:0.8;">(${cardinal})</span>
      </div>
    `,
    iconSize: [110, 26],
    iconAnchor: [55, 13],
  });
};

interface TacticalMapProps {
  airbases: Airbase[];
  threats: ThreatZone[];
  targets: MissionTarget[];
  activeMissions: ActiveMission[];
  selectedPackage: MissionPackage | null;
  selectedTargetId: string | null;
  onSelectTarget: (targetId: string) => void;
  onMapClickTarget: (loc: Location) => void;
  activeAlertMessage?: string | null;
  theatreWeather?: AirbaseWeatherData[];
  onRefreshWeather?: () => void;
}

// -----------------------------------------------------------------------------
// High-Contrast Marker Icons Optimized for Satellite Terrain
// -----------------------------------------------------------------------------
const createAirbaseIcon = (
  base: Airbase,
  isSelected: boolean,
  weather?: AirbaseWeatherData,
  weatherMode: 'SUMMARY' | 'PRECIP' | 'WIND' | 'ALERTS' = 'SUMMARY',
  showWeather: boolean = true,
  isDecluttered: boolean = false
) => {
  const isBlocked = base.runway_status === 'BLOCKED';
  const color = isBlocked ? '#EF4444' : '#10B981';
  const glow = isBlocked ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.7)';
  const statusLabel = isBlocked ? 'LOCKED OUT' : 'OPERATIONAL';

  let weatherPillHtml = '';
  // Only display secondary weather pill if not decluttered, or if this airbase is explicitly selected
  if (showWeather && (!isDecluttered || isSelected) && weather?.current) {
    const risk = weather.risk_assessment?.overall_risk || 'LOW';
    const riskColor = risk === 'HIGH' ? '#EF4444' : (risk === 'MODERATE' ? '#F59E0B' : '#10B981');
    const riskBg = risk === 'HIGH' ? 'rgba(239, 68, 68, 0.35)' : (risk === 'MODERATE' ? 'rgba(245, 158, 11, 0.28)' : 'rgba(16, 185, 129, 0.22)');
    const downstream = getDownstreamHeading(weather.current.wind_direction_deg);

    const windArrowSvg = `
      <svg style="width:10px; height:10px; transform: rotate(${downstream}deg); flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="${riskColor}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
      </svg>
    `;

    let weatherText = '';
    if (weatherMode === 'WIND') {
      weatherText = `${windArrowSvg} <span>${weather.current.wind_speed_kmh.toFixed(0)} km/h</span>`;
    } else if (weatherMode === 'PRECIP') {
      weatherText = `<span>🌧️ ${weather.current.rain_mm.toFixed(1)} mm</span>`;
    } else if (weatherMode === 'ALERTS') {
      weatherText = `<span>${risk === 'HIGH' ? '⚠️ ADVERSE' : (risk === 'MODERATE' ? '⚡ CAUTION' : '✓ CLEAR')}</span>`;
    } else {
      weatherText = `<span>${weather.current.temperature_c.toFixed(0)}°C</span> ${windArrowSvg} <span>${weather.current.wind_speed_kmh.toFixed(0)}k</span>`;
    }

    const syntheticBadge = weather.is_synthetic
      ? '<span style="color: #F0ABFC; background: rgba(168,85,247,0.35); border: 1px solid #C084FC; font-size: 8px; font-weight: 900; padding: 0.5px 3px; border-radius: 3px; margin-left: 3px;">[SYN]</span>'
      : '';

    const staleBadge = weather.is_stale
      ? '<span style="color: #FCD34D; font-size: 8px; font-weight: 900; margin-left: 2px;">[STALE]</span>'
      : '';

    weatherPillHtml = `
      <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 9px; font-weight: 800; color: ${riskColor}; background: ${riskBg}; padding: 2px 7px; border-radius: 4px; border: 1.5px solid ${riskColor}; margin-top: 3px; white-space: nowrap; box-shadow: 0 3px 10px rgba(0,0,0,0.9); display: flex; align-items: center; gap: 4px;">
        <span style="display:flex; align-items:center; gap:3px;">${weatherText}</span>
        ${syntheticBadge}
        ${staleBadge}
      </div>
    `;
  }

  return L.divIcon({
    className: 'custom-airbase-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.85));">
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
          <!-- Outer Pulsing Halo -->
          <div style="position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid ${color}; opacity: 0.6; ${isSelected ? 'animation: pulse-ring 2s infinite;' : ''}"></div>
          <!-- Hex / Circle Center -->
          <div style="position: absolute; inset: 0; border-radius: 50%; border: 2.5px solid ${color}; background: rgba(7, 11, 20, 0.92); box-shadow: 0 0 18px ${glow};"></div>
          ${isBlocked ? `<div style="position: absolute; inset: -5px; border-radius: 50%; border: 2px dashed #EF4444; animation: spin 4s linear infinite;"></div>` : ''}
          <svg style="width: 20px; height: 20px; color: ${color}; position: relative; z-index: 2;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
          </svg>
        </div>
        <!-- High Contrast Tactical Pill Label -->
        <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 10px; font-weight: 800; color: #FFFFFF; background: rgba(7, 11, 20, 0.95); padding: 2px 7px; border-radius: 4px; border: 1.5px solid ${color}; margin-top: 3px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.9); display: flex; align-items: center; gap: 4px;">
          <span style="color: ${color};">✈</span>
          <span>${base.name.split(' ')[0]}</span>
          <span style="color: ${color}; font-size: 8px; font-weight: 900;">(${statusLabel})</span>
        </div>
        ${weatherPillHtml}
      </div>
    `,
    iconSize: [160, weatherPillHtml ? 85 : 52],
    iconAnchor: [80, 19],
    popupAnchor: [0, -22],
  });
};

const createTargetIcon = (
  tgt: MissionTarget,
  isSelected: boolean,
  isCompact: boolean = false,
  isSortieObjective: boolean = false
) => {
  // If declutter compact mode is active and this is NOT the current sortie objective or selected target
  if (isCompact && !isSelected && !isSortieObjective) {
    return L.divIcon({
      className: 'custom-target-marker-compact',
      html: `
        <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.85)); opacity: 0.75;" title="${tgt.name} (${tgt.target_type}) - Priority ${tgt.priority_level}">
          <div style="position: absolute; inset: 0; transform: rotate(45deg); border: 1.5px solid #64748B; background: rgba(7, 11, 20, 0.92); border-radius: 3px;"></div>
          <span style="position: relative; z-index: 2; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 9px; font-weight: 800; color: #94A3B8;">P${tgt.priority_level}</span>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12],
    });
  }

  const badgeColor = isSelected ? '#38BDF8' : (isSortieObjective ? '#F59E0B' : '#F59E0B');
  const glow = isSelected ? 'rgba(56, 189, 248, 0.95)' : 'rgba(245, 158, 11, 0.85)';
  const borderWeight = isSelected ? '3px' : (isSortieObjective ? '2.5px' : '2px');
  const isSpecial = isSelected || isSortieObjective;

  return L.divIcon({
    className: 'custom-target-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.85));">
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          ${isSpecial ? `<div style="position: absolute; inset: -6px; border-radius: 6px; border: 1.5px dashed ${badgeColor}; transform: rotate(45deg); animation: pulse-ring 2s infinite;"></div>` : ''}
          <div style="position: absolute; inset: 0; transform: rotate(45deg); border: ${borderWeight} solid ${badgeColor}; background: rgba(7, 11, 20, 0.92); box-shadow: 0 0 16px ${glow}; border-radius: 4px;"></div>
          <span style="position: relative; z-index: 2; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; font-weight: 900; color: ${badgeColor};">P${tgt.priority_level}</span>
        </div>
        <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 10px; font-weight: 800; color: #FFFFFF; background: rgba(7, 11, 20, 0.95); padding: 2px 7px; border-radius: 4px; border: 1.5px solid ${badgeColor}; margin-top: 3px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.9); display: flex; align-items: center; gap: 4px;">
          <span>🎯</span>
          <span>${tgt.name.split(' ')[0]}</span>
          ${isSortieObjective ? `<span style="color: #FCD34D; font-size: 8px; font-weight: 900;">[OBJECTIVE]</span>` : `<span style="color: #94A3B8; font-size: 8px;">[${tgt.target_type.slice(0, 6)}]</span>`}
        </div>
      </div>
    `,
    iconSize: [130, 58],
    iconAnchor: [65, 17],
    popupAnchor: [0, -20],
  });
};

const createAircraftIcon = (callsign: string, isRerouted: boolean, assetType?: string) => {
  const isRotary = assetType === 'RESCUE_HELICOPTER' || assetType === 'TRANSPORT_HELICOPTER';
  const color = isRerouted ? '#F59E0B' : isRotary ? '#34D399' : '#38BDF8';
  const iconEmoji = isRotary ? '🚁' : '✈';

  return L.divIcon({
    className: 'custom-aircraft-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 16px rgba(0,0,0,0.95)); z-index: 999;">
        <!-- Pulsing Active Sortie Radar Halo -->
        <div style="position: absolute; top: -6px; width: 48px; height: 48px; border-radius: 50%; border: 2px solid ${color}; opacity: 0.75; animation: pulse-ring 1.8s infinite;"></div>

        <div style="width: 36px; height: 36px; background: rgba(7, 11, 20, 0.95); border: 2.5px solid ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 22px ${color}; position: relative; z-index: 2;">
          ${
            isRotary
              ? `<svg style="width: 20px; height: 20px; color: ${color};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 6h16M12 6v3M8 10h8a3 3 0 0 1 3 3v1a2 2 0 0 1-2 2H9a3 3 0 0 1-3-3v0a3 3 0 0 1 2-3zM6 13l-4-2v-2M7 18h10M9 16v2M15 16v2" />
                </svg>`
              : `<svg style="width: 20px; height: 20px; color: ${color}; transform: rotate(45deg);" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                </svg>`
          }
        </div>
        <div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 10px; font-weight: 900; color: #FFFFFF; background: rgba(7, 11, 20, 0.95); padding: 2px 8px; border-radius: 4px; border: 1.5px solid ${color}; margin-top: 4px; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,0.95); display: flex; align-items: center; gap: 4px; position: relative; z-index: 2;">
          <span style="color: ${color};">${iconEmoji}</span>
          <span>${callsign}</span>
          <span style="color: ${color}; font-size: 8px; font-weight: 900;">${isRerouted ? '[EVADING]' : '[AIRBORNE]'}</span>
        </div>
      </div>
    `,
    iconSize: [160, 64],
    iconAnchor: [80, 18],
  });
};

const createWaypointIcon = (index: number, lat: number, lng: number) => {
  return L.divIcon({
    className: 'custom-waypoint-marker',
    html: `
      <div style="display: flex; align-items: center; justify-content: center; position: relative; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.95)); cursor: pointer;" title="Evasive Waypoint ${index + 1} (${lat.toFixed(2)}N, ${lng.toFixed(2)}E)">
        <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(245, 158, 11, 0.25); border: 1px solid rgba(245, 158, 11, 0.5); animation: pulse-ring 2s infinite;"></div>
        <div style="width: 22px; height: 22px; background: rgba(7, 11, 20, 0.95); border: 2px solid #F59E0B; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(245, 158, 11, 0.85); position: relative; z-index: 2;">
          <span style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 9px; font-weight: 900; color: #F59E0B;">W${index + 1}</span>
        </div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

function MapClickHandler({
  onMapClick,
  onClearSelected,
}: {
  onMapClick: (loc: Location) => void;
  onClearSelected: () => void;
}) {
  useMapEvents({
    click(e) {
      onClearSelected();
      onMapClick({
        lat: parseFloat(e.latlng.lat.toFixed(4)),
        lng: parseFloat(e.latlng.lng.toFixed(4)),
        name: `Grid ${e.latlng.lat.toFixed(2)}N, ${e.latlng.lng.toFixed(2)}E`,
      });
    },
  });
  return null;
}

// Controller component to execute zoom and reset operations
function MapControllerComponent({
  triggerReset,
  zoomStep,
}: {
  triggerReset: number;
  zoomStep: { type: 'in' | 'out'; id: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (triggerReset > 0) {
      map.setView([28.2, 73.8], 6, { animate: true });
    }
  }, [triggerReset, map]);

  useEffect(() => {
    if (zoomStep) {
      if (zoomStep.type === 'in') {
        map.zoomIn();
      } else {
        map.zoomOut();
      }
    }
  }, [zoomStep, map]);

  return null;
}

// Type for the Tactical Side Information Panel
type SelectedEntity =
  | { type: 'AIRBASE'; data: Airbase }
  | { type: 'TARGET'; data: MissionTarget }
  | { type: 'THREAT'; data: ThreatZone }
  | { type: 'MISSION'; data: ActiveMission };

export const TacticalMap: React.FC<TacticalMapProps> = ({
  airbases,
  threats,
  targets,
  activeMissions,
  selectedPackage,
  selectedTargetId,
  onSelectTarget,
  onMapClickTarget,
  activeAlertMessage,
  theatreWeather: theatreWeatherProp,
  onRefreshWeather,
}) => {
  const [animProgress, setAnimProgress] = useState(0.0);
  const [countriesGeoJson, setCountriesGeoJson] = useState<GeoJsonObject | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map Tile & Style Controls
  // Esri World Imagery (Standard public satellite tile service)
  const defaultSatelliteUrl =
    (import.meta.env.VITE_SATELLITE_TILE_URL as string) ||
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const defaultSatelliteAttr =
    (import.meta.env.VITE_SATELLITE_ATTRIBUTION as string) ||
    'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

  const [tileStyle, setTileStyle] = useState<MapTileStyle>('satellite');
  const [tileError, setTileError] = useState(false);

  // Layer Visibility Toggles
  const [showThreats, setShowThreats] = useState(true);
  const [showAirbases, setShowAirbases] = useState(true);
  const [showTargets, setShowTargets] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showTileMenu, setShowTileMenu] = useState(false);

  // Map Controls State
  const [triggerReset, setTriggerReset] = useState(0);
  const [zoomStep, setZoomStep] = useState<{ type: 'in' | 'out'; id: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [sortieFocusMode, setSortieFocusMode] = useState(true);

  // Dynamic Declutter for Ongoing Sorties
  const hasOngoingSortie = activeMissions.length > 0 || Boolean(selectedPackage);
  const isDeclutterActive = sortieFocusMode && hasOngoingSortie;

  // Active targets being engaged by active missions, package, or user selection
  const activeTargetIds = useMemo(() => {
    const ids = new Set<string>();
    activeMissions.forEach((m) => {
      if (m.target?.target_id) ids.add(m.target.target_id);
    });
    if (selectedPackage?.target_id) ids.add(selectedPackage.target_id);
    if (selectedTargetId) ids.add(selectedTargetId);
    return ids;
  }, [activeMissions, selectedPackage, selectedTargetId]);

  // Weather & Atmospheric Layer State
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);
  const [showWindLayer, setShowWindLayer] = useState(true);
  const [showHazardRegions, setShowHazardRegions] = useState(true);
  const [weatherMode, setWeatherMode] = useState<'SUMMARY' | 'PRECIP' | 'WIND' | 'ALERTS'>('SUMMARY');
  const [localWeather, setLocalWeather] = useState<AirbaseWeatherData[]>([]);
  const [isResettingAirbaseWeather, setIsResettingAirbaseWeather] = useState(false);

  // Effective weather data (uses parent props if passed, otherwise falls back to local fetch)
  const theatreWeather = (theatreWeatherProp && theatreWeatherProp.length > 0) ? theatreWeatherProp : localWeather;

  useEffect(() => {
    if (theatreWeatherProp && theatreWeatherProp.length > 0) return;
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const res = await fetchTheatreWeather(false);
        if (isMounted) setLocalWeather(res.airbases);
      } catch {
        // Soft fallback for offline/disconnected
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [Boolean(theatreWeatherProp && theatreWeatherProp.length > 0)]);

  // Reset Airbase Weather handler
  const handleResetWeatherForAirbase = async (airbaseId: string) => {
    setIsResettingAirbaseWeather(true);
    try {
      await resetWeatherScenario(airbaseId);
      if (onRefreshWeather) {
        await onRefreshWeather();
      } else {
        const res = await fetchTheatreWeather(false);
        setLocalWeather(res.airbases);
      }
    } catch (err: any) {
      alert(`Failed to reset weather: ${err.message}`);
    } finally {
      setIsResettingAirbaseWeather(false);
    }
  };

  // Selected Detail Entity for the Map Side Info Panel
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);

  // When selectedTargetId changes from parent, sync selected entity if needed
  useEffect(() => {
    if (selectedTargetId) {
      const match = targets.find((t) => t.target_id === selectedTargetId);
      if (match) {
        setSelectedEntity({ type: 'TARGET', data: match });
      }
    } else {
      setSelectedEntity((prev) => (prev?.type === 'TARGET' ? null : prev));
    }
  }, [selectedTargetId, targets]);

  // Fetch Natural Earth boundaries
  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
    )
      .then((r) => r.json())
      .then((data) => setCountriesGeoJson(data as GeoJsonObject))
      .catch(() => {
        console.warn('[TacticalMap] Could not load country boundaries GeoJSON.');
      });
  }, []);

  // Animation ticker for active sorties
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimProgress((prev) => (prev >= 1.0 ? 0.05 : prev + 0.02));
    }, 180);
    return () => clearInterval(timer);
  }, []);

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error('Fullscreen failed:', err));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error('Exit fullscreen failed:', err));
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Compute container CSS class based on active style
  const containerStyleClass = useMemo(() => {
    if (tileStyle === 'satellite' || tileStyle === 'hybrid') {
      return 'satellite-mode';
    }
    if (tileStyle === 'dark') {
      return 'dark-carto-mode';
    }
    return 'osm-inverted-mode';
  }, [tileStyle]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#070B14] overflow-hidden select-none ${containerStyleClass}`}
    >
      {/* ----------------------------------------------------------------------- */}
      {/* 1. Leaflet Interactive Satellite Map Container                          */}
      {/* ----------------------------------------------------------------------- */}
      <MapContainer
        center={[28.2, 73.8]}
        zoom={6}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        <MapClickHandler
          onMapClick={onMapClickTarget}
          onClearSelected={() => {
            setSelectedEntity(null);
          }}
        />
        <MapControllerComponent triggerReset={triggerReset} zoomStep={zoomStep} />

        {/* ------------------------------------------------------------------- */}
        {/* Switchable Base Tile Layers                                         */}
        {/* ------------------------------------------------------------------- */}
        {tileStyle === 'satellite' && (
          <TileLayer
            key="esri-satellite"
            url={defaultSatelliteUrl}
            attribution={defaultSatelliteAttr}
            maxZoom={19}
            eventHandlers={{
              tileerror: () => setTileError(true),
            }}
          />
        )}

        {tileStyle === 'hybrid' && (
          <>
            <TileLayer
              key="esri-hybrid-sat"
              url={defaultSatelliteUrl}
              attribution={defaultSatelliteAttr}
              maxZoom={19}
            />
            <TileLayer
              key="esri-hybrid-labels"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri Reference"
              maxZoom={19}
              opacity={0.85}
            />
          </>
        )}

        {tileStyle === 'dark' && (
          <TileLayer
            key="carto-dark"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
          />
        )}

        {tileStyle === 'osm' && (
          <TileLayer
            key="osm-standard"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            subdomains="abc"
            maxZoom={19}
          />
        )}

        {/* Boundary Overlay (Natural Earth) */}
        {showBoundaries && countriesGeoJson && (
          <GeoJSON
            ref={geoJsonRef}
            data={countriesGeoJson}
            style={{
              color: '#38BDF860',
              weight: 1.4,
              fill: false,
              opacity: 0.75,
              dashArray: '4, 6',
              interactive: false,
              bubblingMouseEvents: false,
            }}
          />
        )}

        {/* ------------------------------------------------------------------- */}
        {/* Layer 1: THREAT ZONES                                               */}
        {/* ------------------------------------------------------------------- */}
        {showThreats &&
          threats.map((threat) => {
            const isSAM = threat.type === 'SAM_RADAR_BATTERY';
            const isEW = threat.type === 'EW_JAMMING_CORRIDOR';
            const color = isSAM ? '#EF4444' : isEW ? '#F59E0B' : '#8B5CF6';

            return (
              <React.Fragment key={threat.threat_id}>
                <Circle
                  center={[threat.center_location.lat, threat.center_location.lng]}
                  radius={threat.effective_radius_km * 1000}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedEntity((prev) =>
                        prev?.type === 'THREAT' && prev.data.threat_id === threat.threat_id
                          ? null
                          : { type: 'THREAT', data: threat }
                      );
                    },
                  }}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.22,
                    weight: 2.5,
                    dashArray: '8, 8',
                  }}
                />
              </React.Fragment>
            );
          })}

        {/* ------------------------------------------------------------------- */}
        {/* ------------------------------------------------------------------- */}
        {/* Layer 2: AIRBASES & METEOROLOGICAL VISUALIZATION OVERLAYS           */}
        {/* ------------------------------------------------------------------- */}
        {showAirbases &&
          airbases.map((base) => {
            const weather = theatreWeather.find((w) => w.airbase_id === base.id);
            const isSelected = selectedEntity?.type === 'AIRBASE' && selectedEntity.data.id === base.id;
            const scenario = detectWeatherScenario(weather);
            const riskLevel = weather?.risk_assessment?.overall_risk;
            const hasSevereRisk = riskLevel === 'HIGH';
            const hasModerateRisk = riskLevel === 'MODERATE';

            return (
              <React.Fragment key={base.id}>
                {/* 1. Spatial Weather Intensity & Hazard Regions */}
                {showWeatherOverlay && showHazardRegions && weather?.current && (
                  <>
                    {/* A. THUNDERSTORM SQUALL: Convective Core (purple) + Outer Squall Gust Front (red) */}
                    {scenario === 'THUNDERSTORM_SQUALL' && (
                      <>
                        {/* Outer Gust Front / Microburst Boundary */}
                        <Circle
                          center={[base.lat, base.lng]}
                          radius={50000}
                          pathOptions={{
                            color: '#EF4444',
                            fillColor: '#EF4444',
                            fillOpacity: 0.15,
                            weight: 2.2,
                            dashArray: '8, 8',
                          }}
                          eventHandlers={{
                            click: (e) => {
                              L.DomEvent.stopPropagation(e);
                              setSelectedEntity({ type: 'AIRBASE', data: base });
                            },
                          }}
                        />
                        {/* Convective Radar Core */}
                        <Circle
                          center={[base.lat, base.lng]}
                          radius={28000}
                          pathOptions={{
                            color: '#C084FC',
                            fillColor: '#9333EA',
                            fillOpacity: 0.35,
                            weight: 2.5,
                            dashArray: '4, 6',
                          }}
                          eventHandlers={{
                            click: (e) => {
                              L.DomEvent.stopPropagation(e);
                              setSelectedEntity({ type: 'AIRBASE', data: base });
                            },
                          }}
                        />
                        {/* Scenario Floating Illustrative Badge */}
                        {(!isDeclutterActive || isSelected) && (
                          <Marker
                            position={[base.lat + 0.38, base.lng]}
                            icon={createScenarioBannerIcon('THUNDERSTORM_SQUALL', weather)}
                            eventHandlers={{
                              click: (e) => {
                                L.DomEvent.stopPropagation(e);
                                setSelectedEntity({ type: 'AIRBASE', data: base });
                              },
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* B. GALE WINDS: Crosswind Envelope + Parallel Directional Wind Streamlines */}
                    {scenario === 'GALE_WINDS' && (
                      <>
                        <Circle
                          center={[base.lat, base.lng]}
                          radius={34000}
                          pathOptions={{
                            color: '#F59E0B',
                            fillColor: '#F59E0B',
                            fillOpacity: 0.18,
                            weight: 2.0,
                            dashArray: '6, 6',
                          }}
                          eventHandlers={{
                            click: (e) => {
                              L.DomEvent.stopPropagation(e);
                              setSelectedEntity({ type: 'AIRBASE', data: base });
                            },
                          }}
                        />
                        {/* Parallel Wind Streamlines crossing airbase runway axis */}
                        {computeCrosswindStreamlines(base.lat, base.lng, weather.current.wind_direction_deg).map((line, idx) => (
                          <Polyline
                            key={`gale-streamline-${base.id}-${idx}`}
                            positions={line}
                            pathOptions={{
                              color: '#F59E0B',
                              weight: 2.6,
                              dashArray: '8, 6',
                              opacity: 0.85,
                            }}
                          />
                        ))}
                        {(!isDeclutterActive || isSelected) && (
                          <Marker
                            position={[base.lat + 0.28, base.lng]}
                            icon={createScenarioBannerIcon('GALE_WINDS', weather)}
                            eventHandlers={{
                              click: (e) => {
                                L.DomEvent.stopPropagation(e);
                                setSelectedEntity({ type: 'AIRBASE', data: base });
                              },
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* C. MONSOON DOWNPOUR: Inner Torrential Zone + Outer Rain Field */}
                    {scenario === 'MONSOON_DOWNPOUR' && (
                      <>
                        <Circle
                          center={[base.lat, base.lng]}
                          radius={38000}
                          pathOptions={{
                            color: '#3B82F6',
                            fillColor: '#3B82F6',
                            fillOpacity: 0.18,
                            weight: 1.8,
                            dashArray: '5, 7',
                          }}
                          eventHandlers={{
                            click: (e) => {
                              L.DomEvent.stopPropagation(e);
                              setSelectedEntity({ type: 'AIRBASE', data: base });
                            },
                          }}
                        />
                        <Circle
                          center={[base.lat, base.lng]}
                          radius={18000}
                          pathOptions={{
                            color: '#06B6D4',
                            fillColor: '#06B6D4',
                            fillOpacity: 0.40,
                            weight: 2.5,
                          }}
                          eventHandlers={{
                            click: (e) => {
                              L.DomEvent.stopPropagation(e);
                              setSelectedEntity({ type: 'AIRBASE', data: base });
                            },
                          }}
                        />
                        {(!isDeclutterActive || isSelected) && (
                          <Marker
                            position={[base.lat + 0.30, base.lng]}
                            icon={createScenarioBannerIcon('MONSOON_DOWNPOUR', weather)}
                            eventHandlers={{
                              click: (e) => {
                                L.DomEvent.stopPropagation(e);
                                setSelectedEntity({ type: 'AIRBASE', data: base });
                              },
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* D. DENSE FOG: Translucent Silver Misty Veil */}
                    {scenario === 'DENSE_FOG' && (
                      <>
                        <Circle
                          center={[base.lat, base.lng]}
                          radius={28000}
                          pathOptions={{
                            color: '#CBD5E1',
                            fillColor: '#94A3B8',
                            fillOpacity: 0.50,
                            weight: 2.0,
                          }}
                          eventHandlers={{
                            click: (e) => {
                              L.DomEvent.stopPropagation(e);
                              setSelectedEntity({ type: 'AIRBASE', data: base });
                            },
                          }}
                        />
                        {(!isDeclutterActive || isSelected) && (
                          <Marker
                            position={[base.lat + 0.24, base.lng]}
                            icon={createScenarioBannerIcon('DENSE_FOG', weather)}
                            eventHandlers={{
                              click: (e) => {
                                L.DomEvent.stopPropagation(e);
                                setSelectedEntity({ type: 'AIRBASE', data: base });
                              },
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* E. Verified Live Point-Based Hazard Perimeter (Non-Synthetic) */}
                    {!scenario && (hasSevereRisk || hasModerateRisk) && (
                      <Circle
                        center={[base.lat, base.lng]}
                        radius={hasSevereRisk ? 38000 : 24000}
                        pathOptions={{
                          color: hasSevereRisk ? '#EF4444' : '#F59E0B',
                          fillColor: hasSevereRisk ? '#EF4444' : '#F59E0B',
                          fillOpacity: hasSevereRisk ? 0.16 : 0.08,
                          weight: 1.5,
                          dashArray: '5, 5',
                        }}
                        eventHandlers={{
                          click: (e) => {
                            L.DomEvent.stopPropagation(e);
                            setSelectedEntity({ type: 'AIRBASE', data: base });
                          },
                        }}
                      />
                    )}
                  </>
                )}

                {/* 2. Dedicated Downstream Wind Vector Marker - suppressed during sortie focus unless selected */}
                {showWeatherOverlay && showWindLayer && weather?.current && (!isDeclutterActive || isSelected) && (
                  <Marker
                    position={[base.lat - 0.14, base.lng]}
                    icon={createWindVectorMarkerIcon(weather)!}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        setSelectedEntity({ type: 'AIRBASE', data: base });
                      },
                    }}
                  />
                )}

                {/* 3. Primary Airbase Infrastructure Marker */}
                <Marker
                  position={[base.lat, base.lng]}
                  icon={createAirbaseIcon(base, isSelected, weather, weatherMode, showWeatherOverlay, isDeclutterActive)}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedEntity((prev) =>
                        prev?.type === 'AIRBASE' && prev.data.id === base.id
                          ? null
                          : { type: 'AIRBASE', data: base }
                      );
                    },
                  }}
                />
              </React.Fragment>
            );
          })}

        {/* ------------------------------------------------------------------- */}
        {/* Layer 3: MISSION TARGETS                                            */}
        {/* ------------------------------------------------------------------- */}
        {showTargets &&
          targets.map((tgt) => {
            const isSelected = selectedTargetId === tgt.target_id;
            const isSortieObjective = activeTargetIds.has(tgt.target_id);
            const isCompact = isDeclutterActive && !isSortieObjective && !isSelected;

            return (
              <Marker
                key={tgt.target_id}
                position={[tgt.location.lat, tgt.location.lng]}
                icon={createTargetIcon(tgt, isSelected, isCompact, isSortieObjective)}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    onSelectTarget(tgt.target_id);
                    setSelectedEntity({ type: 'TARGET', data: tgt });
                  },
                }}
              />
            );
          })}

        {/* ------------------------------------------------------------------- */}
        {/* Layer 4: PLANNED FLIGHT ROUTE (Preview before deployment)           */}
        {/* ------------------------------------------------------------------- */}
        {showRoutes && selectedPackage && (
          <>
            <Polyline
              positions={selectedPackage.route.waypoints.map((w) => [w.lat, w.lng])}
              pathOptions={{
                color: '#38BDF8',
                weight: 8,
                opacity: 0.28,
              }}
            />
            <Polyline
              positions={selectedPackage.route.waypoints.map((w) => [w.lat, w.lng])}
              pathOptions={{
                color: '#38BDF8',
                weight: 4,
                opacity: 0.95,
                dashArray: '10, 6',
              }}
            />
          </>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* Layer 5: ACTIVE SORTIES & EVASIVE DETOURS                           */}
        {/* ------------------------------------------------------------------- */}
        {showRoutes &&
          activeMissions.map((msn) => {
            const isRerouted = msn.status === 'REROUTED';
            const routeColor = isRerouted ? '#F59E0B' : '#06B6D4';
            const positions = msn.route.waypoints.map((w) => [w.lat, w.lng] as [number, number]);

            let currentLat = msn.airbase.lat;
            let currentLng = msn.airbase.lng;
            if (positions.length >= 2) {
              const segCount = positions.length - 1;
              const scaledProgress = animProgress * segCount;
              const segIdx = Math.min(Math.floor(scaledProgress), segCount - 1);
              const segFrac = scaledProgress - segIdx;
              const p1 = positions[segIdx];
              const p2 = positions[segIdx + 1];
              currentLat = p1[0] + (p2[0] - p1[0]) * segFrac;
              currentLng = p1[1] + (p2[1] - p1[1]) * segFrac;
            }

            return (
              <React.Fragment key={msn.mission_id}>
                {/* Glowing flight corridor underlay for high-contrast visibility */}
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color: routeColor,
                    weight: 10,
                    opacity: 0.3,
                  }}
                />
                <Polyline
                  positions={positions}
                  className={isRerouted ? 'animated-flight-line-reroute' : 'animated-flight-line'}
                  pathOptions={{
                    color: routeColor,
                    weight: 4.5,
                    opacity: 0.98,
                  }}
                />

                {/* Detour node markers — sleek tactical evasive waypoints */}
                {isRerouted &&
                  msn.route.waypoints
                    .filter((w) => w.action === 'DETOUR')
                    .map((w, di) => (
                      <Marker
                        key={`detour-${msn.mission_id}-${di}`}
                        position={[w.lat, w.lng]}
                        icon={createWaypointIcon(di, w.lat, w.lng)}
                      />
                    ))}

                <Marker
                  position={[currentLat, currentLng]}
                  icon={createAircraftIcon(
                    msn.aircraft.callsign,
                    isRerouted,
                    msn.aircraft.asset_type
                  )}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedEntity((prev) =>
                        prev?.type === 'MISSION' && prev.data.mission_id === msn.mission_id
                          ? null
                          : { type: 'MISSION', data: msn }
                      );
                    },
                  }}
                />
              </React.Fragment>
            );
          })}
      </MapContainer>

      {/* ----------------------------------------------------------------------- */}
      {/* 2. Top-Left: Collapsible Map Legend (Permanent & Accessible)            */}
      {/* ----------------------------------------------------------------------- */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2 pointer-events-auto">
        <div className="glass-panel rounded-xl text-[11px] font-mono text-slate-300 border border-sky-400/35 shadow-2xl overflow-hidden transition-all duration-300 w-[220px]">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full p-2.5 bg-slate-950/85 hover:bg-slate-900/90 cursor-pointer flex items-center justify-between border-b border-sky-500/20 transition-colors"
            title="Toggle Tactical Map Legend"
          >
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-sky-400 text-[10px]">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Map Legend</span>
            </div>
            <span className="text-[9px] text-slate-400 font-sans px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
              {showLegend ? 'Hide ▲' : 'Show ▼'}
            </span>
          </button>

          {showLegend && (
            <div className="p-3 space-y-2 bg-slate-950/90 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
                <span>Operational Airbase</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]"></span>
                <span>Runway Locked Out</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-red-500 bg-red-500/20 rounded"></span>
                <span>SAM Threat Corridor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-amber-400 transform rotate-45"></span>
                <span>Mission Target (P1-P5)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-1 bg-cyan-400 rounded"></div>
                <span>Active Sortie Path</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-1 bg-amber-400 rounded border-t border-dashed"></div>
                <span>Evasive Detour Path</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="text-[9px] font-bold text-sky-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Environmental Risk</span>
                  <span className="text-[8px] text-slate-500 font-normal">Open-Meteo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></span>
                  <span>Low Risk (&lt;35 km/h, Nominal)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]"></span>
                  <span>Moderate Concern (&ge;35 km/h / Rain)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_#ef4444]"></span>
                  <span>Severe Hazard (&ge;55 km/h / Squall)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]"></span>
                  <span>Synthetic Simulation Region</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-300">
                  <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  <span>Wind Vector (Downstream Travel)</span>
                </div>
                <div className="text-[8px] text-slate-400 italic pt-1 leading-tight border-t border-slate-800/60">
                  Convention: Source gives origin (FROM). Vectors point to destination (dir + 180)°.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tile Error Fallback Notice */}
        {tileError && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-mono flex items-center justify-between">
            <span>Satellite tile warning: Network fallback enabled.</span>
            <button
              onClick={() => {
                setTileStyle('dark');
                setTileError(false);
              }}
              className="text-[10px] underline ml-2 text-amber-400 hover:text-white"
            >
              Switch to Dark Mode
            </button>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* 3. Top Toolbar: Satellite Canvas & Controls (Beside Legend)             */}
      {/* ----------------------------------------------------------------------- */}
      <div className="absolute top-4 left-[248px] z-[400] flex items-center gap-2 pointer-events-auto">
        {/* Compact Style Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTileMenu(!showTileMenu)}
            className="glass-panel px-3 py-1.5 rounded-xl border border-sky-400/35 text-sky-200 hover:border-sky-300 flex items-center gap-1.5 font-bold shadow-xl text-xs cursor-pointer transition-all"
            title="Switch Map Visual Canvas"
          >
            <Satellite className="w-3.5 h-3.5 text-sky-400" />
            <span className="capitalize">{tileStyle}</span>
            <ChevronDown className="w-3 h-3 text-sky-400 opacity-70" />
          </button>

          {showTileMenu && (
            <div className="absolute left-0 mt-2 w-48 glass-panel p-1.5 rounded-xl border border-sky-400/40 shadow-2xl z-50 text-xs font-mono space-y-1 bg-slate-950/95 animate-in fade-in duration-150">
              <button
                onClick={() => { setTileStyle('satellite'); setShowTileMenu(false); }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 font-bold cursor-pointer transition-all ${
                  tileStyle === 'satellite' ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Satellite className="w-3.5 h-3.5 text-sky-400" />
                <span>Satellite (Esri)</span>
              </button>
              <button
                onClick={() => { setTileStyle('hybrid'); setShowTileMenu(false); }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 font-bold cursor-pointer transition-all ${
                  tileStyle === 'hybrid' ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Hybrid Satellite</span>
              </button>
              <button
                onClick={() => { setTileStyle('dark'); setShowTileMenu(false); }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 font-bold cursor-pointer transition-all ${
                  tileStyle === 'dark' ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                <span>Tactical Dark Canvas</span>
              </button>
              <button
                onClick={() => { setTileStyle('osm'); setShowTileMenu(false); }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 font-bold cursor-pointer transition-all ${
                  tileStyle === 'osm' ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>OSM Vector Map</span>
              </button>
            </div>
          )}
        </div>

        {/* Zoom & Reset Controls */}
        <div className="glass-panel p-1 rounded-xl border border-sky-400/35 shadow-2xl flex items-center gap-0.5 text-slate-300">
          <button
            onClick={() => setZoomStep((prev) => ({ type: 'in', id: (prev?.id || 0) + 1 }))}
            className="p-1.5 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomStep((prev) => ({ type: 'out', id: (prev?.id || 0) + 1 }))}
            className="p-1.5 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTriggerReset((c) => c + 1)}
            className="p-1.5 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors cursor-pointer"
            title="Reset Theatre View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Layers Filter Toggle Button */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className={`glass-panel p-2 rounded-xl border transition-all cursor-pointer shadow-2xl flex items-center gap-1.5 ${
              showLayerMenu
                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200'
                : 'border-cyan-500/30 text-cyan-400 hover:text-white'
            }`}
            title="Map Layer Filters"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Layer Filter Dropdown Panel */}
          {showLayerMenu && (
            <div className="absolute right-0 mt-2 w-56 glass-panel p-3 rounded-xl border border-cyan-500/40 shadow-2xl z-50 text-xs font-mono space-y-2 text-slate-200">
              <div className="font-bold text-cyan-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>TACTICAL LAYERS</span>
                <span className="text-[10px] text-slate-500">Toggle</span>
              </div>
              <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  Airbases
                </span>
                <input
                  type="checkbox"
                  checked={showAirbases}
                  onChange={(e) => setShowAirbases(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  SAM / Threat Zones
                </span>
                <input
                  type="checkbox"
                  checked={showThreats}
                  onChange={(e) => setShowThreats(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-400 transform rotate-45"></span>
                  Mission Targets
                </span>
                <input
                  type="checkbox"
                  checked={showTargets}
                  onChange={(e) => setShowTargets(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-cyan-400"></span>
                  Sorties & Detours
                </span>
                <input
                  type="checkbox"
                  checked={showRoutes}
                  onChange={(e) => setShowRoutes(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-0.5 border-t border-dashed border-sky-400"></span>
                  Borders (Natural Earth)
                </span>
                <input
                  type="checkbox"
                  checked={showBoundaries}
                  onChange={(e) => setShowBoundaries(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Weather Overlay & Atmospheric Filters */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200">
                  <span className="flex items-center gap-2 font-bold text-sky-300">
                    <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                    Weather Overlay
                  </span>
                  <input
                    type="checkbox"
                    checked={showWeatherOverlay}
                    onChange={(e) => setShowWeatherOverlay(e.target.checked)}
                    className="rounded border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                {showWeatherOverlay && (
                  <div className="space-y-1.5 pl-2 pt-1 border-l-2 border-sky-500/40">
                    <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200 text-[10px] text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Wind className="w-3 h-3 text-emerald-400" />
                        Wind Vector Arrows
                      </span>
                      <input
                        type="checkbox"
                        checked={showWindLayer}
                        onChange={(e) => setShowWindLayer(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer hover:text-cyan-200 text-[10px] text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <CloudLightning className="w-3 h-3 text-purple-400" />
                        Hazard Regions
                      </span>
                      <input
                        type="checkbox"
                        checked={showHazardRegions}
                        onChange={(e) => setShowHazardRegions(e.target.checked)}
                        className="rounded border-slate-700 text-purple-500 focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <div className="text-[9px] text-slate-400 pt-1 font-semibold flex items-center justify-between">
                      <span>Marker Mode:</span>
                      <span className="text-cyan-400 font-bold">{weatherMode}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(['SUMMARY', 'WIND', 'PRECIP', 'ALERTS'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setWeatherMode(m)}
                          className={`px-1.5 py-1 rounded text-[9px] font-bold transition-all cursor-pointer ${
                            weatherMode === m
                              ? 'bg-sky-500/30 text-sky-200 border border-sky-400 shadow-sm'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {/* Live vs Synthetic Theatre State Indicator */}
                    <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px]">
                      <span className="text-slate-400">Data Source:</span>
                      {theatreWeather.some((w) => w.is_synthetic) ? (
                        <span className="text-purple-300 font-bold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/60 shadow-sm">
                          [SYNTHETIC SIM]
                        </span>
                      ) : (
                        <span className="text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 shadow-sm">
                          [LIVE METEO]
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sortie Focus Declutter Mode Button */}
        <button
          onClick={() => setSortieFocusMode((prev) => !prev)}
          className={`glass-panel px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold shadow-xl text-xs cursor-pointer transition-all ${
            sortieFocusMode
              ? 'border-sky-400 bg-sky-500/25 text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
              : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
          title="Sortie Focus: Automatically clears corridor clutter while sorties are active"
        >
          <Crosshair className={`w-3.5 h-3.5 ${sortieFocusMode ? 'text-sky-300' : 'text-slate-500'}`} />
          <span className="hidden sm:inline font-mono text-[11px]">
            {sortieFocusMode ? 'SORTIE FOCUS: ON' : 'SORTIE FOCUS: OFF'}
          </span>
          {hasOngoingSortie && sortieFocusMode && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" title="Declutter Active" />
          )}
        </button>
      </div>

      {/* Dynamic Active Sortie Focus Banner */}
      {isDeclutterActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[390] pointer-events-none">
          <div className="glass-panel px-4 py-1.5 rounded-full border border-sky-400/50 bg-slate-950/90 shadow-[0_4px_25px_rgba(0,0,0,0.8)] flex items-center gap-2.5 text-[10px] font-mono text-sky-200 uppercase tracking-wider backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span className="font-bold text-sky-300">Active Sortie Focus</span>
            <span className="text-slate-400 hidden md:inline">• Secondary Corridor Telemetry Minimized</span>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* 5. Map Side Information Panel (Collapsible Tactical Drawer)             */}
      {/* ----------------------------------------------------------------------- */}
      {selectedEntity && (
        <div className="absolute top-16 left-[248px] z-[450] w-80 glass-panel rounded-xl border border-sky-400/40 shadow-2xl p-4 text-xs font-mono text-slate-200 pointer-events-auto max-h-[calc(100vh-160px)] overflow-y-auto space-y-3 animate-in fade-in slide-in-from-left-2 duration-150">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1">
                <Radio className="w-3 h-3 text-cyan-400" />
                <span>
                  {selectedEntity.type === 'AIRBASE' && 'AIRBASE INFRASTRUCTURE'}
                  {selectedEntity.type === 'TARGET' && 'STRATEGIC TARGET'}
                  {selectedEntity.type === 'THREAT' && 'HOSTILE RADAR / THREAT'}
                  {selectedEntity.type === 'MISSION' && 'AIRBORNE SORTIE'}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white mt-0.5">
                {selectedEntity.type === 'AIRBASE' && selectedEntity.data.name}
                {selectedEntity.type === 'TARGET' && selectedEntity.data.name}
                {selectedEntity.type === 'THREAT' && selectedEntity.data.name}
                {selectedEntity.type === 'MISSION' && selectedEntity.data.aircraft.callsign}
              </h3>
            </div>
            <button
              onClick={() => {
                setSelectedEntity(null);
              }}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Airbase Details */}
          {selectedEntity.type === 'AIRBASE' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Runway Status:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    selectedEntity.data.runway_status === 'OPERATIONAL'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40'
                      : 'bg-rose-950 text-rose-400 border border-rose-600/40'
                  }`}
                >
                  {selectedEntity.data.runway_status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Coordinates:</span>
                <span className="text-slate-200">
                  {selectedEntity.data.lat.toFixed(3)}°N, {selectedEntity.data.lng.toFixed(3)}°E
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Jet A-1 Fuel:</span>
                <span className="text-amber-300 font-bold">
                  {(selectedEntity.data.available_fuel_liters / 1000).toFixed(0)}k Liters
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Armory Weapon Inventory:</span>
                <div className="flex flex-wrap gap-1">
                  {(selectedEntity.data.stored_weapons || []).map((w, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-cyan-300 font-mono"
                    >
                      {w.quantity}x {w.weapon_id.replace('WEP_', '')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Weather Telemetry & Synthetic Simulation Controls */}
              {(() => {
                const weather = theatreWeather.find((w) => w.airbase_id === selectedEntity.data.id);
                if (!weather?.current) return null;
                const risk = weather.risk_assessment?.overall_risk || 'LOW';
                const scenario = detectWeatherScenario(weather);
                const downstream = getDownstreamHeading(weather.current.wind_direction_deg);
                const cardinal = getWindCardinal(weather.current.wind_direction_deg);

                // Extract live baseline if currently synthetic
                const liveData = weather.is_synthetic && weather.live_backup
                  ? (weather.live_backup.current || weather.live_backup)
                  : null;

                return (
                  <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
                    {/* Header: Source & Status Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                        <span className="font-bold text-[10px] text-sky-300">
                          {weather.is_synthetic ? 'Synthetic Simulation' : 'Live Atmospheric Telemetry'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {weather.is_synthetic ? (
                          <span className="px-1.5 py-0.5 rounded font-extrabold text-[8.5px] bg-purple-950 text-purple-300 border border-purple-500/60 shadow-sm animate-pulse">
                            [SYNTHETIC]
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded font-bold text-[8.5px] bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-sm">
                            [LIVE OPEN-METEO]
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[8.5px] ${
                            risk === 'HIGH'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_8px_#ef444450]'
                              : risk === 'MODERATE'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {risk} RISK
                        </span>
                      </div>
                    </div>

                    {/* Timestamp & Provider Attribution */}
                    <div className="text-[9px] text-slate-400 flex items-center justify-between">
                      <span>Source: {weather.data_source}</span>
                      <span>Synced: {new Date(weather.observation_time || weather.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* 6-Grid Core Weather Telemetry */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-900/80 p-2 rounded-lg border border-slate-800 shadow-inner">
                      <div>
                        <span className="text-slate-500 text-[8.5px] block">TEMPERATURE</span>
                        <span className="text-white font-bold">{weather.current.temperature_c.toFixed(1)}°C</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[8.5px] block">WIND & GUSTS</span>
                        <span className="text-white font-bold">
                          {weather.current.wind_speed_kmh.toFixed(0)} ({weather.current.wind_gusts_kmh.toFixed(0)}) km/h
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[8.5px] block">WIND DIRECTION</span>
                        <span className="text-cyan-300 font-bold flex items-center gap-1">
                          <svg style={{ transform: `rotate(${downstream}deg)` }} className="w-2.5 h-2.5 text-cyan-400 shrink-0 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                          <span>{weather.current.wind_direction_deg.toFixed(0)}° {cardinal} (→{downstream.toFixed(0)}°)</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[8.5px] block">PRECIPITATION / RAIN</span>
                        <span className="text-white font-bold">{weather.current.rain_mm.toFixed(1)} mm/h</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[8.5px] block">VISIBILITY / RVR</span>
                        <span className="text-white font-bold">
                          {weather.current.visibility_m !== null && weather.current.visibility_m !== undefined
                            ? weather.current.visibility_m < 1000
                              ? `${weather.current.visibility_m.toFixed(0)} m`
                              : `${(weather.current.visibility_m / 1000).toFixed(1)} km`
                            : 'Unavailable'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[8.5px] block">CLOUD / PRESSURE</span>
                        <span className="text-white font-bold">
                          {weather.current.cloud_cover_pct.toFixed(0)}% • {weather.current.pressure_hpa.toFixed(0)} hPa
                        </span>
                      </div>
                    </div>

                    {/* Contributing Risk Factors */}
                    {weather.risk_assessment?.contributing_factors?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-400 font-bold block">Environmental Constraints:</span>
                        {weather.risk_assessment.contributing_factors.slice(0, 2).map((factor, idx) => (
                          <div
                            key={idx}
                            className={`text-[9px] p-1.5 rounded border ${
                              factor.severity === 'HIGH'
                                ? 'bg-red-950/40 text-red-200 border-red-500/40'
                                : 'bg-amber-950/40 text-amber-200 border-amber-500/40'
                            }`}
                          >
                            <strong className="block text-[9.5px]">{factor.factor} ({factor.measured_value})</strong>
                            <span className="text-slate-300 text-[8.5px]">{factor.explanation}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Synthetic Hazard Delta Comparison Table & 1-Click Reset */}
                    {weather.is_synthetic && (
                      <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/50 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9.5px] font-extrabold text-purple-300 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-purple-400" />
                            <span>Active Synthetic Hazard: {scenario || 'Custom Simulation'}</span>
                          </span>
                        </div>

                        {/* Side-by-side Delta Comparison Table */}
                        {liveData && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[8.5px] text-left border-collapse">
                              <thead>
                                <tr className="border-b border-purple-500/30 text-purple-200">
                                  <th className="py-1">Metric</th>
                                  <th className="py-1">Live Baseline</th>
                                  <th className="py-1">Synthetic</th>
                                  <th className="py-1">Delta</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-purple-500/20 text-slate-300">
                                <tr>
                                  <td className="py-0.5 text-slate-400">Wind Speed</td>
                                  <td>{liveData.wind_speed_kmh?.toFixed(0) || '0'} km/h</td>
                                  <td className="text-purple-300 font-bold">{weather.current.wind_speed_kmh.toFixed(0)} km/h</td>
                                  <td className="text-amber-300 font-bold">
                                    +{(weather.current.wind_speed_kmh - (liveData.wind_speed_kmh || 0)).toFixed(0)} km/h
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-0.5 text-slate-400">Wind Gusts</td>
                                  <td>{liveData.wind_gusts_kmh?.toFixed(0) || '0'} km/h</td>
                                  <td className="text-purple-300 font-bold">{weather.current.wind_gusts_kmh.toFixed(0)} km/h</td>
                                  <td className="text-amber-300 font-bold">
                                    +{(weather.current.wind_gusts_kmh - (liveData.wind_gusts_kmh || 0)).toFixed(0)} km/h
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-0.5 text-slate-400">Precipitation</td>
                                  <td>{liveData.rain_mm?.toFixed(1) || '0.0'} mm</td>
                                  <td className="text-cyan-300 font-bold">{weather.current.rain_mm.toFixed(1)} mm</td>
                                  <td className="text-cyan-300 font-bold">
                                    +{(weather.current.rain_mm - (liveData.rain_mm || 0)).toFixed(1)} mm
                                  </td>
                                </tr>
                                {weather.current.visibility_m && (
                                  <tr>
                                    <td className="py-0.5 text-slate-400">Visibility</td>
                                    <td>{liveData.visibility_m ? `${liveData.visibility_m.toFixed(0)}m` : '>10km'}</td>
                                    <td className="text-rose-300 font-bold">{weather.current.visibility_m.toFixed(0)}m</td>
                                    <td className="text-rose-300 font-bold">
                                      {liveData.visibility_m ? `${(weather.current.visibility_m - liveData.visibility_m).toFixed(0)}m` : 'Degraded'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* 1-Click Action to Reset Weather */}
                        <button
                          onClick={() => handleResetWeatherForAirbase(selectedEntity.data.id)}
                          disabled={isResettingAirbaseWeather}
                          className="w-full py-1.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-sky-700 hover:from-purple-600 hover:to-sky-600 text-white font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[9.5px] shadow-lg disabled:opacity-50"
                          title="Clear synthetic overrides and restore verified live Open-Meteo observations"
                        >
                          <RotateCcw className={`w-3 h-3 ${isResettingAirbaseWeather ? 'animate-spin' : ''}`} />
                          <span>{isResettingAirbaseWeather ? 'RESTORING LIVE WEATHER...' : 'RESET WEATHER TO LIVE (OPEN-METEO)'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Target Details */}
          {selectedEntity.type === 'TARGET' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Priority Level:</span>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  PRIORITY {selectedEntity.data.priority_level}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Target Type:</span>
                <span className="text-white font-semibold">{selectedEntity.data.target_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Required Munition:</span>
                <span className="text-cyan-300 font-semibold">
                  {selectedEntity.data.required_weapon_category}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Engagement Window:</span>
                <span className="text-amber-300">{selectedEntity.data.time_window_mins} mins</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Coordinates:</span>
                <span className="text-slate-200">
                  {selectedEntity.data.location.lat.toFixed(3)}°N,{' '}
                  {selectedEntity.data.location.lng.toFixed(3)}°E
                </span>
              </div>
              <button
                onClick={() => onSelectTarget(selectedEntity.data.target_id)}
                className="w-full mt-2 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>LOAD INTO MISSION PLANNER</span>
              </button>
            </div>
          )}

          {/* Threat Details */}
          {selectedEntity.type === 'THREAT' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Threat Severity:</span>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-red-950 text-red-300 border border-red-700">
                  SEVERITY {selectedEntity.data.threat_severity} / 5
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Category:</span>
                <span className="text-white font-semibold">{selectedEntity.data.type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Radar Radius:</span>
                <span className="text-amber-300 font-bold">{selectedEntity.data.effective_radius_km} km</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Countermeasure:</span>
                <span className="text-cyan-300">{selectedEntity.data.countermeasure_required}</span>
              </div>
              <div className="text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/30">
                Automatic evasion corridor is calculated when sorties intersect this threat bubble.
              </div>
            </div>
          )}

          {/* Mission Details */}
          {selectedEntity.type === 'MISSION' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Sortie Status:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    selectedEntity.data.status === 'REROUTED'
                      ? 'bg-amber-950 text-amber-300 border border-amber-600'
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-600'
                  }`}
                >
                  {selectedEntity.data.status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Aircraft Model:</span>
                <span className="text-white font-semibold">{selectedEntity.data.aircraft.model}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Pilot-in-Command:</span>
                <span className="text-emerald-300 font-semibold">{selectedEntity.data.pilot.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Departure Base:</span>
                <span className="text-slate-200">{selectedEntity.data.airbase.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">ETA / Total Distance:</span>
                <span className="text-amber-300 font-bold">
                  {selectedEntity.data.route.eta_mins} mins ({selectedEntity.data.route.distance_km} km)
                </span>
              </div>
              {selectedEntity.data.route.detour_notes && (
                <div className="text-[10px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/30">
                  {selectedEntity.data.route.detour_notes}
                </div>
              )}
            </div>
          )}

          {/* Data Quality / Verification Footer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span>Data Freshness: 100%</span>
            </span>
            <span>Real-time Telemetry</span>
          </div>
        </div>
      )}
    </div>
  );
};
