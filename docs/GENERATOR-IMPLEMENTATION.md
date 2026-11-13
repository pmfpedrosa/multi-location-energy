# Generator extension — 0.4.0

Generators are stored as distinct `generator` entries in each location's
`energy_sources`. Each has an immutable id, name, cumulative electricity statistic
and optional power entity. Duplicate production meters within a location are
rejected, including the same meter configured as both solar and a generator.
Shared test meters across different locations remain permitted.

The separate Generators menu edits only generator entries and preserves the
latest native sources and devices. Concurrent generator edits are detected.
A clearly named simulated generator is configured in Frestia_1 using existing
meters. Frestia_2's source configuration is unchanged.

Generator locations use namespaced adaptations of the pinned HA Frontend cards
and strategies. Locations without generators continue to use installed native
cards. Custom Location Energy cards select the appropriate implementation.
The shared context identity fix and date-group isolation are retained.

## Coverage implemented

- Native distribution retains grid, solar, battery, SOC, gas, water and carbon
  presentation, with generator circles, connected branches and estimated flows.
- Historical and live Sankeys show individually named generators.
- Usage graph includes generator consumption; production graph shows individual
  generators; source totals include production and home consumption.
- Device/untracked consumption accounts for generator electricity.
- Power source graph, live legend and total badge include generator power.
- Self-sufficiency includes generator output. Solar metrics remain solar-specific.
  Carbon calculations conservatively count generator electricity as non-renewable.
- Source comparisons, dates and CSV output include generators.
- Native gas/water views, solar forecasts, grid balance and grid neutrality remain.
- Additional reusable types: `energy-generator-graph` and
  `energy-generator-contribution`.

Generator allocations to load, battery and export are estimates when only
production and grid meters exist. Simultaneous solar and generator production is
allocated proportionally in each statistics bucket. Multiple generators are also
split in each bucket, so generators operating at different times remain distinct.
Live cards require appropriate power sensors; cumulative meters alone cannot
provide instantaneous generation. Fuel use/cost and electrical efficiency are
not part of this electricity-only mockup implementation.

## Local validation

- 20 JavaScript tests: including mockup balance (18 import + 12 production − 3
  export = 27 consumption), mixed generation/battery allocation and generators
  running in different time buckets.
- 17 Python backend tests including generator validation and two-location
  persistence/isolation across reload.
- Real adapted native Lit cards with real chart controls render Frestia_1's
  simulated generator scenario and Frestia_2's solar/battery scenario.
  Distribution, source tables, usage/production series, both Sankeys, contribution
  gauge, kW/W conversion and comparison series are checked.
- Generated comprehensive dashboard configuration retains native electricity,
  gas, water and Now views, forecasts/solar cards, devices, grid gauges and
  comparisons.
- 1,000 generator-free flow cases match the unmodified native calculation.
- Existing historical Sankey stability, reusable card/date-group/editor and
  native panel boundary regressions pass. Generator setup save is also checked.

## Live acceptance, 13 November 2026

Installed development branches through Marketplace without publishing releases.
Frestia_1 was configured using existing meters: production
`sensor.solis_s6_eh1p_pv_total_energy_generation`, live power `sensor.bc_power`,
name `SIMULATION - Generator 1`. These measurements are simulations, not an
actual generator. For 12 November, the panel showed 12 kWh production and
27.87 kWh consumption; its Now view included approximately 46 W generator power.
Summary, Electricity and Now views rendered with generator-specific series.
Frestia_2 retained native solar, battery, tariff costs, devices, untracked
consumption, Sankey, distribution and gauges; its consumption was 30.5 kWh.

Cold-loading the combined dashboard exposed an unextended collection created
by the shared native date selector. Fixed by initializing the extended scoped
collection first; a regression test verifies this ordering and isolation.
Both distribution cards and Sankeys then included correct, separate data.
Native date presets were visibly present (today, yesterday, week, month, quarter,
year and rolling ranges). Historical selection updated both locations.

LAN HTTP testing exposed unavailable `crypto.randomUUID`; setup now uses a
`crypto.getRandomValues` fallback, also covered by the browser test.

The generator diagram now preserves native grid/load spacing and the native
grid-to-load line. Generator branches use solar-style curved connections to
grid and load, including zero-flow connections. Layout tests verify spacing,
native line alignment and both generator branches. Both diagrams were checked
together live after the correction. No integration errors were reported.

These checks do not certify every combination of optional providers and meters;
gas/water configuration retention and full dashboard structure are also covered
by component/boundary tests, not live generator-fuel measurements.

## Rebuild

Use the frontend revision recorded in `upstream/frontend-extension.json` in
`dist/frontend-native`, install its development dependencies and this project's
pinned esbuild dependency. Run `node tools/build-native.mjs` followed by
`node tools/build.mjs`. The generated namespaced bundle and licenses are shipped
under `custom_components/multi_location_energy/frontend/`; installed native HA
definitions are never replaced.
