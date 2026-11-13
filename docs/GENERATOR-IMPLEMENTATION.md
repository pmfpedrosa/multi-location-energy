# Generator extension — unpublished acceptance candidate

Generators are stored as distinct `generator` entries in each location's
`energy_sources`. Each has an immutable id, name, cumulative electricity statistic
and optional power entity. Duplicate production meters within a location are
rejected, including the same meter configured as both solar and a generator.
Shared test meters across different locations remain permitted.

The separate Generators menu edits only generator entries and preserves the
latest native sources and devices. Concurrent generator edits are detected.
No source configuration has been changed on the live installation by this work.

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

- 19 JavaScript tests: including mockup balance (18 import + 12 production − 3
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

These are component/boundary tests, not live acceptance. Browser activation
currently fails with `failed to activate captured window`; the dedicated Edge
browser connector is also unavailable. Frestia_1 and Frestia_2 must be checked
live before publication. The current HA installation remains v0.3.0-beta.3.

## Rebuild

Use the frontend revision recorded in `upstream/frontend-extension.json` in
`dist/frontend-native`, install its development dependencies and this project's
pinned esbuild dependency. Run `node tools/build-native.mjs` followed by
`node tools/build.mjs`. The generated namespaced bundle and licenses are shipped
under `custom_components/multi_location_energy/frontend/`; installed native HA
definitions are never replaced.
