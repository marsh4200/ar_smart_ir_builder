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
    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self.hass.config_entries.async_update_entry(
                self._config_entry,
                title=user_input[CONF_TITLE],
                data={**self._config_entry.data, **user_input},
                options={**self._config_entry.options, **user_input},
            )
            return self.async_create_entry(title="", data=user_input)

        current = {**self._config_entry.data, **self._config_entry.options}
        schema = vol.Schema(
            {
                vol.Required(CONF_TITLE, default=current.get(CONF_TITLE, DEFAULT_TITLE)): TextSelector(),
                vol.Required(CONF_DEVICE_KEY, default=current.get(CONF_DEVICE_KEY, "default_builder")): TextSelector(),
                vol.Required(CONF_REMOTE_ENTITY, default=current.get(CONF_REMOTE_ENTITY)): EntitySelector(
                    EntitySelectorConfig(domain="remote")
                ),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)

