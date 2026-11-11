"""Reproduce location adaptations to HA 2026.11.0. See NOTICE (Apache-2.0)."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "custom_components" / "multi_location_energy"
DEST.mkdir(parents=True, exist_ok=True)
generated = {}

def replace(text, before, after):
    if before not in text:
        raise RuntimeError(f"Upstream changed: {before[:100]}")
    return text.replace(before, after)

for filename in ("data.py", "sensor.py", "helpers.py", "validate.py", "types.py"):
    text = (ROOT / "upstream" / "core" / filename).read_text(encoding="utf-8")
    text = '# Adapted from Home Assistant Core 2026.11.0 (Apache-2.0).\n# See NOTICE and tools/vendor_core.py for changes.\nfrom __future__ import annotations\n' + text
    if filename == "data.py":
        start = text.index('@singleton.singleton(')
        end = text.index('\n\nclass FlowFromGridSourceType', start)
        text = text[:start] + '''async def async_get_manager(hass: HomeAssistant, location_id: str) -> EnergyManager:
    """Return an initialized manager; never create unknown locations."""
    return hass.data[DOMAIN]["registry"].manager(location_id)
''' + text[end:]
        text = replace(text, 'def __init__(self, hass: HomeAssistant) -> None:', 'def __init__(self, hass: HomeAssistant, location_id: str) -> None:')
        text = replace(text, '        self._hass = hass', '        self._hass = hass\n        self.location_id = location_id\n        self.cost_sensors: dict[str, str] = {}\n        self._unsubscribe_registry = None\n        self._write_lock = asyncio.Lock()')
        text = replace(text, 'hass, STORAGE_VERSION, STORAGE_KEY, minor_version=STORAGE_MINOR_VERSION', 'hass, STORAGE_VERSION, f"{STORAGE_KEY}.{location_id}", minor_version=STORAGE_MINOR_VERSION')
        text = replace(text, '        self._hass.bus.async_listen(', '        self._unsubscribe_registry = self._hass.bus.async_listen(')
        text = replace(text, '    async def async_update(self, update: EnergyPreferencesUpdate) -> None:', '''    async def async_update(self, update: EnergyPreferencesUpdate) -> None:
        """Serialize saves and sensor reconciliation for this location."""
        async with self._write_lock:
            await self._async_update_locked(update)

    async def _async_update_locked(self, update: EnergyPreferencesUpdate) -> None:''')
        text = replace(text, '        self._store.async_delay_save(lambda: data, 60)\n\n        if not self._update_listeners:', '        await self._store.async_save(data)\n\n        if not self._update_listeners:')
        text = replace(text, 'generate_power_sensor_unique_id(source_type, config)', 'generate_power_sensor_unique_id(source_type, config, self.location_id)')
        text = replace(text, 'generate_power_sensor_entity_id(source_type, config)', 'generate_power_sensor_entity_id(source_type, config, self.location_id)')
        text = replace(text, 'def async_listen_updates(self, update_listener: Callable[[], Awaitable]) -> None:', 'def async_listen_updates(self, update_listener: Callable[[], Awaitable]) -> Callable[[], None]:')
        text += '''
        return lambda: self._update_listeners.remove(update_listener)

    async def async_close(self) -> None:
        """Flush preferences and release listeners on unload."""
        if self._unsubscribe_registry:
            self._unsubscribe_registry()
            self._unsubscribe_registry = None
        if self.data is not None:
            await self._store.async_save(self.data)
        self._update_listeners.clear()
'''
    elif filename == "helpers.py":
        text = replace(text, 'def generate_power_sensor_unique_id(source_type: str, config: PowerConfig) -> str:', 'def generate_power_sensor_unique_id(source_type: str, config: PowerConfig, location_id: str) -> str:')
        text = replace(text, 'return f"energy_power_', 'return f"mle_{location_id}_power_')
        text = replace(text, 'def generate_power_sensor_entity_id(source_type: str, config: PowerConfig) -> str:', 'def generate_power_sensor_entity_id(source_type: str, config: PowerConfig, location_id: str) -> str:')
        text = replace(text, 'return f"{source}_inverted"', 'return f"sensor.mle_{location_id}_{source.removeprefix(\'sensor.\')}_inverted"')
        text = replace(text, 'return f"sensor.{source.replace(\'.\', \'_\')}_inverted"', 'return f"sensor.mle_{location_id}_{source.replace(\'.\', \'_\')}_inverted"')
        text = replace(text, 'return f"sensor.energy_', 'return f"sensor.mle_{location_id}_')
    elif filename == "sensor.py":
        start = text.index('async def async_setup_platform(')
        end = text.index('\n\n@dataclass', start)
        text = text[:start] + '''async def async_setup_entry(hass, entry, async_add_entities) -> None:
    """Attach existing and future locations to one sensor platform."""
    registry = hass.data[DOMAIN]["registry"]
    sensor_managers = {}

    async def attach(manager):
        if manager.location_id in sensor_managers:
            return
        sensors = SensorManager(manager, async_add_entities)
        sensor_managers[manager.location_id] = sensors
        await sensors.async_start()

    entry.async_on_unload(registry.listen_created(attach))
    for manager in registry.managers.values():
        await attach(manager)
''' + text[end:]
        text = replace(text, '            adapter,\n            config,\n        )', '            adapter,\n            config,\n            self.manager,\n        )')
        text = replace(text, '            GRID_EXPORT_ADAPTER,\n            export_config,\n        )', '            GRID_EXPORT_ADAPTER,\n            export_config,\n            self.manager,\n        )')
        text = replace(text, 'generate_power_sensor_unique_id(source_type, power_config)', 'generate_power_sensor_unique_id(source_type, power_config, self.manager.location_id)')
        text = replace(text, 'generate_power_sensor_entity_id(source_type, power_config)', 'generate_power_sensor_entity_id(source_type, power_config, self.manager.location_id)')
        text = replace(text, '        config: Mapping[str, Any],\n    ) -> None:\n        """Initialize the sensor.', '        config: Mapping[str, Any],\n        manager: EnergyManager,\n    ) -> None:\n        """Initialize the sensor.')
        text = replace(text, '        self._adapter = adapter', '        self._manager = manager\n        self._adapter = adapter')
        text = replace(text, 'self.entity_id = f"{config[adapter.stat_energy_key]}_{adapter.entity_id_suffix}"', 'self.entity_id = f"sensor.mle_{manager.location_id}_{config[adapter.stat_energy_key].replace(\'.\', \'_\')}_{adapter.entity_id_suffix}"')
        text = replace(text, 'self.hass.data[DOMAIN]["cost_sensors"]', 'self._manager.cost_sensors')
        text = replace(text, 'return f"{prefix}_{self._adapter.source_type}_{self._adapter.entity_id_suffix}"', 'return f"{self._manager.location_id}_{prefix}_{self._adapter.source_type}_{self._adapter.entity_id_suffix}"')
    elif filename == "validate.py":
        text = replace(text, 'from . import data', 'from contextvars import ContextVar\n\nfrom . import data\n\n_VALIDATION_COSTS: ContextVar[dict[str, str]] = ContextVar("mle_validation_costs")')
        text = replace(text, 'hass.data[DOMAIN]["cost_sensors"]', '_VALIDATION_COSTS.get()')
        text = replace(text, 'async def async_validate(hass: HomeAssistant) -> EnergyPreferencesValidation:', '''async def async_validate(hass: HomeAssistant, manager: data.EnergyManager) -> EnergyPreferencesValidation:
    """Task-local costs prevent leaks between concurrent location validations."""
    token = _VALIDATION_COSTS.set(manager.cost_sensors)
    try:
        return await _async_validate_location(hass, manager)
    finally:
        _VALIDATION_COSTS.reset(token)


async def _async_validate_location(hass: HomeAssistant, manager: data.EnergyManager) -> EnergyPreferencesValidation:''')
        text = replace(text, '    manager: data.EnergyManager = await data.async_get_manager(hass)\n', '')
    generated[filename] = text

if "--stdout" in sys.argv:
    print(json.dumps(generated))
else:
    for filename, text in generated.items():
        (DEST / filename).write_text(text, encoding="utf-8")
    print(f"Generated location-aware modules in {DEST}")
