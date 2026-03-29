from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    CONF_ENTRY_ID,
    CONF_DEVICES,
    CONF_REMOTE_ENTITY,
    DATA_STORE,
    DEFAULT_TITLE,
    DOMAIN,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PLATFORMS,
    SIGNAL_DEVICES_UPDATED,
    SUPPORTED_DEVICE_TYPES,
)
from .storage import ARSmartIRStore, normalize_device

LEARN_SCHEMA = vol.Schema(
    {
        vol.Required("entry_id"): cv.string,
        vol.Required("device_key"): cv.string,
        vol.Required("command_name"): cv.string,
        vol.Optional("broadlink_device"): cv.string,
        vol.Optional("command_type"): vol.In(["ir", "rf"]),
        vol.Optional("alternative"): cv.boolean,
    }
)

EXPORT_SCHEMA = vol.Schema(
    {
        vol.Required("device_key"): cv.string,
    }
)

SAVE_SCHEMA = vol.Schema(
    {
        vol.Required("device_key"): cv.string,
        vol.Optional("entry_id"): cv.string,
        vol.Optional("name"): cv.string,
        vol.Optional("manufacturer"): cv.string,
        vol.Optional("model"): cv.string,
        vol.Optional("device_type"): cv.string,
        vol.Optional("supported_models"): [cv.string],
        vol.Optional("commands_encoding"): cv.string,
        vol.Optional("commands"): dict,
    },
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    await _async_ensure_initialized(hass)
    if CONF_DEVICES not in entry.options:
        hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_DEVICES: {}})
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_ensure_initialized(hass: HomeAssistant) -> None:
    domain_data = hass.data.setdefault(DOMAIN, {})
    if DATA_STORE in domain_data:
        return

    store = ARSmartIRStore(hass)
    await store.async_load()
    domain_data[DATA_STORE] = store
    await _async_migrate_legacy_store(hass, store)

    await _async_register_panel(hass)
    _async_register_services(hass)
    hass.http.register_view(ARSmartIRDataView(hass))


def _build_smartir_export(device_key: str, device: dict[str, Any]) -> dict[str, Any]:
    profile = normalize_device(device)
    supported_models = profile.get("supported_models") or []
    model = profile.get("model") or device_key

    if not supported_models:
        supported_models = [model]

    return {
        "id": device_key,
        "version": 1,
        "minor_version": 1,
        "name": profile.get("name") or device_key,
        "manufacturer": profile.get("manufacturer") or "Unknown",
        "model": model,
        "type": profile.get("device_type") or "ir",
        "supportedModels": supported_models,
        "supportedController": "Broadlink",
        "commandsEncoding": profile.get("commands_encoding") or "Base64",
        "commands": profile.get("commands", {}),
    }


async def _async_get_entry(hass: HomeAssistant, entry_id: str):
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        raise HomeAssistantError("Config entry not found.")
    return entry


async def _async_migrate_legacy_store(hass: HomeAssistant, store: ARSmartIRStore) -> None:
    legacy_path = Path(hass.config.path(".storage", DOMAIN))
    if not legacy_path.exists():
        return

    try:
        legacy_payload = json.loads(legacy_path.read_text())
    except Exception:
        return

    if not isinstance(legacy_payload, dict):
        return

    legacy_data = legacy_payload.get("data", legacy_payload)
    legacy_devices = legacy_data.get("devices", {})
    if not isinstance(legacy_devices, dict) or not legacy_devices:
        return

    migrated = False
    for device_key, device in legacy_devices.items():
        profile = normalize_device(device)
        entry_id = profile.get("entry_id")
        if not entry_id:
            continue
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None:
            continue
        entry_devices = entry.options.get(CONF_DEVICES, {})
        if isinstance(entry_devices, dict) and device_key in entry_devices:
            continue
        await store.upsert_device(entry, device_key, profile)
        migrated = True

    if migrated:
        await store.async_save()
        async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)


def _resolve_device_type(
    requested: str | None,
    existing: dict[str, Any],
    commands: dict[str, Any],
) -> str:
    requested_type = (requested or "").strip().lower()
    if requested_type in SUPPORTED_DEVICE_TYPES:
        return requested_type

    existing_type = str(existing.get("device_type", "")).strip().lower()
    if existing_type in SUPPORTED_DEVICE_TYPES:
        return existing_type

    if requested_type == "tv":
        return "media_player"

    if any(name.startswith("fan_") for name in commands):
        return "fan"

    media_hints = {
        "power",
        "power_on",
        "power_off",
        "volume_up",
        "volume_down",
        "mute",
        "channel_up",
        "channel_down",
        "play",
        "pause",
        "stop",
        "home",
        "back",
        "menu",
        "source",
    }
    if requested_type in {"media_player", "tv"}:
        return "media_player"
    if media_hints & set(commands):
        return "media_player"

    return "climate"


async def _async_register_panel(hass: HomeAssistant) -> None:
    async def register_panel(_) -> None:
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    url_path=f"/api/{DOMAIN}/static",
                    path=str(Path(__file__).parent / "www"),
                    cache_headers=False,
                )
            ]
        )

        async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            frontend_url_path=PANEL_URL_PATH,
            config={
                "_panel_custom": {
                    "name": "ar-smart-ir-panel",
                    "embed_iframe": False,
                    "trust_external_script": True,
                    "js_url": f"/api/{DOMAIN}/static/panel.js?v=6",
                }
            },
            require_admin=True,
        )

    if hass.is_running:
        await register_panel(None)
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, register_panel)


def _async_register_services(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, "learn_and_capture"):
        return

    async def learn(call: ServiceCall) -> dict[str, Any]:
        entry = await _async_get_entry(hass, call.data["entry_id"])
        remote = entry.data.get(CONF_REMOTE_ENTITY)
        if not remote:
            raise HomeAssistantError("Remote entity is not configured for this entry.")

        learn_data: dict[str, Any] = {
            "device": call.data.get("broadlink_device", call.data["device_key"]),
            "command": call.data["command_name"],
        }
        if "command_type" in call.data:
            learn_data["command_type"] = call.data["command_type"]
        if "alternative" in call.data:
            learn_data["alternative"] = call.data["alternative"]

        before_codes = await get_stored_codes(hass)

        await hass.services.async_call(
            "remote",
            "learn_command",
            learn_data,
            target={"entity_id": remote},
            blocking=True,
        )

        code = await get_last_code(hass, before_codes=before_codes)
        if code is None:
            raise HomeAssistantError("No learned code found in Broadlink storage.")

        store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
        device = store.get_device(call.data["device_key"]) or normalize_device()
        device["entry_id"] = call.data["entry_id"]
        device.setdefault("commands", {})[call.data["command_name"]] = code

        await store.upsert_device(entry, call.data["device_key"], device)
        await store.async_save()
        async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)
        return {
            "device_key": call.data["device_key"],
            "command_name": call.data["command_name"],
            "code": code,
        }

    async def export(call: ServiceCall) -> None:
        store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
        device = store.get_device(call.data["device_key"])
        if device is None:
            raise HomeAssistantError("Device not found for the given device key.")

        export_dir = Path(hass.config.path("www", "ar_smart_ir_exports"))
        export_dir.mkdir(parents=True, exist_ok=True)

        file = export_dir / f"{call.data['device_key']}.json"
        export_payload = _build_smartir_export(call.data["device_key"], device)
        file.write_text(json.dumps(export_payload, indent=2))

    async def save_device(call: ServiceCall) -> None:
        store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
        data = dict(call.data)
        device_key = data.pop("device_key")
        entry_id = data.get("entry_id")
        if not entry_id:
            existing = store.get_device(device_key) or {}
            entry_id = existing.get("entry_id")
        if not entry_id:
            raise HomeAssistantError("entry_id is required for saving a profile.")
        entry = await _async_get_entry(hass, entry_id)
        existing = store.get_device(device_key) or {}

        commands = data.get("commands")
        if commands is not None and not isinstance(commands, dict):
            raise HomeAssistantError("commands must be a dictionary.")
        if commands is None:
            commands = existing.get("commands", {})

        data["commands"] = commands
        data["commands_encoding"] = data.get(
            "commands_encoding", existing.get("commands_encoding", "Base64")
        )
        data["device_type"] = _resolve_device_type(
            data.get("device_type"),
            existing,
            commands,
        )

        data["entry_id"] = entry.entry_id
        await store.upsert_device(entry, device_key, data)
        await store.async_save()
        async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)

    hass.services.async_register(
        DOMAIN,
        "learn_and_capture",
        learn,
        schema=LEARN_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(DOMAIN, "save_device", save_device, schema=SAVE_SCHEMA)
    hass.services.async_register(DOMAIN, "export_device", export, schema=EXPORT_SCHEMA)


def _extract_command_candidates(value: Any) -> list[str]:
    candidates: list[str] = []

    if isinstance(value, str):
        if len(value) >= 16 and " " not in value and "\n" not in value:
            candidates.append(value)
        return candidates

    if isinstance(value, dict):
        for item in value.values():
            candidates.extend(_extract_command_candidates(item))
        return candidates

    if isinstance(value, list):
        for item in value:
            candidates.extend(_extract_command_candidates(item))

    return candidates


async def get_stored_codes(hass: HomeAssistant) -> list[str]:
    def read():
        storage_path = Path(hass.config.path(".storage"))
        codes: list[str] = []
        for file in storage_path.glob("broadlink_remote_*"):
            try:
                data = json.loads(file.read_text())
                codes.extend(_extract_command_candidates(data))
            except Exception:
                continue
        return codes

    return await asyncio.to_thread(read)


async def get_last_code(
    hass: HomeAssistant, before_codes: list[str] | None = None, timeout: float = 12.0
):
    baseline = set(before_codes or [])
    deadline = asyncio.get_running_loop().time() + timeout
    latest_seen: str | None = None

    while True:
        codes = await get_stored_codes(hass)
        if codes:
            latest_seen = codes[-1]
            for code in reversed(codes):
                if code not in baseline:
                    return code

        if asyncio.get_running_loop().time() >= deadline:
            return latest_seen

        await asyncio.sleep(1)


class ARSmartIRDataView(HomeAssistantView):
    url = f"/api/{DOMAIN}/data"
    name = f"api:{DOMAIN}:data"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request):
        store: ARSmartIRStore = self.hass.data[DOMAIN][DATA_STORE]

        entries = [
            {
                "entry_id": entry.entry_id,
                "title": entry.title or DEFAULT_TITLE,
                "remote_entity": entry.data.get(CONF_REMOTE_ENTITY),
            }
            for entry in self.hass.config_entries.async_entries(DOMAIN)
        ]

        return self.json(
            {
                "entries": entries,
                "store": store.async_dump(),
                "export_path": self.hass.config.path("www", "ar_smart_ir_exports"),
            }
        )
