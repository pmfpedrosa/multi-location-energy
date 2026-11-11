# Unpublished generator dashboard test build

Version: 0.2.3-beta.1. This is not a published Marketplace update.

The native Energy panel is retained for both locations. For locations with
generators, isolated adaptations of the native cards and calculations add a
distinct generator source. Solar statistics and forecasts remain solar-only.
Generator electricity appears in distribution, consumption, source totals,
production charts, power charts, flow diagrams, device untracked consumption
and CSV output. Fuel and efficiency follow the native date selection and
comparison period. Fuel is not added again to native location gas totals.

Destination attribution is estimated per statistics bucket. Simultaneous solar
and generator production is allocated proportionally to battery charging,
export and consumption; aggregate meters cannot measure individual destinations.
Generator fuel is treated as fossil input in the low-carbon gauge.

## Verified locally

- Actual adapted native cards rendered with original HA chart controls.
- Frestia_1 fixture: import 0.67, export 0.11, generator 1 kWh; consumption 1.56 kWh.
- Frestia_2 fixture: import 0.66, export 0.11, PV 17.22, battery discharge 16 kWh;
  consumption 33.77 kWh; no generator series or node.
- Native distribution, source table, consumption/production charts, flow diagram
  and comparison datasets; native tabs, device views, gauges and date controls.
- Fuel example: 1 kWh / (0.25 m³ × 10 kWh/m³) = 40%; zero/missing input unavailable.
- 17 JavaScript tests, 16 backend boundary tests and syntax/JSON checks.

These are fixtures, not fresh readings from the running installation. The
shared-control test omits the generated icon catalogue and supplies HA context
and theme values; it is not a complete HA process.

## Required before stable publication

Install the test build, then verify the existing Frestia_1 with its simulated
generator and Frestia_2 without a generator. Preserve those configurations.
Check direct URL loading, Overview/Electricity/Now, date and comparison changes,
CSV downloads, chart interactions, narrow layout, generator configuration, and
the original Energy dashboard. Confirm no frontend errors. Check all values
against Recorder for the same period. Do not call simulated efficiency a real
generator measurement.

No live installation or restart has been performed for this build.

## Rebuilding the native adaptation

1. Check out home-assistant/frontend commit
   a67b691a451e0b3fc469679b07158f963a61842c into dist/frontend-native.
2. Copy upstream/frontend-package-lock.json into that checkout as package-lock.json.
3. In that checkout run npm ci --omit=dev --ignore-scripts --legacy-peer-deps.
4. In this repository run npm ci, npm run build:native, npm run build.
5. Run npm test, npm run test:native and the Python tests. The browser test needs
   Playwright (PLAYWRIGHT_MODULE can point to an existing installation).

The shipped native-energy.js is generated; edits belong in tools/build-native.mjs.
