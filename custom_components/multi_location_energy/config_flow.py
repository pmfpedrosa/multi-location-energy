"""Enable the integration; locations are managed in its panel."""
from homeassistant import config_entries
import probatio as vol

from .const import DOMAIN


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Energy Locations", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
