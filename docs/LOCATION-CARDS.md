# Location Energy cards on any dashboard

The integration automatically loads the **Location Energy** custom card. After
updating and restarting Home Assistant, reload the browser. Add a card to any
custom dashboard, search for **Location Energy**, and select the location and
native card in its visual editor. No manually copied frontend files or Lovelace
resource entries are needed.

The same administrator-only access as the Energy Locations panel applies.
Existing location preferences are read; cards do not copy meters or history.
The native Energy dashboard and Energy Locations panel retain their own data
collections.

## All locations on one dashboard

Add this manual card to show one date selector and both distribution diagrams:

```yaml
type: vertical-stack
cards:
  - type: custom:multi-location-energy-card
    location_id: d3d0b76c5d7e4a408ee0e1f22b4a7e51
    card_type: energy-date-selection
    date_group: all-homes
  - type: grid
    columns: 2
    square: false
    cards:
      - type: custom:multi-location-energy-card
        location_id: d3d0b76c5d7e4a408ee0e1f22b4a7e51
        card_type: energy-distribution
        date_group: all-homes
      - type: custom:multi-location-energy-card
        location_id: 8affa7b9dd7c4586b7606224c36afc57
        card_type: energy-distribution
        date_group: all-homes
```

These IDs refer to Frestia_1 and Frestia_2 on the target installation. On another
installation, select locations through the visual editor. IDs also appear in
each location's panel URL.

Cards with the same `date_group` on the same dashboard share period and comparison
selection, including when a card appears after the date was selected. Each
location still has its own preferences and statistics collection. A date
selector's CSV download exports **only its selected location**.

Without `date_group`, cards share the dashboard's default group. To select dates
independently, use different groups and a date selector for each group. Groups
are separate across dashboards, browser tabs and HA connections. Date choices
are session state, not saved location configuration.

## Native card types

For a Sankey controlled by the date selector, use `energy-sankey` and the same
`date_group` as the selector. It displays energy in kWh for that period.
`power-sankey` displays live power in W and intentionally ignores selected dates.
A selected day that is still in progress can gain energy as Recorder receives
new readings; use a completed past day when checking historical stability.

- `energy-distribution` (default)
- `energy-date-selection`
- `energy-usage-graph`, `energy-sources-table`, `energy-solar-graph`
- `energy-sankey`, `energy-devices-graph`, `energy-devices-detail-graph`
- `energy-grid-balance`, `energy-grid-neutrality-gauge`
- `energy-self-sufficiency-gauge`, `energy-solar-consumed-gauge`
- `energy-carbon-consumed-gauge`
- `energy-gas-graph`, `energy-water-graph`, `water-sankey`
- `power-sources-graph`, `power-sankey`

Power source graphs use the group's selected statistics period and native live
sensor values. Distribution is energy in kWh for the selected period; it is not
a live power diagram. Choose `power-sankey` for the native current-power flow.

Optional `options` passes the selected native card's normal configuration. For
example, a custom title or a totals-only table:

```yaml
type: custom:multi-location-energy-card
location_id: 8affa7b9dd7c4586b7606224c36afc57
card_type: energy-sources-table
date_group: all-homes
options:
  show_only_totals: true
```

Type, collection key and native dashboard links are managed by the wrapper and
cannot be overridden in `options`. Distribution titles default to the location
name. Native features depend on that location having the relevant measurements.
No generator support is included.

## Validation

Automated checks cover per-location routing, independent native collection
state, shared and independent dates/comparisons, late-mounted cards, lifecycle,
configuration changes, visual editor controls and denied/unknown locations.
The browser boundary fixture deliberately doubles native card components; it
does not certify native rendering. Live beta testing additionally verified both
distribution cards on Energy Overview, shared previous-day navigation and the
visual editor's location/type selectors with a native Frestia_2 sources table.
Frestia_1 showed 4.35 kWh and Frestia_2 37.9 kWh on 11 November, consistent with
the separate location dashboard and Recorder checks. No source preferences were
changed. This does not certify every native card option or fix the existing
blank Configure panel.
