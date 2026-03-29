from __future__ import annotations

from copy import deepcopy
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_BROADLINK_DEVICE, CONF_DEVICES, DOMAIN

DEFAULT_DATA: dict[str, Any] = {
    "devices": {},
    "meta": {"version": 1},
}

DEVICE_TYPE_ALIASES = {
    "ac": "climate",
    "aircon": "climate",
    "air_conditioner": "climate",
    "television": "tv",
}


def canonical_device_type(value: Any) -> str:
    raw = str(value or "").strip().lower()
    return DEVICE_TYPE_ALIASES.get(raw, raw)


def normalize_device(device: dict[str, Any] | None = None) -> dict[str, Any]:
    raw = deepcopy(device or {})
    commands = raw.get("commands")
    if not isinstance(commands, dict):
        commands = {}

    supported_models = raw.get("supported_models")
    if not isinstance(supported_models, list):
        supported_models = []

    normalized = {
        "entry_id": raw.get("entry_id"),
        "broadlink_device": raw.get(CONF_BROADLINK_DEVICE, ""),
        "name": raw.get("name", ""),
        "manufacturer": raw.get("manufacturer", ""),
        "model": raw.get("model", ""),
        "device_type": canonical_device_type(raw.get("device_type", "ir")),
        "supported_models": supported_models,
        "commands_encoding": raw.get("commands_encoding", "Base64"),
        "commands": commands,
    }
    return {**raw, **normalized}


class ARSmartIRStore:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.data: dict[str, Any] = deepcopy(DEFAULT_DATA)

    async def async_load(self) -> dict[str, Any]:
        self.data = self._build_from_entries()
        return self.data

    async def async_save(self) -> None:
        self.data = self._build_from_entries()

    def _build_from_entries(self) -> dict[str, Any]:
        devices: dict[str, Any] = {}
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            entry_devices = entry.data.get(CONF_DEVICES, entry.options.get(CONF_DEVICES, {}))
            if not isinstance(entry_devices, dict):
                continue
            for key, device in entry_devices.items():
                normalized = normalize_device(device)
                normalized["entry_id"] = entry.entry_id
                devices[key] = normalized
        return {
            "devices": devices,
            "meta": {"version": 2},
        }

    def async_dump(self) -> dict[str, Any]:
        return deepcopy(self.data)

    def get_device(self, device_key: str) -> dict[str, Any] | None:
        device = self.data.setdefault("devices", {}).get(device_key)
        if device is None:
            return None
        return normalize_device(device)

    async def upsert_device(
        self, entry: ConfigEntry, device_key: str, device: dict[str, Any]
    ) -> dict[str, Any]:
        entry_devices = entry.data.get(CONF_DEVICES, entry.options.get(CONF_DEVICES, {}))
        if not isinstance(entry_devices, dict):
            entry_devices = {}

        existing = normalize_device(entry_devices.get(device_key, {}))
        incoming = normalize_device(device)
        merged = {**existing, **incoming}
        merged["commands"] = {**existing.get("commands", {}), **incoming.get("commands", {})}
        merged["entry_id"] = entry.entry_id
        merged["supported_models"] = incoming.get("supported_models") or existing.get(
            "supported_models", []
        )
        self.data.setdefault("devices", {})[device_key] = merged
        updated_devices = {**entry_devices, device_key: merged}
        updated_data = {**entry.data, CONF_DEVICES: updated_devices}
        updated_options = {**entry.options, CONF_DEVICES: updated_devices}
        self.hass.config_entries.async_update_entry(
            entry,
            data=updated_data,
            options=updated_options,
        )
        return merged

    async def delete_device(self, entry: ConfigEntry, device_key: str) -> bool:
        entry_devices = entry.data.get(CONF_DEVICES, entry.options.get(CONF_DEVICES, {}))
        if not isinstance(entry_devices, dict) or device_key not in entry_devices:
            return False

        updated_devices = dict(entry_devices)
        updated_devices.pop(device_key, None)
        self.data.setdefault("devices", {}).pop(device_key, None)
        updated_data = {**entry.data, CONF_DEVICES: updated_devices}
        updated_options = {**entry.options, CONF_DEVICES: updated_devices}
        self.hass.config_entries.async_update_entry(
            entry,
            data=updated_data,
            options=updated_options,
        )
        return True
