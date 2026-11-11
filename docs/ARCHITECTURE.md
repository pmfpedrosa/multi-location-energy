# Architecture

## Backend

One config entry enables the integration and a sensor platform. A persistent
location catalogue instantiates one adapted `EnergyManager` per location. Each
manager has its own storage key, cost map, generated sensor namespace, write lock
and registry listener. The sensor platform attaches new managers dynamically.

The source adaptation is reproducible in `tools/vendor_core.py`. Retained
snapshots come from `home-assistant/core` tag `2026.11.0`. The original schemas,
unit conversions, pricing/reset handling, storage migrations and validator are
preserved except for the documented location/lifecycle adaptations.

Generated power identifiers include the location ID. Generated cost identifiers
include the location ID and source registry/statistic identity. Thus importing the
same energy sensor into two locations does not collide, even with different prices.

All WebSocket operations require an administrator before state lookup. A supplied
location ID is looked up in the existing catalogue; it is never used to create a
new filesystem path. Only the create operation generates an immutable UUID.

The native preferences schema validates saves before the handler runs. Validation
of source metadata uses a task-local cost map to keep concurrent location requests
separate; there is no global context swap or monkey patch.

## WebSocket API

All types start with `multi_location_energy/`.

| Suffix | Fields besides `id` and `type` | Result |
|---|---|---|
| `locations/list` | none | `[{id, name}]` |
| `locations/create` | `name` | `{id, name}` |
| `locations/rename` | `location_id`, `name` | null |
| `get_prefs` | `location_id` | Native-format preferences |
| `save_prefs` | `location_id`, optional native preference arrays | Saved preferences |
| `info` | `location_id` | Cost lookup, forecast domains |
| `validate` | `location_id` | Native validation results |
| `solar_forecast` | `location_id` | Native forecast map |
| `frontend/get` | `location_id` | `{value: {hidden_cards?}}` |
| `frontend/set` | `location_id`, `value` | null |
| `import_native` | `location_id`, empty target required | Copied preferences |

There are no endpoints that overwrite native Energy preferences, delete energy
statistics, accept a Home Assistant token, or execute arbitrary actions.

## Frontend

The custom panel lazy-loads the **installed** native energy and configuration
components using detached native routers. Each mounted location gets:

1. A `hass` proxy overriding `callWS`, `connection`, and `panelUrl`.
2. A connection proxy with its own native collection properties.
3. Scoped native energy and frontend-settings commands.
4. Native setup dialogs hosted below the same scoped panel.
5. Navigation adapted to `/energy-locations/<id>/<view>` and
   `/energy-locations/<id>/configure/<tab>`.

Per-instance wrappers adjust native navigation and dashboard paths. They do not
modify native component prototypes or the global HA connection. Unknown energy
commands fail closed. Native widget modules and calculations remain those from
the installed release; no parallel charting library is introduced.

Native components depend on internal interfaces. Source inspection and boundary
tests are complete; actual full-application lifecycle validation remains pending.
See VALIDATION.md before installation on an operational instance.
