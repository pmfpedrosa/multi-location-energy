"""Generator configuration, separate from native solar and gas preferences."""
import math
import re

import probatio as p


def validate_generators(hass, values, preferences):
    """Reject ambiguous metering and incompatible sensors before persistence."""
    if not isinstance(values, list) or len(values) > 50:
        raise p.Invalid("Configure at most 50 generators per location")
    result, ids, electricity, gas = [], set(), set(), set()
    native = {source.get(key) for source in preferences.get("energy_sources", [])
              for key in ("stat_energy_from", "stat_energy_to") if source.get("type") != "gas"}
    for item in values:
        if not isinstance(item, dict) or set(item) - {"id", "name", "energy", "power", "gas", "gas_power", "gas_unit", "factor", "basis"}:
            raise p.Invalid("Invalid generator fields")
        row = dict(item)
        identity = row.get("id", "")
        if not isinstance(identity, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", identity) or identity in ids:
            raise p.Invalid("Generator IDs must be unique")
        ids.add(identity)
        label = row.get("name", "")
        if not isinstance(label, str) or not 1 <= len(label.strip()) <= 100:
            raise p.Invalid("A generator name is required")
        row["name"] = label.strip()
        if row.get("gas_unit") not in ("m³", "kWh") or row.get("basis") not in ("LHV", "HHV"):
            raise p.Invalid("Select the gas measurement and heating-value basis")
        factor = row.get("factor")
        if isinstance(factor, bool) or not isinstance(factor, (float, int)) or not math.isfinite(factor) or factor <= 0:
            raise p.Invalid("Gas conversion factor must be positive and finite")
        for key, units in (("energy", {"Wh", "kWh", "MWh"}), ("power", {"W", "kW", "MW"}),
                           ("gas", {"m³", "ft³", "L"} if row["gas_unit"] == "m³" else {"Wh", "kWh", "MWh"}),
                           ("gas_power", {"m³/h", "L/h", "L/min", "ft³/min"} if row["gas_unit"] == "m³" else {"W", "kW", "MW"})):
            entity = row.get(key)
            if not entity and key in ("power", "gas_power"):
                row.pop(key, None)
                continue
            state = hass.states.get(entity) if isinstance(entity, str) else None
            if state is None or state.attributes.get("unit_of_measurement") not in units:
                raise p.Invalid(f"{key}: select an existing sensor with compatible units")
            if key in ("energy", "gas") and state.attributes.get("state_class") not in ("total", "total_increasing"):
                raise p.Invalid(f"{key}: a cumulative meter with long-term statistics is required")
        if row["energy"] in electricity or row["energy"] in native:
            raise p.Invalid("Electricity meter is already counted in this location")
        if row["gas"] in gas:
            raise p.Invalid("A shared gas meter cannot measure individual generators; use a combined generator entry")
        if row["energy"] == row["gas"] or row["energy"] in gas or row["gas"] in electricity:
            raise p.Invalid("Fuel and electricity require separate meters")
        electricity.add(row["energy"])
        gas.add(row["gas"])
        result.append(row)
    return result
