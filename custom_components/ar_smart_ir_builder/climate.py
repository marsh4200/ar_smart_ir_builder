from __future__ import annotations

import asyncio
import logging
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
from homeassistant.helpers import entity_registry as er


async def _async_remove_entity(hass: HomeAssistant, entity) -> None:
    """Remove entity from state machine, entity registry, and device registry."""
    entity_reg = er.async_get(hass)
    device_reg = dr.async_get(hass)

    # Remove from entity registry first (this also removes the device if it has no more entities)
    if entity.registry_entry:
        entity_reg.async_remove(entity.entity_id)
    else:
        await entity.async_remove()

    # Clean up orphaned device entry if no entities remain for it
    if entity.device_entry:
        remaining = er.async_entries_for_device(entity_reg, entity.device_entry.id, include_disabled_entities=True)
        if not remaining:
            device_reg.async_remove_device(entity.device_entry.id)

from .const import DATA_STORE, DOMAIN, SIGNAL_DEVICES_UPDATED, resolve_controller_available, send_with_policy
from .storage import ARSmartIRStore, normalize_device

_LOGGER = logging.getLogger(__name__)
# Shown on the entity as `builder_version` so it's obvious from Developer
# Tools whether Home Assistant was actually restarted onto this code.
BUILDER_VERSION = "1.14.2"
MODE_TEMP_RE = re.compile(r"^(auto|cool|dry|fan_only|heat)_(\d{2})$")

CLIMATE_DEVICE_TYPES = {"climate", "ac", "aircon", "air_conditioner"}
TEMP_PATTERNS = [
    re.compile(r"^(auto|cool|dry|fan_only|heat)_(\d{2})$"),
    re.compile(r"^(?:temp|temperature)_(\d{2})$"),
]

# "Mode + Temp ±" remotes (climate_style == "relative") have a single Mode
# button that steps to the next HVAC mode on each press, rather than a
# discrete button per mode. There is only ever ONE learned code for it
# (mode_toggle) — it is not addressable, it just advances one position, so
# the entity never sends more than one press per interaction and never tries
# to compute a multi-press "jump" to whatever mode was tapped in the UI.
# Selecting a mode in Home Assistant presses Mode once and reports back
# whichever mode that lands on; on a cycle longer than two, that may not be
# the one you tapped — press again to keep stepping, exactly like the
# physical remote. (For a plain two-mode cool/heat unit this is exactly a
# toggle: either selection always lands on the other one.)
#
# Not every remote cycles through the same modes — the actual set and order
# is configurable per profile (profile["relative_modes"], set in the builder
# UI). This is the fallback used when a profile hasn't customised it.
#
# There's no way to read the AC's actual state back from an IR blaster, so
# the entity tracks its own best-guess position in this list and advances it
# by one on every press. If the AC's own memory disagrees with that guess —
# someone used the physical remote, a power cut, etc. — the tracked mode can
# drift from reality until it's re-synced by hand (tap through it again).
RELATIVE_MODE_ORDER: list[HVACMode] = [
    HVACMode.COOL,
    HVACMode.HEAT,
    HVACMode.DRY,
    HVACMode.AUTO,
    HVACMode.FAN_ONLY,
]
# Same idea for a single Fan-speed button and a single Swing button.
RELATIVE_FAN_ORDER = ["low", "medium", "high"]
RELATIVE_SWING_MODES = ["on", "off"]
# Gap between repeated presses of a cycling button, so the AC has time to
# register each one distinctly.
RELATIVE_PRESS_DELAY = 0.35


def _is_fan_only_name(name: str) -> bool:
    return name == "fan_only" or name.startswith("fan_only_")


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
        # Assumed position in the physical remote's cycle for relative-style
        # (Mode + Temp ±) profiles — see RELATIVE_MODE_ORDER above.
        self._relative_mode_index = 0
        self._relative_fan_index = 0
        self._relative_swing_on = False
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
        return resolve_controller_available(self.hass, self._entry)

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
        temperatures = self._available_temperatures(self.hvac_mode)
        return float(min(temperatures)) if temperatures else 16

    @property
    def max_temp(self) -> float:
        temperatures = self._available_temperatures(self.hvac_mode)
        return float(max(temperatures)) if temperatures else 30

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        attrs = {
            "device_key": self._device_key,
            "broadlink_device": self._profile.get("broadlink_device") or self._device_key,
            "entry_id": self._entry.entry_id,
            "profile_type": self._profile.get("device_type"),
            "stored_commands": sorted(self._profile.get("commands", {}).keys()),
            "builder_version": BUILDER_VERSION,
            "control_style": "relative" if self._is_relative() else "per_mode_codes",
            "temperature_codes": self._temperature_codes_by_mode(),
            "last_sent": getattr(self, "_last_sent", None),
        }
        if self._is_relative():
            # Surfaced for debugging cycle drift — see _relative_mode_order().
            order = self._relative_mode_order()
            attrs["relative_style"] = True
            attrs["relative_mode_order"] = [m.value for m in order]
            index = min(self._relative_mode_index, len(order) - 1)
            attrs["assumed_mode"] = order[index].value
            if self._uses_fan_toggle():
                attrs["assumed_fan_mode"] = RELATIVE_FAN_ORDER[self._relative_fan_index]
            if self._uses_swing_toggle():
                attrs["assumed_swing_on"] = self._relative_swing_on
        return attrs

    def update_profile(self, profile: dict[str, Any]) -> None:
        self._profile = profile
        self._attr_name = profile.get("name") or self._device_key
        self._attr_hvac_modes = self._available_hvac_modes()
        if self._is_relative():
            # The configured cycle order may have been edited shorter since
            # the last update — keep the tracked position in range.
            self._relative_mode_index = min(
                self._relative_mode_index, len(self._relative_mode_order()) - 1
            )
        if self._uses_fan_toggle():
            self._attr_fan_modes = RELATIVE_FAN_ORDER
        else:
            self._attr_fan_modes = self._collect_prefixed_values("fan_")
        if self._uses_swing_toggle():
            self._attr_swing_modes = RELATIVE_SWING_MODES
        else:
            self._attr_swing_modes = self._collect_prefixed_values("swing_")
        self._update_supported_features()

    async def async_turn_off(self) -> None:
        await self._send_profile_command("off")
        self._attr_hvac_mode = HVACMode.OFF
        self.async_write_ha_state()

    async def async_turn_on(self) -> None:
        if self._is_relative():
            # The Mode button doesn't power the unit on by itself — that's a
            # separate On/Power button — and it doesn't get pressed here: an
            # AC's own memory typically resumes whatever mode it was last in,
            # and this entity has no way to know better, so it just keeps
            # reporting its last-known assumed mode rather than guessing.
            await self._send_power_on_code()
            order = self._relative_mode_order()
            index = min(self._relative_mode_index, len(order) - 1) if order else 0
            self._attr_hvac_mode = order[index] if order else HVACMode.COOL
            self.async_write_ha_state()
            return

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

        if self._is_relative():
            if self.hvac_mode == HVACMode.OFF:
                await self._send_power_on_code()
            # The button only steps one position per press — see
            # _cycle_mode_to for why this never tries to jump straight to
            # `hvac_mode`.
            await self._cycle_mode_to()
            self.async_write_ha_state()
            return

        # Each mode has its own set of temperature codes (cool_16..cool_30,
        # heat_16..heat_30, ...). Prefer the exact temp in the new mode; if
        # that one wasn't learned, snap to the nearest temp that was for this
        # mode; only then fall back to a bare mode code.
        command_name = self._find_temperature_command_name(hvac_mode, self.target_temperature)
        if command_name is None:
            nearest = self._nearest_mode_temperature(hvac_mode, self.target_temperature)
            if nearest is not None:
                command_name = self._find_temperature_command_name(hvac_mode, nearest)
                if command_name is not None:
                    self._attr_target_temperature = nearest
        if command_name is None and self._find_code(hvac_mode.value) is not None:
            command_name = hvac_mode.value
        if command_name is None:
            return

        await self._send_code(command_name)
        self._attr_hvac_mode = hvac_mode
        self.async_write_ha_state()

    async def async_set_temperature(self, **kwargs: Any) -> None:
        temperature = kwargs.get("temperature")
        if temperature is None:
            return

        temperature = int(round(temperature))
        hvac_mode = kwargs.get("hvac_mode", self.hvac_mode)
        if hvac_mode == HVACMode.OFF:
            hvac_mode = self._relative_mode_order()[0] if self._is_relative() else HVACMode.COOL

        # A learned code for exactly this mode + temperature always wins —
        # it's a full-state code, so it lands on the right value regardless
        # of what the AC was doing before. Temp +/- stepping is only the
        # fallback for temps that weren't learned (or for relative remotes).
        direct = self._find_temperature_command_name(hvac_mode, temperature)
        if direct is not None:
            await self._send_code(direct)
            self._attr_target_temperature = temperature
            self._attr_hvac_mode = hvac_mode
            self.async_write_ha_state()
            return

        if self._uses_temp_step():
            temperature = max(int(self.min_temp), min(int(self.max_temp), temperature))
            current = int(round(self._attr_target_temperature or temperature))
            delta = temperature - current
            command_name = "temp_up" if delta > 0 else "temp_down"
            if delta != 0 and self._find_code(command_name) is not None:
                await self._press_n_times(command_name, abs(delta))
            self._attr_target_temperature = temperature
            if hvac_mode != self.hvac_mode:
                await self.async_set_hvac_mode(hvac_mode)
            else:
                self.async_write_ha_state()
            return

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
        if self._uses_fan_toggle():
            if fan_mode not in RELATIVE_FAN_ORDER:
                return
            target_index = RELATIVE_FAN_ORDER.index(fan_mode)
            steps = (target_index - self._relative_fan_index) % len(RELATIVE_FAN_ORDER)
            if steps:
                await self._press_n_times("fan_toggle", steps)
            self._relative_fan_index = target_index
            self._attr_fan_mode = fan_mode
            self.async_write_ha_state()
            return

        await self._send_profile_command(f"fan_{fan_mode}")
        self._attr_fan_mode = fan_mode
        self.async_write_ha_state()

    async def async_set_swing_mode(self, swing_mode: str) -> None:
        if self._uses_swing_toggle():
            desired_on = swing_mode == "on"
            if desired_on != self._relative_swing_on:
                await self._send_code("swing_toggle")
                self._relative_swing_on = desired_on
            self._attr_swing_mode = swing_mode
            self.async_write_ha_state()
            return

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
        if self._uses_temp_step():
            return True
        for name in self._profile.get("commands", {}):
            if self._find_temperature_match(name) is not None:
                return True
        return False

    def _available_hvac_modes(self) -> list[HVACMode]:
        modes = [HVACMode.OFF]

        if self._is_relative():
            modes.extend(self._relative_mode_order())
            return modes

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

    # --- relative-style (Mode + Temp ±) helpers --------------------------- #

    def _commands(self) -> dict[str, Any]:
        return self._profile.get("commands", {})

    def _has_discrete_modes(self) -> bool:
        commands = self._commands()
        return any(
            name in commands or any(n.startswith(f"{name}_") for n in commands)
            for name in ("cool", "heat", "dry", "fan_only", "auto")
        )

    def _has_mode_temp_codes(self) -> bool:
        """True once any full-state <mode>_<temp> code (cool_18, heat_22) is learned."""
        return any(MODE_TEMP_RE.match(name) for name in self._commands())

    def _is_relative(self) -> bool:
        # Learned per-mode temperature codes are full-state codes — each one
        # sets mode AND temp in a single blast — so they always win over the
        # Mode-cycle / Temp +/- stepping, even if the profile was saved as
        # "Mode + Temp ±". Otherwise every cool_XX / heat_XX would be ignored.
        if self._has_mode_temp_codes():
            return False
        if str(self._profile.get("climate_style", "")).lower() == "relative":
            return True
        # Fallback for profiles saved before climate_style existed.
        return "mode_toggle" in self._commands() and not self._has_discrete_modes()

    def _relative_mode_order(self) -> list[HVACMode]:
        """This profile's Mode-button cycle, or the default if unset."""
        modes: list[HVACMode] = []
        for name in self._profile.get("relative_modes") or []:
            try:
                modes.append(HVACMode(name))
            except ValueError:
                continue
        return modes or RELATIVE_MODE_ORDER

    def _uses_fan_toggle(self) -> bool:
        commands = self._commands()
        return "fan_toggle" in commands and not any(
            name.startswith("fan_") and name != "fan_toggle" and not _is_fan_only_name(name)
            for name in commands
        )

    def _uses_swing_toggle(self) -> bool:
        commands = self._commands()
        return "swing_toggle" in commands and not any(
            name.startswith("swing_") and name != "swing_toggle" for name in commands
        )

    def _uses_temp_step(self) -> bool:
        commands = self._commands()
        return "temp_up" in commands or "temp_down" in commands

    async def _press_n_times(self, command_name: str, times: int) -> None:
        for i in range(max(0, times)):
            await self._send_code(command_name)
            if i < times - 1:
                await asyncio.sleep(RELATIVE_PRESS_DELAY)

    async def _send_power_on_code(self) -> bool:
        """Best-effort power-on for a relative/toggle remote."""
        for name in ("on", "power_toggle", "power"):
            if self._find_code(name):
                await self._send_code(name)
                return True
        return False

    async def _cycle_mode_to(self) -> None:
        """Press Mode exactly once and report whichever mode that lands on.

        The physical button can't be commanded to a specific mode — it only
        ever steps forward one position — so this never sends more than one
        press no matter what was requested. On a two-mode remote that's
        already a true toggle: either selection always lands on the other
        one. On a longer cycle, reaching a mode further away just takes
        picking it again (each tap = one more physical press), the same as
        working the real remote by hand.
        """
        order = self._relative_mode_order()
        if not order:
            return
        await self._press_n_times("mode_toggle", 1)
        index = min(self._relative_mode_index, len(order) - 1)
        index = (index + 1) % len(order)
        self._relative_mode_index = index
        self._attr_hvac_mode = order[index]

    def _available_temperatures(self, hvac_mode: HVACMode | None = None) -> list[int]:
        """Learned temperatures — for one mode if it has its own set.

        Each mode can carry its own range (cool_16..cool_30 vs heat_16..
        heat_30), so the slider range follows the current mode. Generic
        temp_NN codes count for every mode. Falls back to all modes combined
        when the current mode has no per-temperature codes.
        """
        all_temps: set[int] = set()
        mode_temps: set[int] = set()
        mode_value = hvac_mode.value if isinstance(hvac_mode, HVACMode) else None
        for name in self._profile.get("commands", {}):
            match = self._find_temperature_match(name)
            if match is None:
                continue
            all_temps.add(match)
            if mode_value and (
                name.startswith(f"{mode_value}_") or not TEMP_PATTERNS[0].match(name)
            ):
                mode_temps.add(match)
        return sorted(mode_temps or all_temps)

    def _temperature_codes_by_mode(self) -> dict[str, str]:
        """e.g. {"cool": "16-30 (15)", "heat": "16-30 (15)"} for diagnostics."""
        by_mode: dict[str, list[int]] = {}
        for name in self._commands():
            m = MODE_TEMP_RE.match(name)
            if m:
                by_mode.setdefault(m.group(1), []).append(int(m.group(2)))
        return {
            mode: f"{min(t)}-{max(t)} ({len(t)})" for mode, t in sorted(by_mode.items())
        }

    def _nearest_mode_temperature(
        self, hvac_mode: HVACMode, temperature: float | None
    ) -> int | None:
        temps = self._available_temperatures(hvac_mode)
        if not temps:
            return None
        target = temperature if temperature is not None else 24
        return min(temps, key=lambda t: (abs(t - target), t))

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
            if not name.startswith(prefix):
                continue
            if _is_fan_only_name(name):
                # "fan_only" / "fan_only_24" are an HVAC mode and its temp
                # codes, not a fan speed called "only".
                continue
            value = name[len(prefix) :]
            if value == "toggle":
                # e.g. "fan_toggle" / "swing_toggle" — a single cycling
                # button, not a discrete mode named "toggle". Handled
                # separately via _uses_fan_toggle / _uses_swing_toggle.
                continue
            values.append(value)
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
        code = self._find_code(command_name)
        if not code:
            _LOGGER.warning("%s: no learned code for '%s'", self.entity_id, command_name)
            return
        _LOGGER.debug("%s: sending '%s'", self.entity_id, command_name)
        self._last_sent = command_name
        await send_with_policy(
            self.hass,
            self._entry,
            code,
            self._profile,
            command_name,
        )
