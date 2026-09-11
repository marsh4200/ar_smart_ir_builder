"""Stateless "press it and it sends the code" buttons.

Some learned commands don't fit any stateful HA entity model at all: a
relative-style AC's Mode/Swing toggle (single button, unknown position —
see climate.py's RELATIVE_MODE_ORDER discussion), its Temp +/- steppers, a
plain On/Off pair, or a "universal fan" that's nothing but On/Off + a speed
step button (see fan.py — device_type "universal_fan" deliberately gets no
fan entity). For all of these, the honest representation in Home Assistant
is a button.ButtonEntity: press it, it sends the learned code once, full
stop. No state, no "select a target and we'll compute how to get there".

One button entity is created per profile per command name in
BUTTON_COMMANDS that has actually been learned — regardless of the
profile's device_type, so these sit *alongside* whatever climate/fan/
media_player entity a profile already has (same HA device), rather than
replacing it.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DATA_STORE, DOMAIN, SIGNAL_DEVICES_UPDATED, resolve_controller_available, send_with_policy
from .storage import ARSmartIRStore, normalize_device

# command name -> (button label, mdi icon). Deliberately a short curated
# list, not "one button per learned command" — a 30-button TV remote
# shouldn't spawn 30 extra button entities on top of its media_player. This
# is just the toggle/step commands that have no natural stateful entity.
BUTTON_COMMANDS: dict[str, tuple[str, str]] = {
    "on": ("On", "mdi:power-on"),
    "off": ("Off", "mdi:power-off"),
    "power_toggle": ("Power", "mdi:power"),
    "mode_toggle": ("Mode", "mdi:autorenew"),
    "temp_up": ("Temp Up", "mdi:thermometer-chevron-up"),
    "temp_down": ("Temp Down", "mdi:thermometer-chevron-down"),
    "swing_toggle": ("Swing", "mdi:swap-vertical"),
    "fan_toggle": ("Fan Speed", "mdi:fan"),
    "speed_up": ("Fan Speed Up", "mdi:fan-plus"),
    "speed_down": ("Fan Speed Down", "mdi:fan-minus"),
}


async def _async_remove_entity(hass: HomeAssistant, entity) -> None:
    """Remove entity from state machine, entity registry, and device registry."""
    entity_reg = er.async_get(hass)
    device_reg = dr.async_get(hass)

    if entity.registry_entry:
        entity_reg.async_remove(entity.entity_id)
    else:
        await entity.async_remove()

    if entity.device_entry:
        remaining = er.async_entries_for_device(entity_reg, entity.device_entry.id, include_disabled_entities=True)
        if not remaining:
            device_reg.async_remove_device(entity.device_entry.id)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
    # device_key -> {command_name: entity}
    entities: dict[str, dict[str, ARSmartIRCommandButton]] = {}

    @callback
    def sync_entities() -> None:
        desired: dict[str, dict[str, Any]] = {}
        for device_key, device in store.async_dump().get("devices", {}).items():
            profile = normalize_device(device)
            if profile.get("entry_id") != entry.entry_id:
                continue
            desired[device_key] = profile

        new_entities: list[ARSmartIRCommandButton] = []

        for device_key, profile in desired.items():
            commands = profile.get("commands", {})
            wanted = {
                name for name in BUTTON_COMMANDS
                if isinstance(commands.get(name), str) and commands.get(name)
            }
            device_buttons = entities.setdefault(device_key, {})

            for name in wanted:
                if name in device_buttons:
                    device_buttons[name].update_profile(profile)
                    device_buttons[name].async_write_ha_state()
                    continue
                entity = ARSmartIRCommandButton(hass, entry, device_key, profile, name)
                device_buttons[name] = entity
                new_entities.append(entity)

            for name in list(device_buttons):
                if name in wanted:
                    continue
                stale = device_buttons.pop(name)
                hass.async_create_task(_async_remove_entity(hass, stale))

        for device_key in list(entities):
            if device_key in desired:
                continue
            for stale in entities.pop(device_key).values():
                hass.async_create_task(_async_remove_entity(hass, stale))

        if new_entities:
            async_add_entities(new_entities)

    sync_entities()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_DEVICES_UPDATED, sync_entities))


async def async_remove_config_entry_device(
    hass: HomeAssistant, config_entry: ConfigEntry, device_entry: dr.DeviceEntry
) -> bool:
    """Allow removing a device (profile) from the UI three-dot menu.

    Buttons share their device identifier with whatever other platform this
    profile has ({entry_id}_{device_key}) — this only matters for a profile
    that has ONLY button entities (e.g. a universal_fan), where no other
    platform would offer this hook.
    """
    from homeassistant.helpers.dispatcher import async_dispatcher_send
    store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
    for identifier in device_entry.identifiers:
        if identifier[0] != DOMAIN:
            continue
        unique_id = identifier[1]
        prefix = config_entry.entry_id + "_"
        if unique_id.startswith(prefix):
            device_key = unique_id[len(prefix):]
            deleted = await store.delete_device(config_entry, device_key)
            if deleted:
                await store.async_save()
                async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)
            return True
    return False


class ARSmartIRCommandButton(ButtonEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        device_key: str,
        profile: dict[str, Any],
        command_name: str,
    ) -> None:
        self.hass = hass
        self._entry = entry
        self._device_key = device_key
        self._command_name = command_name
        self._device_unique_id = f"{entry.entry_id}_{device_key}"
        self._attr_unique_id = f"{self._device_unique_id}_{command_name}_btn"
        label, icon = BUTTON_COMMANDS.get(command_name, (command_name, "mdi:gesture-tap-button"))
        self._attr_name = label
        self._attr_icon = icon
        self._profile = profile

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._device_unique_id)},
            manufacturer=self._profile.get("manufacturer") or None,
            model=self._profile.get("model") or None,
            name=self._profile.get("name") or self._device_key,
        )

    @property
    def available(self) -> bool:
        return resolve_controller_available(self.hass, self._entry)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "device_key": self._device_key,
            "command": self._command_name,
            "entry_id": self._entry.entry_id,
        }

    def update_profile(self, profile: dict[str, Any]) -> None:
        self._profile = profile

    async def async_press(self) -> None:
        code = self._profile.get("commands", {}).get(self._command_name)
        if not isinstance(code, str) or not code:
            return
        await send_with_policy(
            self.hass,
            self._entry,
            code,
            self._profile,
            self._command_name,
        )
