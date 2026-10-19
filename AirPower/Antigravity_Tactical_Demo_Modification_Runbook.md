# Antigravity Modification Runbook
## Existing Tactical Demo Website: 12 Changes, Implemented One at a Time

**Purpose:** Use this file as the master instruction for Antigravity to modify the existing website safely and incrementally.

## Master instruction for Antigravity

You are modifying an **existing project**, not building a new website from scratch.

Before changing anything:
1. Inspect the repository, identify the frontend framework, routing, state management, data models, map library, and current tactical-demo flows.
2. Run the project using its existing documented commands, if possible.
3. Locate the components and logic related to the map, aircraft/engine faults, composite cost, warnings, dashboards, active missions, airbases, helicopters, event panels, SAM deployment, and runway locking.
4. Summarize the current implementation and identify the files likely to change.
5. Do not replace the current stack, redesign unrelated pages, remove existing functionality, or rewrite large parts of the project without a clear need.
6. Preserve existing styles and conventions where possible, while improving usability and visual quality.
7. Do not invent real operational data. If the project uses mock/demo data, continue to label it as demo data.
8. Never hardcode secrets. Do not change environment files or credentials unless necessary and explicitly explained.
9. If a requirement is ambiguous or a required decision cannot be inferred from the code, ask me a concise question before implementing that item. Otherwise, make a sensible, reversible implementation decision and document it.
10. Implement the modifications in the exact order below, **one modification at a time**. Do not bundle several numbered modifications into one change.

### Required execution protocol

For each modification:
1. Explain briefly what you found in the existing implementation and what you intend to change.
2. Implement **only that numbered modification**.
3. Run the relevant checks/tests and launch/build the app if feasible.
4. Manually inspect the affected flow at desktop and mobile sizes where relevant.
5. Fix regressions caused by that modification.
6. Report:
   - files changed;
   - what changed;
   - how to test it;
   - test/build result;
   - any known limitation.
7. Stop and wait for my approval before starting the next numbered modification.

Do not mark a feature complete merely because its UI was added. Connect it to the existing application state and data flow. If the project has no backend for a feature, implement a clearly labelled demo-state behavior and tell me what remains to connect.

### Global acceptance criteria
- Keep the existing app runnable after every step.
- No unrelated redesigns or feature removals.
- Reuse existing components and types where practical.
- Provide loading, empty, success, and error states for interactive flows.
- Use accessible labels, keyboard-friendly controls, readable contrast, and responsive layouts.
- Avoid blocking the map with large overlays.
- Do not fabricate successful operations: show success only after the corresponding action/state change succeeds.
- Add/update tests for changed logic when the project has a test setup.
- If a change requires a schema or API update, explain it before making a potentially destructive change and preserve compatibility where possible.

---

# Modification 1 of 12: Map territorial boundaries and neighboring countries

## Goal
Improve the map so users can understand the geographic context through clear territorial/country boundaries and neighboring-country labels, without cluttering the map.

## Instructions
1. Inspect the current map provider/library and the source of its map layers.
2. Use a reliable, compatible boundary layer or the existing provider's country-boundary features. Prefer an established geographic source already used by the project.
3. Display country/territorial boundaries at useful zoom levels, with neighboring-country names legible at the appropriate zoom.
4. Make boundaries visually distinct from mission routes, aircraft markers, airbases, and other tactical-demo overlays.
5. Keep the selected map style and current interaction behavior intact.
6. Ensure boundary layers do not intercept clicks intended for aircraft, airbases, routes, or other map objects.
7. If the current map provider cannot legally or technically provide these boundaries, do not silently switch providers. Explain the limitation and ask me before changing providers.
8. Do not imply disputed boundaries are universally settled. If relevant to the current map region, use the provider's established depiction and attribution.

## Acceptance checks
- Country boundaries are visible and geographically aligned.
- Neighboring-country labels appear at useful zoom levels.
- Existing map markers and routes remain clickable.
- Map performance remains acceptable.
- Map attribution/licensing requirements are preserved.

Stop after this modification and wait for my approval.

---

# Modification 2 of 12: Update aircraft identity after an engine-fault replacement

## Goal
When an engine-fault scenario causes an aircraft to be replaced, all relevant UI areas should show the replacement aircraft's correct identity rather than continuing to display the original aircraft as if it were still assigned.

## Instructions
1. Trace the existing engine-fault selection and aircraft-replacement flow.
2. Identify the source of truth for aircraft identity and mission assignment.
3. When the replacement action succeeds, update the assigned aircraft identifier/name and any associated model/type fields that actually change.
4. Update all dependent views, including the selected aircraft details, active mission summary, tactical event panel, and aircraft list.
5. Preserve mission information that should carry over, but do not carry over aircraft-specific state that should reset. Follow existing domain logic; if the intended behavior is unclear, ask me.
6. Prevent duplicate assignment of the same replacement aircraft to incompatible active missions if the app models availability.
7. Display a clear replacement confirmation, including the old and new aircraft identities, without implying that a replacement occurred before the state update succeeds.
8. Handle the case where no eligible replacement aircraft is available with a clear message and no inconsistent state.

## Acceptance checks
- Selecting the engine-fault scenario and completing replacement updates the aircraft identity everywhere relevant.
- The old identity is not left in stale UI elements.
- Failure/no-replacement cases are handled clearly.
- Existing mission state remains consistent.

Stop after this modification and wait for my approval.

---

# Modification 3 of 12: Explain the composite cost

## Goal
Where the UI displays a composite cost/score, show the contributing factors and a human-readable explanation of why the result has that value.

## Instructions
1. Find the existing composite-cost calculation and identify its actual input factors, weights, units, and formula.
2. Do not invent or change the formula or weights as part of this UI modification.
3. Add a “Why this cost?” or “Cost breakdown” disclosure beside the composite value.
4. Show the actual contributing factors, their values/weights when available, and how they contribute to the displayed total.
5. Include a concise plain-language explanation of the main drivers.
6. If the project cannot currently expose the formula or component values, tell me what is missing. Do not fabricate a breakdown; provide a clearly labelled explanation of the currently available inputs and ask before changing the calculation.
7. Ensure the breakdown works in the relevant mission/event view and does not dominate the layout.

## Acceptance checks
- Composite cost remains numerically unchanged.
- The user can open and close the breakdown.
- The displayed explanation matches the actual implemented calculation.
- Missing inputs are identified honestly.

Stop after this modification and wait for my approval.

---

# Modification 4 of 12: Make tactical-demo warnings non-obstructive

## Goal
Warnings should be noticeable and understandable without covering important map content or blocking map interaction.

## Instructions
1. Find how tactical-demo warnings are currently rendered.
2. Replace large blocking overlays with a compact, consistently positioned notification/toast or a small collapsible warning panel, choosing the pattern that best fits the existing design.
3. Use clear severity levels if the application already distinguishes severity.
4. Include a short message, optional detail, timestamp if available, and a dismiss/expand control where appropriate.
5. Keep critical warnings visible until acknowledged if that behavior is already supported or required by existing logic. Do not silently auto-dismiss critical alerts.
6. Ensure the warning panel does not cover key map controls, mission markers, or the map's main viewing area.
7. On small screens, make the warning responsive and dismissible/expandable without hiding essential controls.
8. Avoid excessive animations and repeated duplicate notifications.

## Acceptance checks
- The map remains substantially visible while warnings are displayed.
- Warnings remain readable and accessible.
- Users can inspect details and dismiss non-critical warnings.
- Map interactions continue to work.

Stop after this modification and wait for my approval.

---

# Modification 5 of 12: Add a separate dashboard for aircraft, pilots, and airbases

## Goal
Create a dedicated dashboard page for viewing the current demo inventory and status of aircraft/jets, pilots, and airbases, rather than crowding the tactical map.

## Instructions
1. Inspect existing routes, data models, and navigation.
2. Add a dedicated dashboard route/page and a clear navigation entry.
3. Present separate sections or tabs for:
   - Aircraft/jets
   - Pilots
   - Airbases
4. Reuse existing data. Do not create a second disconnected source of truth.
5. Display only fields that exist in the app. Possible fields include identifier/name, type, availability/status, assignment, and associated airbase.
6. Add useful search/filter controls if the data volume supports them.
7. Add loading, empty, and error states if data is fetched asynchronously.
8. Clicking an item should open its existing detail view or a concise detail drawer/modal.
9. Use clearly labelled demo data if the project currently uses mock data.
10. Keep the dashboard visually consistent with the existing website and responsive.

## Acceptance checks
- Dashboard is reachable through navigation and direct URL.
- Aircraft, pilot, and airbase information comes from the same data source as the rest of the app.
- Empty and unavailable data are handled gracefully.
- The tactical map remains uncluttered.

Stop after this modification and wait for my approval.

---

# Modification 6 of 12: Improve Tactical Demo controls and visual design

## Goal
Make the Tactical Demo controls easier to understand, safer to operate, and visually polished.

## Instructions
1. Inspect the existing control panel and identify all current actions.
2. Group related actions into clear sections, for example mission management, aircraft/events, airbase/runway, and support/rescue. Use the project's actual features rather than inventing new operational capabilities.
3. Give every control a concise label and, where needed, a short tooltip/help description.
4. Use consistent button styles for primary, secondary, destructive, selected, disabled, and loading states.
5. Make selected states unmistakable.
6. Add confirmation for consequential or destructive actions where appropriate.
7. Prevent accidental double-submission while an action is processing.
8. Keep the map visible and usable. Use collapsible panels or responsive drawers if appropriate.
9. Improve spacing, alignment, typography, and responsive behavior while preserving the existing design language.
10. Do not change the underlying behavior of existing actions unless a bug must be fixed for the UI to work; document any such fix.

## Acceptance checks
- Controls are grouped and labelled clearly.
- Selected/disabled/loading states are visible.
- Controls work at desktop and mobile sizes.
- Existing actions still function.

Stop after this modification and wait for my approval.

---

# Modification 7 of 12: Active mission details and close-mission action

## Goal
Selecting an active mission should show its details clearly and provide an option to close/end that mission.

## Instructions
1. Trace how active missions are stored, selected, and displayed.
2. Make the Active Missions item/card/list row clickable, with a clear selected state.
3. On selection, show a details panel containing available information such as mission name/ID, status, assigned aircraft, start time, current stage, and related events. Do not fabricate fields that do not exist.
4. Include a clearly labelled “Close Mission” or “End Mission” action.
5. Ask for confirmation before closing a mission.
6. On confirmation, use the existing mission lifecycle/state logic. If no lifecycle logic exists, implement a consistent state transition only after explaining the proposed statuses and asking if the behavior is ambiguous.
7. Update all relevant mission lists, map overlays, and event panels after closure.
8. Preserve historical mission information if the app supports mission history; do not permanently delete the mission just to close it.
9. Handle errors and prevent a mission from appearing both active and closed.

## Acceptance checks
- Selecting a mission displays the correct details.
- Closing requires confirmation.
- A closed mission no longer appears as active.
- Related panels update consistently.
- Canceling confirmation leaves the mission unchanged.

Stop after this modification and wait for my approval.

---

# Modification 8 of 12: Show weapon inventory by airbase

## Goal
Display the existing demo inventory associated with each airbase in that airbase's details view.

## Instructions
1. Inspect the current airbase data model and any existing inventory/weapon records.
2. Add an “Inventory” or “Stored Equipment” section to the airbase detail page/panel.
3. If weapon inventory is already represented, display its existing demo fields, such as item/type, quantity, and status, according to the current data model.
4. Make it clear which airbase the inventory belongs to.
5. If no inventory data exists, do not invent real inventory or operational quantities. Ask me whether to add clearly labelled fictional demo records or leave the section in an informative empty state.
6. Keep access consistent with the existing role/permission model.
7. Avoid exposing sensitive real-world operational information; use only data already authorized for this application/demo.
8. Keep the inventory view read-only unless editing is already supported and authorized.

## Acceptance checks
- Selecting an airbase shows only the inventory associated with that airbase.
- Empty inventory is handled gracefully.
- No fabricated real-world inventory is presented as factual.
- Existing airbase functions continue to work.

Stop after this modification and wait for my approval.

---

# Modification 9 of 12: Add rescue and transport helicopter support to the UI

## Goal
Represent rescue/transport helicopters as a supported asset category in the existing demo, without breaking existing aircraft flows.

## Instructions
1. Inspect the existing aircraft/asset type model and assignment UI.
2. Determine whether helicopters can be represented by the existing asset model. Reuse it if possible; avoid creating a duplicate parallel system.
3. Add rescue/transport helicopter type/category labels and display fields only where the existing schema supports them.
4. Make helicopters visible in the relevant asset list/dashboard and selectable in the appropriate existing rescue/transport demo workflow.
5. If the app has mission assignment logic, connect the helicopter selection to that existing flow and display its assignment/status consistently.
6. If rescue/transport mission behavior does not exist, ask me which minimum demo behavior is intended before implementing a new workflow. Do not invent real-world dispatch rules or operational procedures.
7. Use clear demo labels where the asset records are fictional.
8. Ensure helicopters are visually distinguishable from other aircraft on the map and in lists, using accessible icons/labels rather than color alone.

## Acceptance checks
- Helicopters can be represented and viewed as a distinct asset type.
- Existing aircraft records and workflows are not broken.
- Any new assignment action updates the same shared state.
- Missing workflow requirements are raised before being invented.

Stop after this modification and wait for my approval.

---

# Modification 10 of 12: Separate event panels for concurrent missions

## Goal
When multiple missions are active simultaneously, users should be able to distinguish the events associated with each mission.

## Instructions
1. Inspect the current tactical event panel and determine how events are associated with missions.
2. Ensure each event has a mission association where the existing data model permits it.
3. Display a separate panel, tab, or clearly separated group for each active mission. Choose the least disruptive pattern for the current UI.
4. Show mission name/ID, status, and its associated events.
5. Selecting an event should focus the relevant mission or associated map object if that behavior already exists.
6. Keep events isolated: an event belonging to one mission must not appear under another mission.
7. When a mission closes, move its events to history or hide them from active panels according to existing lifecycle behavior.
8. Handle no-active-mission and many-active-mission states responsively. Avoid covering the map with a large stack of panels; use tabs, a collapsible sidebar, or a selector if needed.
9. Do not change the event logic itself unless necessary to correct a demonstrated association bug.

## Acceptance checks
- Two or more active missions can be distinguished.
- Each event appears under the correct mission.
- Switching between mission panels updates the visible information correctly.
- Closing one mission does not corrupt another mission's panel.

Stop after this modification and wait for my approval.

---

# Modification 11 of 12: Fix route visualization after the “Spawn SAM” demo action

## Goal
The current issue is that after clicking “Spawn SAM,” the displayed route appears unchanged. Investigate and correct the state/rendering behavior so the UI accurately reflects the outcome of the selected demo event.

## Instructions
1. Trace the “Spawn SAM” action from the control to the event handler, application state, route calculation/state, and map rendering.
2. Determine what the action is intended to change in this demo. Ask me if the expected route behavior cannot be inferred from existing code or labels.
3. Check for common software issues:
   - event handler not updating state;
   - route computed from stale state;
   - map layer not re-rendering;
   - route data not connected to the selected mission;
   - route state overwritten by another effect;
   - event applied to the wrong mission;
   - selected route and displayed route using different data.
4. Fix the underlying state/data-flow issue rather than merely changing the route's visual style.
5. If this is a purely illustrative demo and the action should trigger a visible route-state change, use a clearly labelled deterministic mock result rather than claiming to calculate a real-world route.
6. Do not add real-world weapon deployment logic or real operational route-planning logic. Keep the change confined to the application's existing simulated/demo behavior.
7. Add a visible event/status message explaining what changed in the demo.
8. Ensure the map redraws only the relevant route and preserves unrelated mission routes.

## Acceptance checks
- Triggering the action produces the intended, visible state change in the relevant demo mission.
- The map reflects the latest route state.
- Other missions' routes remain unchanged.
- The UI does not claim a real-world route or operational result.

Stop after this modification and wait for my approval.

---

# Modification 12 of 12: Let users select which runway to lock

## Goal
The current “Lock Runway” action should first let the user select the specific runway record to which the action applies.

## Instructions
1. Inspect the current runway data model and “Lock Runway” action.
2. If multiple runway records exist, show a selection control containing their real identifiers/names and current statuses.
3. If there is only one runway, still show the selected runway clearly before confirmation.
4. After selection, display the runway identity and current status in a confirmation dialog.
5. Require confirmation before applying the lock action.
6. Apply the state change only to the selected runway, not to every runway.
7. Update all related map markers, airbase details, dashboards, and status indicators from the same state source.
8. If runway records are not currently modeled, explain the minimal data-model change needed and ask me before adding records or inventing runway names.
9. Handle already-locked, unavailable, or invalid selections with clear feedback.
10. Keep the interaction within the existing demo/simulation; do not connect it to real operational infrastructure.

## Acceptance checks
- User can select the intended runway.
- Confirmation names the selected runway.
- Only that runway's demo state changes.
- Related views stay in sync.
- Canceling leaves all runway statuses unchanged.

Stop after this modification and wait for my approval.

---

# Final instruction

Begin with repository inspection only. Do not implement all twelve changes in one pass.

After inspection, start with **Modification 1 only**. Follow the execution protocol, test it, report the result, and wait for my approval. Once I approve, proceed to Modification 2, and continue in order through Modification 12.

If I ask to skip, reorder, or revise a modification, follow my latest instruction. Keep a short progress checklist in `docs/antigravity-modification-progress.md` and update it after each approved modification. Do not mark a modification complete until its acceptance checks pass.
