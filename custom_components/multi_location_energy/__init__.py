"""Location-aware native energy dashboards for Home Assistant 2026.11."""
from pathlib import Path
import logging

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform, __version__ as HA_VERSION
from homeassistant.exceptions import ConfigEntryError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, FRONTEND_URL, PANEL_PATH, VERSION
from .registry import LocationRegistry
from . import websocket_api

_LOGGER = logging.getLogger(__name__)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass, config):
    return True


async def async_setup_entry(hass, entry):
    # Runtime-loaded native elements use internal interfaces; fail closed on
    # untested series instead of silently changing a user's native configuration.
    if not HA_VERSION.startswith("2026.11."):
        raise ConfigEntryError("This preview requires Home Assistant 2026.11.x")
    runtime = hass.data.setdefault(DOMAIN, {})
    registry = LocationRegistry(hass)
    await registry.async_load()
    runtime["registry"] = registry
    try:
        if not runtime.get("static_registered"):
            await hass.http.async_register_static_paths([
                StaticPathConfig(FRONTEND_URL, str(Path(__file__).parent / "frontend"), False)
            ])
            runtime["static_registered"] = True
        if not runtime.get("ws_registered"):
            websocket_api.async_setup(hass)
            runtime["ws_registered"] = True
        await hass.config_entries.async_forward_entry_setups(entry, [Platform.SENSOR])
        if not runtime.get("cards_registered"):
            frontend.add_extra_js_url(hass, f"{FRONTEND_URL}/location-card.js?v={VERSION}")
            runtime["cards_registered"] = True
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name="mle-panel",
            frontend_url_path=PANEL_PATH,
            sidebar_title="Energy Locations",
            sidebar_icon="mdi:home-lightning-bolt-outline",
            module_url=f"{FRONTEND_URL}/panel.js?v={VERSION}",
            embed_iframe=False,
            require_admin=True,
            config={"version": VERSION},
        )
    except Exception:
        await registry.async_close()
        raise
    return True


async def async_unload_entry(hass, entry):
    if not await hass.config_entries.async_unload_platforms(entry, [Platform.SENSOR]):
        return False
    frontend.async_remove_panel(hass, PANEL_PATH)
    await hass.data[DOMAIN].pop("registry").async_close()
    return True
