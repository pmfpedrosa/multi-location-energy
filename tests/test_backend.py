"""Run actual adapted schema/manager code with small in-memory HA boundaries.

These are not full Home Assistant integration tests. The real-HA smoke test
procedure and its remaining coverage are documented in docs/VALIDATION.md.
"""
import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from copy import deepcopy
import importlib.util
from pathlib import Path
import re
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "test_dependencies"))
import probatio


def module(name, **attributes):
    result = types.ModuleType(name)
    result.__dict__.update(attributes)
    sys.modules[name] = result
    parent, _, child = name.rpartition(".")
    if parent in sys.modules:
        setattr(sys.modules[parent], child, result)
    return result


class Store:
    def __class_getitem__(cls, item): return cls
    def __init__(self, hass, version, key, **kwargs): self.hass, self.key = hass, key
    async def async_load(self): return deepcopy(self.hass.disk.get(self.key))
    async def async_save(self, data):
        await asyncio.sleep(0)
        self.hass.disk[self.key] = deepcopy(data)
    def async_delay_save(self, data, delay): self.hass.disk[self.key] = deepcopy(data())


class Event:
    def __class_getitem__(cls, item): return cls


class Bus:
    def __init__(self): self.listeners = []
    def async_listen(self, event, handler, **kwargs):
        self.listeners.append(handler)
        return lambda: self.listeners.remove(handler)


class EntityRegistry:
    def async_get(self, entity_id): return None
    def async_get_entity_id(self, *args): return None


class Hass:
    def __init__(self):
        self.disk, self.data, self.bus = {}, {}, Bus()
        self.entity_registry = EntityRegistry()
        self.states = {}
        self.config = types.SimpleNamespace(currency="EUR", units=None)
        self.is_stopping = False


module("homeassistant", __path__=[])
module("homeassistant.const", Platform=types.SimpleNamespace(SENSOR="sensor"))
module("homeassistant.core", HomeAssistant=Hass, Event=Event, callback=lambda fn: fn,
       valid_entity_id=lambda value: bool(re.fullmatch(r"[a-z_]+\.[a-z0-9_]+", value)))
module("homeassistant.helpers", __path__=[])
module("homeassistant.helpers.storage", Store=Store)
module("homeassistant.helpers.singleton", singleton=lambda key: lambda fn: fn)
module("homeassistant.helpers.config_validation", string=str)
module("homeassistant.helpers.entity_registry", async_get=lambda hass: hass.entity_registry,
       EVENT_ENTITY_REGISTRY_UPDATED="registry_updated", EventEntityRegistryUpdatedData=dict)
package = module("mle_test", __path__=[str(ROOT / "custom_components/multi_location_energy")])


def load(name):
    spec = importlib.util.spec_from_file_location(f"mle_test.{name}", ROOT / "custom_components/multi_location_energy" / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = result
    spec.loader.exec_module(result)
    return result


const = load("const")
helpers = load("helpers")
data = load("data")
registry_module = load("registry")

# Minimal HA entity boundaries allow the actual vendored pricing and power
# algorithms to run. This does not emulate Recorder or entity-platform startup.
class Entity:
    hass = None
    def __init__(self): self.removers = []
    def async_on_remove(self, callback): self.removers.append(callback)
    def async_write_ha_state(self): pass
    @property
    def native_value(self): return getattr(self, "_attr_native_value", None)
    @property
    def native_unit_of_measurement(self): return getattr(self, "_attr_native_unit_of_measurement", None)
    async def async_remove(self):
        if hasattr(self, "async_will_remove_from_hass"): await self.async_will_remove_from_hass()
        for remove in self.removers: remove()
        self.hass = None
    async def async_will_remove_from_hass(self): pass
    def async_entity_id_changed(self, old): pass
    async def async_get_last_extra_data(self): return None


@dataclass
class SensorExtra:
    native_value: float
    native_unit_of_measurement: str


class Converter:
    VALID_UNITS = {"Wh", "kWh", "W", "kW", "m³", "L"}
    @classmethod
    def convert(cls, value, source, target):
        factors = {"Wh": 1, "kWh": 1000, "W": 1, "kW": 1000, "m³": 1000, "L": 1}
        return value * factors[source] / factors[target]


class State:
    def __init__(self, entity_id, value, unit="kWh", state_class="total_increasing"):
        self.entity_id, self.state = entity_id, str(value)
        self.attributes = {"unit_of_measurement": unit, "state_class": state_class}
        self.name = entity_id


const_module = sys.modules["homeassistant.const"]
const_module.EntityStateAttribute = types.SimpleNamespace(UNIT_OF_MEASUREMENT="unit_of_measurement")
from enum import StrEnum
const_module.UnitOfEnergy = StrEnum("UnitOfEnergy", {"WATT_HOUR": "Wh", "KILO_WATT_HOUR": "kWh"})
const_module.UnitOfPower = StrEnum("UnitOfPower", {"WATT": "W", "KILO_WATT": "kW"})
const_module.UnitOfVolume = StrEnum("UnitOfVolume", {"CENTUM_CUBIC_FEET": "CCF", "CUBIC_FEET": "ft³", "CUBIC_METERS": "m³", "LITERS": "L", "GALLONS": "gal", "MILLE_CUBIC_FEET": "MCF"})
sys.modules["homeassistant.core"].State = State
sys.modules["homeassistant.core"].split_entity_id = lambda value: value.split(".", 1)
module("homeassistant.components", __path__=[])
module("homeassistant.components.sensor", __path__=[], RestoreSensor=Entity, SensorEntity=Entity,
       SensorDeviceClass=types.SimpleNamespace(MONETARY="monetary", POWER="power"),
       SensorStateClass=types.SimpleNamespace(MEASUREMENT="measurement", TOTAL="total", TOTAL_INCREASING="total_increasing"),
       SensorEntityCapabilityAttribute=types.SimpleNamespace(STATE_CLASS="state_class"),
       SensorEntityStateAttribute=types.SimpleNamespace(LAST_RESET="last_reset"), SensorExtraStoredData=SensorExtra)
module("homeassistant.components.sensor.recorder", reset_detected=lambda hass, entity_id, value, previous, state: value < previous)
module("homeassistant.exceptions", HomeAssistantError=RuntimeError)
module("homeassistant.helpers.entity_platform", AddEntitiesCallback=object)
module("homeassistant.helpers.event", async_track_state_change_event=lambda *args: lambda: None)
module("homeassistant.helpers.typing", ConfigType=dict, DiscoveryInfoType=dict)
module("homeassistant.util", __path__=[])
module("homeassistant.util.dt", utcnow=lambda: datetime.now(timezone.utc))
sys.modules["homeassistant.util"].dt = sys.modules["homeassistant.util.dt"]
module("homeassistant.util.unit_conversion", BaseUnitConverter=Converter, EnergyConverter=Converter, VolumeConverter=Converter, PowerConverter=Converter)
module("homeassistant.util.unit_system", METRIC_SYSTEM=object())
sensors = load("sensor")


def grid(stat="sensor.grid", price=0.2, **extra):
    return data.GRID_SOURCE_SCHEMA({"type": "grid", "stat_energy_from": stat,
        "number_energy_price": price, "cost_adjustment_day": 0, **extra})


class SchemaTests(unittest.TestCase):
    def test_conflicting_prices_rejected(self):
        with self.assertRaises(probatio.Invalid): grid(entity_energy_price="sensor.price")

    def test_missing_grid_measurement_rejected(self):
        with self.assertRaises(probatio.Invalid):
            data.GRID_SOURCE_SCHEMA({"type": "grid", "cost_adjustment_day": 0})

    def test_partial_combined_power_rejected(self):
        with self.assertRaises(probatio.Invalid): data.POWER_CONFIG_SCHEMA({"stat_rate_from": "sensor.a"})

    def test_external_statistics_need_explicit_costs(self):
        with self.assertRaises(probatio.Invalid): grid(stat="external:grid")
        result = grid(stat="external:grid", stat_cost="external:cost")
        self.assertEqual(result["stat_cost"], "external:cost")

    def test_location_namespaces_separate_shared_power_sources(self):
        for power in [{"stat_rate_inverted": "sensor.grid"}, {"stat_rate_from": "sensor.import", "stat_rate_to": "sensor.export"}]:
            self.assertNotEqual(helpers.generate_power_sensor_unique_id("grid", power, "a"), helpers.generate_power_sensor_unique_id("grid", power, "b"))
            self.assertNotEqual(helpers.generate_power_sensor_entity_id("grid", power, "a"), helpers.generate_power_sensor_entity_id("grid", power, "b"))


class RegistryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.hass = Hass()
        self.registry = registry_module.LocationRegistry(self.hass)
        self.hass.data[const.DOMAIN] = {"registry": self.registry}
        await self.registry.async_load()

    async def asyncTearDown(self): await self.registry.async_close()

    async def test_two_homes_same_meter_different_tariffs_survive_reload(self):
        a = await self.registry.async_create("Home A")
        b = await self.registry.async_create("Home B")
        await asyncio.gather(
            self.registry.manager(a["id"]).async_update({"energy_sources": [grid(price=0.15)]}),
            self.registry.manager(b["id"]).async_update({"energy_sources": [grid(price=0.35)]}),
        )
        restarted = registry_module.LocationRegistry(self.hass)
        await restarted.async_load()
        self.assertEqual(restarted.manager(a["id"]).data["energy_sources"][0]["number_energy_price"], 0.15)
        self.assertEqual(restarted.manager(b["id"]).data["energy_sources"][0]["number_energy_price"], 0.35)
        self.assertNotIn("energy", self.hass.disk)
        await restarted.async_close()

    async def test_create_attaches_sensor_manager_before_return(self):
        attached = []
        async def attach(manager): attached.append(manager.location_id)
        unsubscribe = self.registry.listen_created(attach)
        location = await self.registry.async_create("Home")
        self.assertEqual(attached, [location["id"]])
        unsubscribe()

    async def test_unknown_ids_never_create_storage_paths(self):
        with self.assertRaises(KeyError): self.registry.manager("../../energy")
        self.assertFalse(self.hass.disk)

    async def test_rename_preserves_identity_and_preferences(self):
        location = await self.registry.async_create("Old")
        manager = self.registry.manager(location["id"])
        await manager.async_update({"energy_sources": [grid()]})
        await self.registry.async_rename(location["id"], "New")
        self.assertIs(self.registry.manager(location["id"]), manager)
        self.assertEqual(self.registry.list()[0]["name"], "New")
        self.assertEqual(manager.data["energy_sources"][0]["stat_energy_from"], "sensor.grid")

    async def test_customizations_are_durable_and_not_shared(self):
        a = await self.registry.async_create("A"); b = await self.registry.async_create("B")
        await self.registry.async_set_frontend(a["id"], {"hidden_cards": ["electricity.energy-sankey"]})
        value = self.registry.frontend(a["id"]); value["hidden_cards"].append("mutated")
        self.assertEqual(self.registry.frontend(a["id"])["hidden_cards"], ["electricity.energy-sankey"])
        self.assertEqual(self.registry.frontend(b["id"]), {})

    async def test_concurrent_updates_reconcile_sequentially(self):
        location = await self.registry.async_create("A")
        manager = self.registry.manager(location["id"])
        events = []
        async def listener():
            events.append(("start", manager.data["energy_sources"][0]["number_energy_price"]))
            await asyncio.sleep(0.01)
            events.append(("end", manager.data["energy_sources"][0]["number_energy_price"]))
        manager.async_listen_updates(listener)
        await asyncio.gather(manager.async_update({"energy_sources": [grid(price=1)]}), manager.async_update({"energy_sources": [grid(price=2)]}))
        self.assertEqual(events, [("start", 1), ("end", 1), ("start", 2), ("end", 2)])

    async def test_repeated_close_releases_registry_callbacks(self):
        await self.registry.async_create("A")
        self.assertEqual(len(self.hass.bus.listeners), 1)
        await self.registry.async_close()
        await self.registry.async_close()
        self.assertEqual(self.hass.bus.listeners, [])


class SensorTests(unittest.IsolatedAsyncioTestCase):
    async def test_shared_meter_costs_and_entity_ids_remain_separate(self):
        hass = Hass()
        a = data.EnergyManager(hass, "a"); b = data.EnergyManager(hass, "b")
        ca = sensors.EnergyCostSensor(sensors.SOURCE_ADAPTERS[0], grid(price=0.15), a)
        cb = sensors.EnergyCostSensor(sensors.SOURCE_ADAPTERS[0], grid(price=0.35), b)
        self.assertNotEqual(ca.entity_id, cb.entity_id)
        ca.hass = cb.hass = hass
        self.assertNotEqual(ca.unique_id, cb.unique_id)
        hass.states["sensor.grid"] = State("sensor.grid", 100)
        await ca.async_added_to_hass(); await cb.async_added_to_hass()
        hass.states["sensor.grid"] = State("sensor.grid", 102)
        ca._update_cost(); cb._update_cost()
        self.assertAlmostEqual(ca.native_value, 0.3)
        self.assertAlmostEqual(cb.native_value, 0.7)
        self.assertEqual(a.cost_sensors["sensor.grid"], ca.entity_id)
        self.assertEqual(b.cost_sensors["sensor.grid"], cb.entity_id)
        await ca.async_remove()
        self.assertNotIn("sensor.grid", a.cost_sensors)
        self.assertEqual(b.cost_sensors["sensor.grid"], cb.entity_id)

    async def test_unknown_energy_is_not_priced_as_zero(self):
        hass = Hass(); manager = data.EnergyManager(hass, "a")
        cost = sensors.EnergyCostSensor(sensors.SOURCE_ADAPTERS[0], grid(), manager); cost.hass = hass
        hass.states["sensor.grid"] = State("sensor.grid", 100); cost._update_cost()
        hass.states["sensor.grid"] = State("sensor.grid", "unavailable"); cost._update_cost()
        hass.states["sensor.grid"] = State("sensor.grid", 103); cost._update_cost()
        self.assertAlmostEqual(cost.native_value, 0.6)

    async def test_combined_power_converts_kw_and_preserves_unavailability(self):
        hass = Hass()
        power = sensors.EnergyPowerSensor("grid", {"stat_rate_from": "sensor.import", "stat_rate_to": "sensor.export"}, "a", "sensor.power")
        power.hass = hass
        hass.states["sensor.import"] = State("sensor.import", 1.5, "kW")
        hass.states["sensor.export"] = State("sensor.export", 300, "W")
        power._update_state()
        self.assertEqual(power.native_value, 1200)
        hass.states["sensor.import"] = State("sensor.import", "unavailable", "kW")
        power._update_state()
        self.assertIsNone(power.native_value)
        self.assertFalse(power.available)


if __name__ == "__main__": unittest.main(verbosity=2)
