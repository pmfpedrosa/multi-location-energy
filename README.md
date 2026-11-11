# Multi-location Energy for Home Assistant

An initial custom integration targeting **Home Assistant 2026.11.x**. It provides an
**Energy Locations** sidebar panel with independent configurations for each home,
using the installed Home Assistant native Energy dashboard and setup components.

**Status: 0.1.0 development preview.** The location backend and isolation boundaries
have automated tests. It has **not yet been installed or validated end to end in
a running Home Assistant 2026.11 instance**. Full native feature parity is the
target, not a completed certification. See [validation status](docs/VALIDATION.md).

## What is implemented

- Create and rename locations; immutable generated IDs keep history stable.
- Independent native-format energy preferences and dashboard card visibility.
- Native dashboard and configuration UI reuse through an isolated connection.
- Native electricity, solar, battery, home meter, gas, water and individual-device
  configuration schemas, including power sensors and source relationships.
- Adapted native cost/compensation and power-transform sensor implementation.
  Each location has separate generated sensor IDs and cost lookups.
- Existing Recorder statistics are read directly; historical measurements are not
  copied or rewritten.
- Solar forecast provider lookup uses the native integration platform registry.
- Copy native energy preferences into an empty location, without writing the
  native Energy configuration.
- Administrator-only panel and API in this preview.

## Install the preview

Use a test instance first. The release archive contains `multi_location_energy/`.

1. Extract it into `/config/custom_components/`, resulting in
   `/config/custom_components/multi_location_energy/manifest.json`.
2. Restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration** and search for
   **Multi-location Energy**.
4. Submit the setup form. Open **Energy Locations** in the sidebar.
5. Select **Add location**, enter a name, and configure its energy sources using
   the native setup screens.
6. Add a second location and verify its measurements and prices independently.

No access token needs to be entered into the panel. It uses the current Home
Assistant administrator's authenticated session.

This folder is prepared for a future HACS/Marketplace custom repository, but no
repository has been published or submitted to a catalog.

## Design

The backend has its own domain, storage and manager for each location. It does not
replace or patch `homeassistant.components.energy`, mutate the native manager, or
modify the Recorder database directly.

Storage keys:

- `multi_location_energy.locations`: names and per-location card visibility.
- `multi_location_energy.<immutable-id>`: energy preferences for one location.

The panel creates a location-specific `hass` view and connection cache. Native
`energy/get_prefs`, `energy/save_prefs`, `energy/info`, `energy/validate`, and
`energy/solar_forecast` requests are routed to location-aware handlers. Requests
for explicit Recorder statistics and fossil-energy calculations use the native
APIs. Native dialogs are hosted inside the location panel so their settings saves
receive the same scoped connection.

`frontend/native-loader.js` uses the native router's lazy loaders. This is an
**internal frontend interface**, pinned to the inspected frontend release
`20261028.4`. The integration rejects other Home Assistant release series and
unknown native energy commands rather than silently falling back to global
energy settings. Updates within 2026.11 still need compatibility checks.

## Feature coverage

| Native function | Implementation | Validation |
|---|---|---|
| Per-source setup and validation | Native screens; adapted native schemas/validator | Schemas tested; real setup UI pending |
| Grid import/export and costs | Location-aware native manager and sensor algorithms | Shared-meter tariff isolation tested |
| Solar, battery and whole-home energy | Native schemas and native views | Real devices and chart parity pending |
| Power and Now view | Native view; namespaced transform sensors | Mixed W/kW and unavailable readings tested |
| Gas, water, device hierarchy | Native schemas, setup and views | Real measurements and hierarchy pending |
| Date selection and comparisons | Native collections, isolated per location | Scope isolation tested; DST/end-to-end pending |
| Forecasts and carbon indicators | Native providers/statistics APIs | Provider smoke test pending |
| Card visibility customization | Per-location frontend settings | Storage and subscription isolation tested |
| Native export/diagnostics | Native interface with scoped preferences | Actual generated files pending verification |

## Limits of the preview

- It is a monitoring/accounting extension, matching the native Energy scope. It
  does not add automatic battery dispatch or shared-PV allocation algorithms.
- All locations share Home Assistant's timezone, currency, unit system, Recorder
  configuration and device integrations.
- The native frontend's carbon-source selection is retained. Independently
  selecting carbon providers per geographical location is not implemented.
- Location deletion and per-resident permissions are not implemented. Rename is
  supported; energy history is retained.
- New cost sensors begin tracking when configured. Accurate historical variable
  tariffs cannot be reconstructed from today's price.
- Summing sites is not implemented. A shared upstream meter and its downstream
  submeters must not be blindly added together.
- Other native Energy cards elsewhere in your dashboards continue to use the
  native Energy configuration. Location support currently lives in this panel.

## Development

No JavaScript build dependencies are required:

```sh
npm run build
npm test
python -m pip install --target test_dependencies probatio
python tests/test_backend.py
```

The backend tests run the adapted manager, schemas and sensor algorithms against
small in-memory Home Assistant boundaries. They do not replace a real-HA test.
The browser boundary smoke test uses Playwright and explicit native-component
doubles:

```sh
npm install --no-save playwright
npx playwright install chromium
node tools/browser-smoke.mjs
```

The vendoring tool reproduces modifications to retained Core snapshots:

```sh
python tools/vendor_core.py
npm run build
```

See [architecture and API](docs/ARCHITECTURE.md), [validation](docs/VALIDATION.md),
and the [isolated development environment](dev/README.md).

Licensed under Apache-2.0. Home Assistant attribution and adapted sources are
listed in [NOTICE](NOTICE). This is an independent extension.
