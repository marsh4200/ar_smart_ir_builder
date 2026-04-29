from __future__ import annotations

from typing import Any

from homeassistant.components.media_player import MediaPlayerEntity
from homeassistant.components.media_player.const import (
    MediaPlayerEntityFeature,
    MediaPlayerState,
    MediaType,
)
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

from .const import DATA_STORE, DOMAIN, SIGNAL_DEVICES_UPDATED, resolve_remote_entity
from .storage import ARSmartIRStore, normalize_device

MEDIA_PLAYER_DEVICE_TYPES = {"media_player", "tv", "television"}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
    entities: dict[str, ARSmartIRMediaPlayerEntity] = {}

    @callback
    def sync_entities() -> None:
        desired: dict[str, dict[str, Any]] = {}
        for device_key, device in store.async_dump().get("devices", {}).items():
            profile = normalize_device(device)
            if profile.get("entry_id") != entry.entry_id:
                continue
            if not _is_media_player_profile(profile):
                continue
            desired[device_key] = profile

        new_entities: list[ARSmartIRMediaPlayerEntity] = []
        for device_key, profile in desired.items():
            if device_key in entities:
                entities[device_key].update_profile(profile)
                entities[device_key].async_write_ha_state()
                continue
            entity = ARSmartIRMediaPlayerEntity(hass, entry, device_key, profile)
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
        # media_player unique_id format: {entry_id}_{device_key}_media_player
        prefix = config_entry.entry_id + "_"
        suffix = "_media_player"
        if unique_id.startswith(prefix) and unique_id.endswith(suffix):
            device_key = unique_id[len(prefix):-len(suffix)]
            deleted = await store.delete_device(config_entry, device_key)
            if deleted:
                await store.async_save()
                async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)
            return True
    return False


def _is_media_player_profile(profile: dict[str, Any]) -> bool:
    device_type = str(profile.get("device_type", "")).lower()
    if device_type in MEDIA_PLAYER_DEVICE_TYPES:
        return True

    command_names = set(profile.get("commands", {}))
    media_commands = {
        "power",
        "power_on",
        "power_off",
        "play",
        "pause",
        "stop",
        "mute",
        "volume_up",
        "volume_down",
        "channel_up",
        "channel_down",
        "next",
        "previous",
        "home",
        "back",
        "menu",
        "ok",
    }
    return bool(media_commands & command_names)


class ARSmartIRMediaPlayerEntity(MediaPlayerEntity):
    _attr_should_poll = False
    _attr_has_entity_name = False
    _is_volume_muted = False

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
        self._attr_unique_id = f"{entry.entry_id}_{device_key}_media_player"
        self._attr_name = profile.get("name") or device_key
        self._attr_state = MediaPlayerState.OFF
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
    def state(self) -> MediaPlayerState | None:
        return self._attr_state

    @property
    def volume_level(self) -> float | None:
        return None

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
        self._attr_supported_features = self._detect_features()

    async def async_turn_on(self) -> None:
        if await self._send_first(("power_on", "power", "on")):
            self._attr_state = MediaPlayerState.ON
            self.async_write_ha_state()

    async def async_turn_off(self) -> None:
        if await self._send_first(("power_off", "power", "off")):
            self._attr_state = MediaPlayerState.OFF
            self.async_write_ha_state()

    async def async_media_play(self) -> None:
        if await self._send_first(("play",)):
            self._attr_state = MediaPlayerState.PLAYING
            self.async_write_ha_state()

    async def async_media_pause(self) -> None:
        if await self._send_first(("pause",)):
            self._attr_state = MediaPlayerState.PAUSED
            self.async_write_ha_state()

    async def async_media_stop(self) -> None:
        if await self._send_first(("stop",)):
            self._attr_state = MediaPlayerState.IDLE
            self.async_write_ha_state()

    async def async_media_next_track(self) -> None:
        await self._send_first(("next", "channel_up"))

    async def async_media_previous_track(self) -> None:
        await self._send_first(("previous", "channel_down"))

    async def async_volume_up(self) -> None:
        if await self._send_first(("volume_up",)):
            self.async_write_ha_state()

    async def async_volume_down(self) -> None:
        if await self._send_first(("volume_down",)):
            self.async_write_ha_state()

    async def async_mute_volume(self, mute: bool) -> None:
        if await self._send_first(("mute",)):
            self._is_volume_muted = mute
            self.async_write_ha_state()

    async def async_play_media(
        self, media_type: MediaType | str, media_id: str, **kwargs: Any
    ) -> None:
        command_name = self._resolve_media_command_name(media_id)
        if command_name and await self._send_first((command_name,)):
            self._attr_state = MediaPlayerState.ON
            self.async_write_ha_state()

    async def async_select_source(self, source: str) -> None:
        command_name = self._resolve_source_command_name(source)
        if command_name and await self._send_first((command_name,)):
            self.async_write_ha_state()

    async def async_media_seek(self, position: float) -> None:
        return None

    @property
    def source_list(self) -> list[str] | None:
        sources = list(self._source_map())
        return sources or None

    def _detect_features(self) -> MediaPlayerEntityFeature:
        features = MediaPlayerEntityFeature(0)
        commands = set(self._profile.get("commands", {}))

        if {"power", "power_on", "on"} & commands:
            features |= MediaPlayerEntityFeature.TURN_ON
        if {"power", "power_off", "off"} & commands:
            features |= MediaPlayerEntityFeature.TURN_OFF
        if "play" in commands:
            features |= MediaPlayerEntityFeature.PLAY
        if "pause" in commands:
            features |= MediaPlayerEntityFeature.PAUSE
        if "stop" in commands:
            features |= MediaPlayerEntityFeature.STOP
        if "volume_up" in commands or "volume_down" in commands:
            features |= MediaPlayerEntityFeature.VOLUME_STEP
        if "mute" in commands:
            features |= MediaPlayerEntityFeature.VOLUME_MUTE
        if {"next", "channel_up"} & commands:
            features |= MediaPlayerEntityFeature.NEXT_TRACK
        if {"previous", "channel_down"} & commands:
            features |= MediaPlayerEntityFeature.PREVIOUS_TRACK
        if self._source_map():
            features |= MediaPlayerEntityFeature.SELECT_SOURCE
        if self._play_media_map():
            features |= MediaPlayerEntityFeature.PLAY_MEDIA
        return features

    def _display_label(self, command_name: str) -> str:
        return command_name.replace("_", " ").title()

    def _source_map(self) -> dict[str, str]:
        labels: dict[str, str] = {}
        for command_name in sorted(self._profile.get("commands", {})):
            if command_name.startswith("source_"):
                labels[self._display_label(command_name.removeprefix("source_"))] = command_name
                continue
            if command_name in {"hdmi1", "hdmi2", "hdmi3", "hdmi4", "tv", "av", "aux"}:
                labels[self._display_label(command_name)] = command_name
        return labels

    def _play_media_map(self) -> dict[str, str]:
        labels: dict[str, str] = {}
        for command_name in sorted(self._profile.get("commands", {})):
            if command_name.startswith("app_"):
                labels[self._display_label(command_name.removeprefix("app_"))] = command_name
                continue
            if command_name in {"netflix", "youtube", "prime_video", "disney_plus"}:
                labels[self._display_label(command_name)] = command_name
        return labels

    def _resolve_source_command_name(self, source: str) -> str | None:
        normalized = str(source).strip().lower().replace(" ", "_")
        source_map = self._source_map()
        if source in source_map:
            return source_map[source]
        candidates = (
            f"source_{normalized}",
            normalized,
        )
        for candidate in candidates:
            if self._find_code(candidate) is not None:
                return candidate
        for label, command_name in source_map.items():
            if label.lower().replace(" ", "_") == normalized:
                return command_name
        return None

    def _resolve_media_command_name(self, media_id: str) -> str | None:
        normalized = str(media_id).strip().lower().replace(" ", "_")
        play_media_map = self._play_media_map()
        source_map = self._source_map()
        for mapping in (play_media_map, source_map):
            for label, command_name in mapping.items():
                if label.lower().replace(" ", "_") == normalized:
                    return command_name
        candidates = (
            normalized,
            f"app_{normalized}",
            f"source_{normalized}",
        )
        for candidate in candidates:
            if self._find_code(candidate) is not None:
                return candidate
        return None

    def _find_code(self, command_name: str) -> str | None:
        command = self._profile.get("commands", {}).get(command_name)
        return command if isinstance(command, str) and command else None

    async def _send_first(self, command_names: tuple[str, ...]) -> bool:
        for command_name in command_names:
            if self._find_code(command_name) is None:
                continue
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
            return True
        return False
