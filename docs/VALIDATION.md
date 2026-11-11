# Validation status — 0.1.0

## Completed locally

- 8 JavaScript tests: command routing, future-command rejection, explicit-statistic
  passthrough, two-location/native collection isolation, connection binding,
  current-state updates, per-location card customization and save invalidation.
- 15 Python tests: actual adapted schemas, manager storage/reload, distinct tariffs
  for a shared meter, creation attachment, unknown-ID rejection, rename identity,
  saved customizations, concurrent save serialization, registry listener cleanup,
  source/schema errors, namespaced power IDs, generated monetary sensor identity
  and values, unknown energy readings and mixed-unit power conversion.
- Browser boundary smoke: location A -> Configure -> nested dialog -> save;
  location B and the native configuration remain untouched. Switch locations and
  create a third location. Native components are deliberate test doubles here.
- Python syntax compilation and JavaScript syntax checks.
- Source snapshots and SHA-256 provenance captured in `upstream/core-sha256.json`.

The Python tests use minimal HA boundaries. The local machine has Python 3.12 and
no running Docker daemon. No complete Home Assistant 2026.11 process was started.

## Required real Home Assistant checks

Use the pinned development container or a test copy of the target installation.

1. Install, restart and add the integration. Confirm the sidebar appears and the
   native Energy dashboard still works.
2. Create Home A and Home B. Configure grid import/export, PV, battery, home meter,
   gas, water and devices using actual native dialogs. Exercise add/edit/remove.
3. Compare each native graph/table/gauge with an equivalent native Energy
   configuration on the test instance, using identical measurements and dates.
4. Open directly at a location URL in a fresh browser session. Verify lazy module
   loading, nested dialogs, settings tabs, native menu links and the sidebar.
5. Exercise Now, historical tabs, comparisons, date navigation, CSV export,
   diagnostics and per-location card visibility.
6. Exercise a 23-hour and 25-hour day in Europe/Lisbon; month/year boundaries and
   independent selections in two tabs. Compare with native results.
7. Test fixed and changing prices, exports, source resets, unit changes,
   unavailable readings and external statistics. Verify generated cost sensors
   are recorded and do not have registry collisions.
8. Restart HA and reload/unload/reload the integration. Confirm persisted settings,
   generated sensor restoration, listener cleanup and Recorder continuity.
9. Test forecast providers and carbon indicators with real configured integrations.
10. Confirm a non-administrator cannot access any extension endpoint.

## Acceptance criterion

Do not describe this release as complete native parity until each relevant row in
README's coverage table has been verified on the target frontend/Core versions.
Do not enable production billing or dispatch based solely on this preview.
