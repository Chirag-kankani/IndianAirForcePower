# Antigravity Modification Progress

| # | Title | Status | Notes |
|---|-------|--------|-------|
| 1 | Map territorial boundaries and neighboring-country labels | ✅ DONE | Natural Earth 110m GeoJSON via GitHub CDN; `interactive:false`; faint cyan dashed outlines |
| 2 | Update aircraft identity after engine-fault replacement | ✅ DONE | Backend: commits replacement to state (new `ActiveMission`, aircraft AIRBORNE, pilot assigned). Frontend: `ReplacementCard` shows OLD→NEW swap |
| 3 | Explain the composite cost | ✅ DONE | `▼ Why this cost?` toggle on each package card; shows all 4 factors with weights, bar charts, formula, and plain-language explanation |
| 4 | Make tactical-demo warnings non-obstructive | ✅ DONE | Compact top-right tactical toast; severity tiers (SEV-1/2/3); expandable/collapsible details; non-blocking map view; persistent critical alerts |
| 5 | Separate dashboard for aircraft, pilots, airbases | ✅ DONE | Dedicated `Dashboard.tsx` with KPI overview cards, tabs for Aircraft / Pilots / Airbases, search/filters, modal drawers, and header route switcher (with direct `#dashboard` URL support) |
| 6 | Improve Tactical Demo controls and visual design | ✅ DONE | Grouped contingency actions with dual labels/subtitles, loading spinners to prevent double-submission, minimize dock toggle, and reset confirmation dialog |
| 7 | Active mission details and close-mission action | ✅ DONE | Backend `POST /api/missions/{id}/close` endpoint to recover assets to READY; Frontend Active Sorties tab, clickable mission selection, detailed tactical dossier, and confirmation modal |
| 8 | Show weapon inventory by airbase | ✅ DONE | Stored armory munitions on each airbase (`stored_weapons`), armory stock pills on airbase cards, dedicated Armory & Depot section in Airbase modal, and map popups |
| 9 | Rescue and transport helicopter support | ✅ DONE | Added `asset_type` to backend `Aircraft` model & synthetic fleet (`Mi-17V5 SAR`, `CH-47F Chinook`, `HAL Prachand LCH`). Added rotary filters, CSAR/Heavy Transport badges, mission capabilities dossier, and dynamic map helicopter icons |
| 10 | Separate event panels for concurrent missions | ⬜ PENDING | |
| 11 | Fix route visualization after Spawn SAM | ⬜ PENDING | |
| 12 | Let users select which runway to lock | ⬜ PENDING | |
