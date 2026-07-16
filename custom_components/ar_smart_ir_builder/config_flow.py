from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
)

from .const import (
    CONF_CONTROLLER_TYPE,
    CONF_DEVICE_KEY,
    CONF_MQTT_BASE_TOPIC,
    CONF_REMOTE_ENTITY,
    CONF_TITLE,
    CONTROLLER_BROADLINK,
    CONTROLLER_LABELS,
    CONTROLLER_TASMOTA_MQTT,
    CONTROLLER_TYPES,
    DEFAULT_TITLE,
    DOMAIN,
)


def _controller_select() -> SelectSelector:
    return SelectSelector(
        SelectSelectorConfig(
            options=[
                {"value": value, "label": CONTROLLER_LABELS[value]}
                for value in CONTROLLER_TYPES
            ],
            mode=SelectSelectorMode.DROPDOWN,
        )
    )


class ARSmartIRBuilderConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._base_data: dict = {}

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_DEVICE_KEY])
            self._abort_if_unique_id_configured()
            self._base_data = dict(user_input)
            if self._base_data[CONF_CONTROLLER_TYPE] == CONTROLLER_TASMOTA_MQTT:
                return await self.async_step_tasmota()
            return await self.async_step_broadlink()

        schema = vol.Schema(
            {
                vol.Required(CONF_TITLE, default=DEFAULT_TITLE): TextSelector(),
                vol.Required(CONF_DEVICE_KEY, default="default_builder"): TextSelector(),
                vol.Required(
                    CONF_CONTROLLER_TYPE, default=CONTROLLER_BROADLINK
                ): _controller_select(),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_broadlink(self, user_input=None):
        if user_input is not None:
            data = {**self._base_data, **user_input}
            return self.async_create_entry(title=data[CONF_TITLE], data=data)

        schema = vol.Schema(
            {
                vol.Required(CONF_REMOTE_ENTITY): EntitySelector(
                    EntitySelectorConfig(domain="remote")
                ),
            }
        )
        return self.async_show_form(step_id="broadlink", data_schema=schema)

    async def async_step_tasmota(self, user_input=None):
        if user_input is not None:
            data = {**self._base_data, **user_input}
            return self.async_create_entry(title=data[CONF_TITLE], data=data)

        schema = vol.Schema(
            {
                vol.Required(CONF_MQTT_BASE_TOPIC): TextSelector(),
            }
        )
        return self.async_show_form(
            step_id="tasmota",
            data_schema=schema,
            description_placeholders={
                "hint": (
                    "The Tasmota device's MQTT topic - whatever you set as "
                    "'Topic' under Configuration -> MQTT on the device "
                    "(commands are published to cmnd/<topic>/irsend)."
                )
            },
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        return ARSmartIRBuilderOptionsFlow(config_entry)


class ARSmartIRBuilderOptionsFlow(config_entries.OptionsFlow):
    """Options flow - compatible with both old and new HA versions."""

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
        controller_type = current.get(CONF_CONTROLLER_TYPE, CONTROLLER_BROADLINK)

        schema_dict = {
            vol.Required(CONF_TITLE, default=current.get(CONF_TITLE, DEFAULT_TITLE)): TextSelector(),
            vol.Required(
                CONF_CONTROLLER_TYPE, default=controller_type
            ): _controller_select(),
            vol.Optional(
                CONF_REMOTE_ENTITY, default=current.get(CONF_REMOTE_ENTITY)
            ): EntitySelector(EntitySelectorConfig(domain="remote")),
            vol.Optional(
                CONF_MQTT_BASE_TOPIC, default=current.get(CONF_MQTT_BASE_TOPIC, "")
            ): TextSelector(),
        }

        schema = vol.Schema(schema_dict)
        return self.async_show_form(step_id="init", data_schema=schema)
