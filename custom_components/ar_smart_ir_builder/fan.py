from __future__ import annotations

from typing import Any

from homeassistant.components.fan import FanEntity, FanEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er


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

from .const import DATA_STORE, DOMAIN, SIGNAL_DEVICES_UPDATED, resolve_remote_entity, send_with_policy
from .storage import ARSmartIRStore, normalize_device

FAN_DEVICE_TYPES = {"fan", "ceiling_fan", "pedestal_fan", "tower_fan"}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
    entities: dict[str, ARSmartIRFanEntity] = {}

    @callback
    def sync_entities() -> None:
        desired: dict[str, dict[str, Any]] = {}
        for device_key, device in store.async_dump().get("devices", {}).items():
            profile = normalize_device(device)
            if profile.get("entry_id") != entry.entry_id:
                continue
            if not _is_fan_profile(profile):
                continue
            desired[device_key] = profile

        new_entities: list[ARSmartIRFanEntity] = []
        for device_key, profile in desired.items():
            if device_key in entities:
                entities[device_key].update_profile(profile)
                entities[device_key].async_write_ha_state()
                continue
            entity = ARSmartIRFanEntity(hass, entry, device_key, profile)
            entities[device_key] = entity
            new_entities.append(entity)

        for device_key in list(entities):
            if device_key in desired:
                continue
            entity = entities.pop(device_key)
            hass.async_create_task(_async_remove_entity(hass, entity))

        if new_entities:
            async_add_entities(new_entities)

    sync_entities()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_DEVICES_UPDATED, sync_entities))


async def async_remove_config_entry_device(
    hass: HomeAssistant, config_entry: ConfigEntry, device_entry: dr.DeviceEntry
) -> bool:
    """Allow removing a device (profile) from the UI three-dot menu."""
    from homeassistant.helpers.dispatcher import async_dispatcher_send
    store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
    for identifier in device_entry.identifiers:
        if identifier[0] != DOMAIN:
            continue
        unique_id = identifier[1]
        # fan unique_id format: {entry_id}_{device_key}_fan
        prefix = config_entry.entry_id + "_"
        suffix = "_fan"
        if unique_id.startswith(prefix) and unique_id.endswith(suffix):
            device_key = unique_id[len(prefix):-len(suffix)]
            deleted = await store.delete_device(config_entry, device_key)
            if deleted:
                await store.async_save()
                async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)
            return True
    return False


def _is_fan_profile(profile: dict[str, Any]) -> bool:
    device_type = str(profile.get("device_type", "")).lower()
    if device_type in FAN_DEVICE_TYPES:
        return True
    if device_type:
        return False

    command_names = set(profile.get("commands", {}))
    return any(name.startswith("fan_") for name in command_names)


class ARSmartIRFanEntity(FanEntity):
    _attr_should_poll = False
    _attr_has_entity_name = False

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        device_key: str,
        profile: dict[str, Any],
    ) -> None:
        self.hass = hass
        self._entry = entry
        self._device_key = device_key
        self._profile = profile
        self._attr_unique_id = f"{entry.entry_id}_{device_key}_fan"
        self._attr_name = profile.get("name") or device_key
        self._attr_is_on = False
        self._attr_preset_mode = None
        self.update_profile(profile)

    @property
    def name(self) -> str | None:
        return self._profile.get("name") or self._device_key

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._attr_unique_id)},
            manufacturer=self._profile.get("manufacturer") or None,
            model=self._profile.get("model") or None,
            name=self.name,
        )

    @property
    def available(self) -> bool:
        remote_entity = resolve_remote_entity(self._entry)
        if not remote_entity:
            return False
        state = self.hass.states.get(remote_entity)
        return state is not None and state.state not in {"unavailable", "unknown"}

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "device_key": self._device_key,
            "broadlink_device": self._profile.get("broadlink_device") or self._device_key,
            "entry_id": self._entry.entry_id,
            "profile_type": self._profile.get("device_type"),
            "stored_commands": sorted(self._profile.get("commands", {}).keys()),
        }

    def update_profile(self, profile: dict[str, Any]) -> None:
        self._profile = profile
        self._attr_name = profile.get("name") or self._device_key
        self._attr_preset_modes = self._collect_presets()
        self._attr_supported_features = FanEntityFeature.TURN_ON | FanEntityFeature.TURN_OFF
        if self._attr_preset_modes:
            self._attr_supported_features |= FanEntityFeature.PRESET_MODE

    async def async_turn_on(
        self,
        percentage: int | None = None,
        preset_mode: str | None = None,
        **kwargs: Any,
    ) -> None:
        if preset_mode:
            await self.async_set_preset_mode(preset_mode)
            return

        code = self._find_code("on")
        if code is None and self._attr_preset_modes:
            preset_mode = self._attr_preset_modes[0]
            code = self._find_code(f"fan_{preset_mode}")
            self._attr_preset_mode = preset_mode

        if code is None:
            return

        await self._send_code("on" if self._find_code("on") is not None else f"fan_{preset_mode}")
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        code = self._find_code("off")
        if code is None:
            return
        await self._send_code("off")
        self._attr_is_on = False
        self.async_write_ha_state()

    async def async_set_preset_mode(self, preset_mode: str) -> None:
        code = self._find_code(f"fan_{preset_mode}")
        if code is None:
            return
        await self._send_code(f"fan_{preset_mode}")
        self._attr_is_on = True
        self._attr_preset_mode = preset_mode
        self.async_write_ha_state()

    def _collect_presets(self) -> list[str]:
        return [
            name.removeprefix("fan_")
            for name in sorted(self._profile.get("commands", {}))
            if name.startswith("fan_")
        ]

    def _find_code(self, command_name: str) -> str | None:
        command = self._profile.get("commands", {}).get(command_name)
        return command if isinstance(command, str) and command else None

    async def _send_code(self, command_name: str) -> None:
        code = self._find_code(command_name)
        if not code:
            return
        await send_with_policy(
            self.hass,
            resolve_remote_entity(self._entry),
            code,
            self._profile,
            command_name,
        )
