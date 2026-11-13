# Distinct generators throughout Energy Locations

Add one or more generators through the separate **Generators** menu. Each uses
an electricity production meter and optional live power sensor. Generator energy
is distinct from solar in native-derived distribution, historical/live Sankeys,
usage and production charts, source totals, device balances, self-sufficiency,
power graphs, comparisons and CSV exports. Two additional reusable cards expose
generator production and its share of home consumption.

The distribution retains the native grid-to-load connection. Generators have
solar-style curved branches to grid and load, with their own colour. Both
branches remain visible at zero flow. Destination allocations are estimates
when only production/grid meters are available.

Existing native features and non-generator locations are retained. Source
configuration remains isolated per location. This release targets HA 2026.11.x.

Validated locally with 20 JavaScript tests, 17 Python tests, real native-derived
card rendering, 1,000 native accounting parity cases and browser regressions.
Live development builds tested Frestia_1 with a clearly labelled simulated
generator and Frestia_2 with its existing solar/battery/devices. Fixed issues found
on LAN HTTP, date-selector-first loading, and native distribution line alignment.
See docs/GENERATOR-IMPLEMENTATION.md for evidence and limits.
