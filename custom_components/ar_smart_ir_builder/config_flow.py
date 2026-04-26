from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.selector import EntitySelector, EntitySelectorConfig, TextSelector

from .const import CONF_DEVICE_KEY, CONF_REMOTE_ENTITY, CONF_TITLE, DEFAULT_TITLE, DOMAIN


class ARSmartIRBuilderConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_DEVICE_KEY])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=user_input[CONF_TITLE],
                data=user_input,
            )

        schema = vol.Schema(
            {
                vol.Required(CONF_TITLE, default=DEFAULT_TITLE): TextSelector(),
                vol.Required(CONF_DEVICE_KEY, default="default_builder"): TextSelector(),
                vol.Required(CONF_REMOTE_ENTITY): EntitySelector(
                    EntitySelectorConfig(domain="remote")
                ),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    def async_get_options_flow(config_entry):
        return ARSmartIRBuilderOptionsFlow(config_entry)


class ARSmartIRBuilderOptionsFlow(config_entries.OptionsFlow):
    """Options flow — compatible with both old and new HA versions."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        # Store locally for older HA versions that don't inject self.config_entry
        self._entry = config_entry

    async def async_step_init(self, user_input=None):
        # Use self.config_entry if available (HA 2024.x+), else fall back to self._entry
        entry = getattr(self, "config_entry", self._entry)

        if user_input is not None:
            self.hass.config_entries.async_update_entry(
                entry,
                title=user_input[CONF_TITLE],
                data={**entry.data, **user_input},
                options={**entry.options, **user_input},
            )
            return self.async_create_entry(title="", data=user_input)

        current = {**entry.data, **entry.options}
        schema = vol.Schema(
            {
                vol.Required(CONF_TITLE, default=current.get(CONF_TITLE, DEFAULT_TITLE)): TextSelector(),
                vol.Required(CONF_REMOTE_ENTITY, default=current.get(CONF_REMOTE_ENTITY)): EntitySelector(
                    EntitySelectorConfig(domain="remote")
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
