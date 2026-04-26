from __future__ import annotations

import re
from typing import Any

from homeassistant.components.climate import ClimateEntity
from homeassistant.components.climate.const import ClimateEntityFeature, HVACAction, HVACMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from homeassistant.helpers import device_registry as dr

from .const import DATA_STORE, DEFAULT_TITLE, DOMAIN, SIGNAL_DEVICES_UPDATED, resolve_remote_entity
from .storage import ARSmartIRStore, normalize_device

CLIMATE_DEVICE_TYPES = {"climate", "ac", "aircon", "air_conditioner"}
TEMP_PATTERNS = [
    re.compile(r"^(auto|cool|dry|fan_only|heat)_(\d{2})$"),
    re.compile(r"^(?:temp|temperature)_(\d{2})$"),
]


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
    entities: dict[str, ARSmartIRClimateEntity] = {}

    @callback
    def sync_entities() -> None:
        desired: dict[str, dict[str, Any]] = {}
        for device_key, device in store.async_dump().get("devices", {}).items():
            profile = normalize_device(device)
            if profile.get("entry_id") != entry.entry_id:
                continue
            if not _is_climate_profile(profile):
                continue
            desired[device_key] = profile

        new_entities: list[ARSmartIRClimateEntity] = []
        for device_key, profile in desired.items():
            if device_key in entities:
                entities[device_key].update_profile(profile)
                entities[device_key].async_write_ha_state()
                continue
            entity = ARSmartIRClimateEntity(hass, entry, device_key, profile)
            entities[device_key] = entity
            new_entities.append(entity)

        for device_key in list(entities):
            if device_key in desired:
                continue
            entity = entities.pop(device_key)
            hass.async_create_task(entity.async_remove())

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
    # Find the device_key that matches this device entry
    for identifier in device_entry.identifiers:
        if identifier[0] != DOMAIN:
            continue
        unique_id = identifier[1]
        # unique_id format: {entry_id}_{device_key}
        prefix = config_entry.entry_id + "_"
        if unique_id.startswith(prefix):
            device_key = unique_id[len(prefix):]
            deleted = await store.delete_device(config_entry, device_key)
            if deleted:
                await store.async_save()
                async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)
            return True
    return False


def _is_climate_profile(profile: dict[str, Any]) -> bool:
    device_type = str(profile.get("device_type", "")).lower()
    if device_type in CLIMATE_DEVICE_TYPES:
        return True
    if device_type:
        return False

    command_names = set(profile.get("commands", {}))
    if {"off", "cool", "heat", "dry", "fan_only", "auto"} & command_names:
        return True

    return any(pattern.match(name) for name in command_names for pattern in TEMP_PATTERNS)


class ARSmartIRClimateEntity(ClimateEntity):
    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_target_temperature_step = 1
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
        self._attr_unique_id = f"{entry.entry_id}_{device_key}"
        self._attr_name = profile.get("name") or device_key
        self._attr_hvac_mode = HVACMode.OFF
        self._attr_target_temperature = 24
        self._attr_fan_mode = None
        self._attr_swing_mode = None
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
    def hvac_action(self) -> HVACAction | None:
        if self.hvac_mode == HVACMode.OFF:
            return HVACAction.OFF
        if self.hvac_mode == HVACMode.COOL:
            return HVACAction.COOLING
        if self.hvac_mode == HVACMode.HEAT:
            return HVACAction.HEATING
        if self.hvac_mode == HVACMode.DRY:
            return HVACAction.DRYING
        if self.hvac_mode == HVACMode.FAN_ONLY:
            return HVACAction.FAN
        return HVACAction.IDLE

    @property
    def min_temp(self) -> float:
        temperatures = self._available_temperatures()
        return float(min(temperatures)) if temperatures else 16

    @property
    def max_temp(self) -> float:
        temperatures = self._available_temperatures()
        return float(max(temperatures)) if temperatures else 30

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
        self._attr_hvac_modes = self._available_hvac_modes()
        self._attr_fan_modes = self._collect_prefixed_values("fan_")
        self._attr_swing_modes = self._collect_prefixed_values("swing_")
        self._update_supported_features()

    async def async_turn_off(self) -> None:
        await self._send_profile_command("off")
        self._attr_hvac_mode = HVACMode.OFF
        self.async_write_ha_state()

    async def async_turn_on(self) -> None:
        target_mode = self.hvac_mode if self.hvac_mode != HVACMode.OFF else HVACMode.COOL
        code = self._find_code("on") or self._find_temperature_code(target_mode, self.target_temperature)
        if code is None:
            code = self._find_code(target_mode.value)
        if code is None:
            return
        command_name = "on" if self._find_code("on") is not None else target_mode.value
        await self._send_code(command_name)
        self._attr_hvac_mode = target_mode
        self.async_write_ha_state()

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        if hvac_mode == HVACMode.OFF:
            await self.async_turn_off()
            return

        code = self._find_temperature_code(hvac_mode, self.target_temperature) or self._find_code(
            hvac_mode.value
        )
        if code is None:
            return

        await self._send_code(
            self._find_temperature_command_name(hvac_mode, self.target_temperature) or hvac_mode.value
        )
        self._attr_hvac_mode = hvac_mode
        self.async_write_ha_state()

    async def async_set_temperature(self, **kwargs: Any) -> None:
        temperature = kwargs.get("temperature")
        if temperature is None:
            return

        temperature = int(round(temperature))
        hvac_mode = kwargs.get("hvac_mode", self.hvac_mode)
        if hvac_mode == HVACMode.OFF:
            hvac_mode = HVACMode.COOL

        code = self._find_temperature_code(hvac_mode, temperature)
        if code is None:
            code = self._find_code(f"temp_{temperature}") or self._find_code(
                f"temperature_{temperature}"
            )
        if code is None:
            return

        await self._send_code(
            self._find_temperature_command_name(hvac_mode, temperature)
            or f"temp_{temperature}"
            or f"temperature_{temperature}"
        )
        self._attr_target_temperature = temperature
        self._attr_hvac_mode = hvac_mode
        self.async_write_ha_state()

    async def async_set_fan_mode(self, fan_mode: str) -> None:
        await self._send_profile_command(f"fan_{fan_mode}")
        self._attr_fan_mode = fan_mode
        self.async_write_ha_state()

    async def async_set_swing_mode(self, swing_mode: str) -> None:
        await self._send_profile_command(f"swing_{swing_mode}")
        self._attr_swing_mode = swing_mode
        self.async_write_ha_state()

    def _update_supported_features(self) -> None:
        features = ClimateEntityFeature.TURN_ON | ClimateEntityFeature.TURN_OFF
        if self._supports_temperature():
            features |= ClimateEntityFeature.TARGET_TEMPERATURE
        if self._attr_fan_modes:
            features |= ClimateEntityFeature.FAN_MODE
        if self._attr_swing_modes:
            features |= ClimateEntityFeature.SWING_MODE
        self._attr_supported_features = features

    def _supports_temperature(self) -> bool:
        for name in self._profile.get("commands", {}):
            if self._find_temperature_match(name) is not None:
                return True
        return False

    def _available_hvac_modes(self) -> list[HVACMode]:
        modes = [HVACMode.OFF]
        command_names = set(self._profile.get("commands", {}))
        mode_map = {
            HVACMode.AUTO: "auto",
            HVACMode.COOL: "cool",
            HVACMode.HEAT: "heat",
            HVACMode.DRY: "dry",
            HVACMode.FAN_ONLY: "fan_only",
        }
        for hvac_mode, command_name in mode_map.items():
            if command_name in command_names or any(
                name.startswith(f"{command_name}_") for name in command_names
            ):
                modes.append(hvac_mode)
        if len(modes) == 1:
            modes.append(HVACMode.COOL)
        return modes

    def _available_temperatures(self) -> list[int]:
        temperatures: set[int] = set()
        for name in self._profile.get("commands", {}):
            match = self._find_temperature_match(name)
            if match is not None:
                temperatures.add(match)
        return sorted(temperatures)

    def _find_temperature_match(self, command_name: str) -> int | None:
        for pattern in TEMP_PATTERNS:
            match = pattern.match(command_name)
            if not match:
                continue
            return int(match.groups()[-1])
        return None

    def _collect_prefixed_values(self, prefix: str) -> list[str]:
        values = []
        for name in sorted(self._profile.get("commands", {})):
            if name.startswith(prefix):
                values.append(name[len(prefix) :])
        return values

    def _find_temperature_code(self, hvac_mode: HVACMode, temperature: float | None) -> str | None:
        if temperature is None:
            return None
        temp = int(round(temperature))
        candidates = [
            f"{hvac_mode.value}_{temp}",
            f"{hvac_mode.value}_{temp:02d}",
            f"temperature_{temp}",
            f"temp_{temp}",
        ]
        for candidate in candidates:
            code = self._find_code(candidate)
            if code is not None:
                return code
        return None

    def _find_temperature_command_name(
        self, hvac_mode: HVACMode, temperature: float | None
    ) -> str | None:
        if temperature is None:
            return None
        temp = int(round(temperature))
        candidates = [
            f"{hvac_mode.value}_{temp}",
            f"{hvac_mode.value}_{temp:02d}",
            f"temperature_{temp}",
            f"temp_{temp}",
        ]
        for candidate in candidates:
            if self._find_code(candidate) is not None:
                return candidate
        return None

    def _find_code(self, command_name: str) -> str | None:
        command = self._profile.get("commands", {}).get(command_name)
        return command if isinstance(command, str) and command else None

    async def _send_profile_command(self, command_name: str) -> None:
        code = self._find_code(command_name)
        if code is None:
            return
        await self._send_code(command_name)

    async def _send_code(self, command_name: str) -> None:
        await self.hass.services.async_call(
            "remote",
            "send_command",
            {
                "device": self._profile.get("broadlink_device") or self._device_key,
                "command": command_name,
            },
            target={"entity_id": resolve_remote_entity(self._entry)},
            blocking=True,
        )
