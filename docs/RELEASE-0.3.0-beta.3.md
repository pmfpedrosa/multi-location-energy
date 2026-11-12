# Stable historical Sankey rendering

Fixes unnecessary chart redraws on unrelated Home Assistant sensor updates.
Location cards now provide stable, native-shaped context groups and cache the
location's configuration object. The location panel's translation fallback also
retains its identity until its translations change. Live power updates remain enabled.

The editor now distinguishes **Energy Sankey (selected period, kWh)** from
**Power Sankey (live, W)**. Power Sankey intentionally ignores date selection.
Use `energy-sankey` and the same `date_group` as your date selector for history.

Validation: 15 JavaScript tests, card/editor/lifecycle browser checks, panel
browser smoke, and an additional rendering regression using the unmodified
HA 20261028.4 Sankey card with real Lit/ECharts and fixed two-location data.
The native regression fails on beta.2 and passes with this fix; changed period
data still renders. Python backend and syntax checks also pass.

Remains a prerelease. The existing blank Configure panel is outside this fix.
