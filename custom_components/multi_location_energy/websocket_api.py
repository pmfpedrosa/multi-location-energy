"""Admin-only, explicitly location-scoped API using native energy schemas."""
from copy import deepcopy
from functools import wraps

import probatio as p
from homeassistant.components import websocket_api
from homeassistant.components.energy.data import async_get_manager as native_manager
from homeassistant.components.energy.websocket_api import async_get_energy_platforms

from .const import DOMAIN
from .data import DEVICE_CONSUMPTION_SCHEMA, ENERGY_SOURCE_SCHEMA
from .validate import async_validate
from .generators import validate_generators

LOCATION = {p.Required("location_id"): str}


def command(suffix, schema=None):
    """Always authorize and validate before looking up state."""
    def decorate(function):
        @websocket_api.require_admin
        @websocket_api.websocket_command({p.Required("type"): f"{DOMAIN}/{suffix}", **(schema or {})})
        @websocket_api.async_response
        @wraps(function)
        async def wrapped(hass, connection, msg):
            runtime = hass.data.get(DOMAIN, {})
            registry = runtime.get("registry")
            if registry is None:
                connection.send_error(msg["id"], "not_loaded", "Energy Locations is not loaded")
                return
            if "location_id" in msg:
                try:
                    registry.manager(msg["location_id"])
                except KeyError:
                    connection.send_error(msg["id"], "not_found", "Unknown location")
                    return
            try:
                result = await function(hass, registry, msg)
            except p.Invalid as error:
                connection.send_error(msg["id"], "invalid_format", str(error))
                return
            connection.send_result(msg["id"], result)
        return wrapped
    return decorate


@command("locations/list")
async def ws_list(hass, registry, msg):
    return registry.list()


def name(value):
    value = value.strip()
    if not 1 <= len(value) <= 100:
        raise p.Invalid("Name must contain 1 to 100 characters")
    return value


@command("locations/create", {p.Required("name"): name})
async def ws_create(hass, registry, msg):
    return await registry.async_create(msg["name"])


@command("locations/rename", {**LOCATION, p.Required("name"): name})
async def ws_rename(hass, registry, msg):
    await registry.async_rename(msg["location_id"], msg["name"])


@command("get_prefs", LOCATION)
async def ws_get(hass, registry, msg):
    manager = registry.manager(msg["location_id"])
    return deepcopy(manager.data or manager.default_preferences())


@command("save_prefs", {
    **LOCATION,
    p.Optional("energy_sources"): ENERGY_SOURCE_SCHEMA,
    p.Optional("device_consumption"): [DEVICE_CONSUMPTION_SCHEMA],
    p.Optional("device_consumption_water"): [DEVICE_CONSUMPTION_SCHEMA],
})
async def ws_save(hass, registry, msg):
    manager = registry.manager(msg["location_id"])
    update = {key: deepcopy(msg[key]) for key in ("energy_sources", "device_consumption", "device_consumption_water") if key in msg}
    production = {g["energy"] for g in registry.generators(msg["location_id"])}
    if any(source.get(key) in production for source in update.get("energy_sources", [])
           for key in ("stat_energy_from", "stat_energy_to")):
        raise p.Invalid("A generator electricity meter is already counted in this location")
    await manager.async_update(update)
    return deepcopy(manager.data)


@command("info", LOCATION)
async def ws_info(hass, registry, msg):
    return {
        "cost_sensors": dict(registry.manager(msg["location_id"]).cost_sensors),
        "solar_forecast_domains": list(await async_get_energy_platforms(hass)),
    }


@command("validate", LOCATION)
async def ws_validate(hass, registry, msg):
    return (await async_validate(hass, registry.manager(msg["location_id"]))).as_dict()


@command("solar_forecast", LOCATION)
async def ws_forecast(hass, registry, msg):
    manager = registry.manager(msg["location_id"])
    platforms = await async_get_energy_platforms(hass)
    entries = {entry_id for source in (manager.data or {}).get("energy_sources", []) if source["type"] == "solar" for entry_id in source.get("config_entry_solar_forecast") or []}
    forecasts = {}
    for entry_id in entries:
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry and entry.domain in platforms:
            forecast = await platforms[entry.domain](hass, entry_id)
            if forecast is not None:
                forecasts[entry_id] = forecast
    return forecasts


@command("frontend/get", LOCATION)
async def ws_frontend_get(hass, registry, msg):
    return {"value": registry.frontend(msg["location_id"])}


@command("frontend/set", {**LOCATION, p.Required("value"): {p.Optional("hidden_cards"): [str]}})
async def ws_frontend_set(hass, registry, msg):
    await registry.async_set_frontend(msg["location_id"], msg["value"])


@command("import_native", LOCATION)
async def ws_import(hass, registry, msg):
    manager = registry.manager(msg["location_id"])
    if manager.data and manager.data != manager.default_preferences():
        raise p.Invalid("Import is only allowed into an empty location")
    native = await native_manager(hass)
    await manager.async_update(deepcopy(native.data or manager.default_preferences()))
    return deepcopy(manager.data)


@command("generators/get", LOCATION)
async def ws_generators_get(hass, registry, msg):
    return registry.generators(msg["location_id"])


@command("generators/set", {**LOCATION, p.Required("generators"): list})
async def ws_generators_set(hass, registry, msg):
    values = validate_generators(hass, msg["generators"], registry.manager(msg["location_id"]).data or {})
    await registry.async_set_generators(msg["location_id"], values)
    return values


@command("generators/period", {**LOCATION, p.Required("start"): str, p.Required("end"): str})
async def ws_generators_period(hass, registry, msg):
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    try:
        zone = ZoneInfo(hass.config.time_zone)
        start = datetime.strptime(msg["start"], "%Y-%m-%d").replace(tzinfo=zone)
        end = datetime.strptime(msg["end"], "%Y-%m-%d").replace(tzinfo=zone) + timedelta(days=1)
        if end <= start or (end - start).days > 366:
            raise ValueError
    except (ValueError, TypeError) as error:
        raise p.Invalid("Choose a date range of 1 to 366 days") from error
    return {"start": start.isoformat(), "end": end.isoformat()}


def async_setup(hass):
    for handler in (ws_list, ws_create, ws_rename, ws_get, ws_save, ws_info, ws_validate, ws_forecast, ws_frontend_get, ws_frontend_set, ws_import, ws_generators_get, ws_generators_set, ws_generators_period):
        websocket_api.async_register_command(hass, handler)
