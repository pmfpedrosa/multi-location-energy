"""Location catalogue, isolated preferences and UI customizations."""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from copy import deepcopy
from uuid import uuid4

from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .data import EnergyManager


class LocationRegistry:
    """Own all managers without modifying the native energy singleton."""

    def __init__(self, hass):
        self.hass = hass
        self.store = Store(hass, 1, f"{DOMAIN}.locations")
        self.locations: dict[str, dict] = {}
        self.managers: dict[str, EnergyManager] = {}
        self._created: list[Callable[[EnergyManager], Awaitable[None]]] = []
        self._lock = asyncio.Lock()

    async def async_load(self):
        stored = await self.store.async_load() or {"locations": {}}
        self.locations = stored["locations"]
        for location_id in self.locations:
            manager = EnergyManager(self.hass, location_id)
            await manager.async_initialize()
            self.managers[location_id] = manager

    def manager(self, location_id):
        """Lookup only: user-controlled IDs never become storage paths."""
        if location_id not in self.locations:
            raise KeyError("Unknown location")
        return self.managers[location_id]

    def list(self):
        return [dict(id=key, name=value["name"]) for key, value in self.locations.items()]

    async def async_save(self):
        await self.store.async_save({"locations": deepcopy(self.locations)})

    async def async_create(self, name):
        async with self._lock:
            location_id = uuid4().hex
            manager = EnergyManager(self.hass, location_id)
            await manager.async_initialize()
            await manager.async_update(manager.default_preferences())
            self.managers[location_id] = manager
            self.locations[location_id] = {"name": name, "frontend": {}}
            try:
                await self.async_save()
                for listener in self._created:
                    await listener(manager)
            except Exception:
                # Keep the catalogue if persisted: a reload can finish attachment.
                await manager.async_close()
                raise
            return {"id": location_id, "name": name}

    async def async_rename(self, location_id, name):
        async with self._lock:
            self.manager(location_id)
            self.locations[location_id]["name"] = name
            await self.async_save()

    async def async_set_frontend(self, location_id, value):
        async with self._lock:
            self.manager(location_id)
            self.locations[location_id]["frontend"] = deepcopy(value)
            await self.async_save()

    def frontend(self, location_id):
        self.manager(location_id)
        return deepcopy(self.locations[location_id].get("frontend", {}))

    def generators(self, location_id):
        self.manager(location_id)
        return deepcopy(self.locations[location_id].get("generators", []))

    async def async_set_generators(self, location_id, value):
        async with self._lock:
            self.manager(location_id)
            previous = self.locations[location_id].get("generators", [])
            self.locations[location_id]["generators"] = deepcopy(value)
            try:
                await self.async_save()
            except Exception:
                self.locations[location_id]["generators"] = previous
                raise

    def listen_created(self, listener):
        self._created.append(listener)
        return lambda: self._created.remove(listener)

    async def async_close(self):
        for manager in self.managers.values():
            await manager.async_close()
        self._created.clear()
