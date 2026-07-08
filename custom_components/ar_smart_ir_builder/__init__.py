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
    CONTROLLER_TASMOTA_MQTT,
    resolve_controller_type,
    resolve_mqtt_base_topic,
)
from .storage import ARSmartIRStore, find_duplicate_command, normalize_device
from .smartir_export import SmartIRExportError, build_codeset

# ar_smart_ir codes/<platform> folder -> the label shown on the first screen of
# the ar_smart_ir add-device flow. Used so the export tells the user exactly
# which device type to pick.
_SMARTIR_PLATFORM_LABELS = {
    "climate": "Climate",
    "fan": "Fan",
    "light": "Light",
    "media_player": "Media Player",
}

LEARN_SCHEMA = vol.Schema(
    {
        vol.Required("entry_id"): cv.string,
        vol.Required("device_key"): cv.string,
        vol.Required("command_name"): cv.string,
        vol.Optional("broadlink_device"): cv.string,
        vol.Optional("command_type"): vol.In(["ir", "rf"]),
        vol.Optional("alternative"): cv.boolean,
        vol.Optional("learn_timeout"): vol.Coerce(float),
    }
)

EXPORT_SCHEMA = vol.Schema(
    {
        vol.Required("device_key"): cv.string,
    }
)

DELETE_SCHEMA = vol.Schema(
    {
        vol.Required("device_key"): cv.string,
        vol.Optional("entry_id"): cv.string,
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
        vol.Optional("command_options"): dict,
    },
    extra=vol.ALLOW_EXTRA,
)

TEST_SCHEMA = vol.Schema(
    {
        vol.Required("entry_id"): cv.string,
        vol.Required("device_key"): cv.string,
        vol.Required("command_name"): cv.string,
    }
)


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    try:
        await _async_ensure_initialized(hass)
    except Exception:
        pass

    if CONF_DEVICES not in entry.options:
        hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_DEVICES: {}})

    try:
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    except Exception:
        pass

    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry) -> None:
    """Clean up when a config entry is deleted from the UI."""
    try:
        await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    except Exception:
        pass

    from homeassistant.helpers import entity_registry as er, device_registry as dr
    entity_reg = er.async_get(hass)
    device_reg = dr.async_get(hass)

    # Remove all entities belonging to this config entry from the entity registry
    for entity_entry in er.async_entries_for_config_entry(entity_reg, entry.entry_id):
        entity_reg.async_remove(entity_entry.entity_id)

    # Remove all devices belonging to this config entry from the device registry
    for device_entry in dr.async_entries_for_config_entry(device_reg, entry.entry_id):
        device_reg.async_remove_device(device_entry.id)

    # Wipe in-memory store
    domain_data = hass.data.get(DOMAIN, {})
    store: ARSmartIRStore | None = domain_data.get(DATA_STORE)
    if store is not None:
        for device_key, device in list(store.data.get("devices", {}).items()):
            if device.get("entry_id") == entry.entry_id:
                store.data.setdefault("devices", {}).pop(device_key, None)


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


def _build_ha_scripts_export(
    device_key: str, device: dict[str, Any], controller: str, mqtt_base_topic: str | None
) -> str:
    """Build a Home Assistant scripts.yaml snippet for every learned command."""
    profile = normalize_device(device)
    name = profile.get("name") or device_key
    commands = profile.get("commands", {})

    lines: list[str] = []
    lines.append(f"# AR Smart IR — {name} ({device_key})")
    lines.append(f"# Generated by AR Smart IR Builder v1.6.0")

    if controller == CONTROLLER_TASMOTA_MQTT:
        topic = mqtt_base_topic or "REPLACE_WITH_YOUR_TASMOTA_TOPIC"
        lines.append(f"# Tasmota MQTT topic: {topic}")
        lines.append("")
        for cmd_name in sorted(commands.keys()):
            script_id = f"ir_{device_key}_{cmd_name}"
            friendly = cmd_name.replace("_", " ").title()
            payload = commands.get(cmd_name, "")
            lines.append(f"{script_id}:")
            lines.append(f"  alias: \"{name} — {friendly}\"")
            lines.append(f"  icon: mdi:remote")
            lines.append(f"  sequence:")
            lines.append(f"    - service: mqtt.publish")
            lines.append(f"      data:")
            lines.append(f"        topic: \"cmnd/{topic}/irsend\"")
            lines.append(f"        payload: '{payload}'")
            lines.append(f"  mode: single")
            lines.append("")
    else:
        remote_hint = profile.get("broadlink_device") or device_key
        lines.append(f"# Remote device: {remote_hint}")
        lines.append("")
        for cmd_name in sorted(commands.keys()):
            script_id = f"ir_{device_key}_{cmd_name}"
            friendly = cmd_name.replace("_", " ").title()
            lines.append(f"{script_id}:")
            lines.append(f"  alias: \"{name} — {friendly}\"")
            lines.append(f"  icon: mdi:remote")
            lines.append(f"  sequence:")
            lines.append(f"    - service: remote.send_command")
            lines.append(f"      target:")
            lines.append(f"        entity_id: remote.REPLACE_WITH_YOUR_REMOTE_ENTITY")
            lines.append(f"      data:")
            lines.append(f"        device: \"{remote_hint}\"")
            lines.append(f"        command: \"{cmd_name}\"")
            lines.append(f"  mode: single")
            lines.append("")

    return "\n".join(lines)


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
        "power", "power_on", "power_off", "volume_up", "volume_down",
        "mute", "channel_up", "channel_down", "play", "pause", "stop",
        "home", "back", "menu", "source",
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
                    "js_url": f"/api/{DOMAIN}/static/panel.js?v=29",
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
        controller = resolve_controller_type(entry)

        if controller == CONTROLLER_TASMOTA_MQTT:
            from .mqtt_controller import async_learn_tasmota_code

            base_topic = resolve_mqtt_base_topic(entry)
            if not base_topic:
                raise HomeAssistantError(
                    "MQTT base topic is not configured for this entry."
                )
            if base_topic.strip().lower().lstrip("/").startswith("zigbee2mqtt"):
                raise HomeAssistantError(
                    f"'{base_topic}' looks like a Zigbee2MQTT topic. The "
                    "'Tasmota IR (MQTT)' controller only works with Tasmota IR "
                    "blasters — it listens on tele/<topic>/RESULT for Tasmota's "
                    "IrReceived, which a Zigbee2MQTT blaster (e.g. Tuya ZS06 / "
                    "UFO-R11) never publishes, so learning always times out. "
                    "Zigbee2MQTT Tuya blasters aren't supported by the Builder's "
                    "learn flow yet — use them directly in the ar_smart_ir "
                    "integration, which has a UFOR11/Tuya controller."
                )
            timeout = call.data.get("learn_timeout", 25.0)
            code = await async_learn_tasmota_code(hass, base_topic, timeout=timeout)

            store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
            device = store.get_device(call.data["device_key"]) or normalize_device()
            device["entry_id"] = call.data["entry_id"]
            device["commands_encoding"] = "TasmotaIR"
            duplicate_of = find_duplicate_command(
                device.get("commands", {}),
                "TasmotaIR",
                code,
                skip_name=call.data["command_name"],
            )
            device.setdefault("commands", {})[call.data["command_name"]] = code

            await store.upsert_device(entry, call.data["device_key"], device)
            await store.async_save()
            async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)
            return {
                "device_key": call.data["device_key"],
                "command_name": call.data["command_name"],
                "code": code,
                "duplicate_of": duplicate_of,
            }

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
        duplicate_of = find_duplicate_command(
            device.get("commands", {}),
            device.get("commands_encoding", "Base64"),
            code,
            skip_name=call.data["command_name"],
        )
        device.setdefault("commands", {})[call.data["command_name"]] = code

        await store.upsert_device(entry, call.data["device_key"], device)
        await store.async_save()
        async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)
        return {
            "device_key": call.data["device_key"],
            "command_name": call.data["command_name"],
            "code": code,
            "duplicate_of": duplicate_of,
        }

    async def export(call: ServiceCall) -> dict[str, Any]:
        store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
        device_key = call.data["device_key"]
        device = store.get_device(device_key)
        if device is None:
            raise HomeAssistantError("Device not found for the given device key.")

        controller = "broadlink"
        entry_id = device.get("entry_id")
        if entry_id:
            entry = hass.config_entries.async_get_entry(entry_id)
            if entry is not None:
                controller = resolve_controller_type(entry)

        try:
            platform, payload, report = build_codeset(device_key, device, controller)
        except SmartIRExportError as err:
            raise HomeAssistantError(str(err)) from err

        payload_json = json.dumps(payload, indent=2)

        def _write() -> int:
            # Functional target: <config>/ar_smart_ir_codes/<platform>/<code>.json.
            # Lives outside the (HACS-managed) ar_smart_ir folder so it survives
            # integration updates. ar_smart_ir merges this dir into its catalog.
            codes_dir = Path(hass.config.path("ar_smart_ir_codes", platform))
            codes_dir.mkdir(parents=True, exist_ok=True)

            # Stable device_key -> code map so re-exporting overwrites rather
            # than piling up new numbers. Named without a numeric stem so the
            # integration's catalog loader skips it.
            index_file = codes_dir / "index.json"
            index: dict[str, int] = {}
            if index_file.exists():
                try:
                    index = json.loads(index_file.read_text())
                except (ValueError, OSError):
                    index = {}

            code = index.get(device_key)
            if code is None:
                used = set(int(v) for v in index.values() if str(v).isdigit())
                for existing in codes_dir.glob("*.json"):
                    if existing.stem.isdigit():
                        used.add(int(existing.stem))
                # Custom codes start at 9000 to stay clear of bundled codesets.
                code = 9000
                while code in used:
                    code += 1
                index[device_key] = code
                index_file.write_text(json.dumps(index, indent=2))

            (codes_dir / f"{code}.json").write_text(payload_json)

            # Download-only copy under www. This is NOT read by the integration —
            # it's here so the panel can offer a download. The live codeset is the
            # numeric file above; edit that one, never this copy.
            www_dir = Path(hass.config.path("www", "ar_smart_ir_exports"))
            www_dir.mkdir(parents=True, exist_ok=True)
            readme = www_dir / "READ_ME_FIRST.txt"
            if not readme.exists():
                readme.write_text(
                    "These files are DOWNLOAD COPIES only.\n"
                    "AR Smart IR does NOT read from this folder.\n\n"
                    "The live codeset the integration uses lives at:\n"
                    "  /config/ar_smart_ir_codes/<platform>/<code>.json\n\n"
                    "To change a manufacturer/model/command, edit that numeric file,\n"
                    "not the copy here.\n"
                )
            (www_dir / f"{device_key}.json").write_text(payload_json)
            return code

        code = await hass.async_add_executor_job(_write)

        platform_label = _SMARTIR_PLATFORM_LABELS.get(platform, platform)
        manufacturer = payload.get("manufacturer", "Unknown")
        models = payload.get("supportedModels") or ["Unknown"]
        model_label = models[0]
        instructions = (
            f"In ar_smart_ir: Add device → choose \"{platform_label}\" → "
            f"manufacturer \"{manufacturer}\" → code {code}. "
            f"Edit codes only at /config/ar_smart_ir_codes/{platform}/{code}.json "
            f"(the download is a copy, not the live file)."
        )

        return {
            "code": code,
            "platform": platform,
            "platform_label": platform_label,
            "manufacturer": manufacturer,
            "model": model_label,
            "add_as": platform_label,
            "instructions": instructions,
            "path": f"/config/ar_smart_ir_codes/{platform}/{code}.json",
            "download_url": f"/local/ar_smart_ir_exports/{device_key}.json",
            "preview_url": f"/local/ar_smart_ir_exports/{device_key}.json",
            "report": report,
        }

    async def export_ha_scripts(call: ServiceCall) -> None:
        store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
        device_key = call.data["device_key"]
        device = store.get_device(device_key)
        if device is None:
            raise HomeAssistantError("Device not found for the given device key.")

        controller = "broadlink"
        mqtt_base_topic = None
        entry_id = device.get("entry_id")
        if entry_id:
            entry = hass.config_entries.async_get_entry(entry_id)
            if entry is not None:
                controller = resolve_controller_type(entry)
                mqtt_base_topic = resolve_mqtt_base_topic(entry)

        export_dir = Path(hass.config.path("www", "ar_smart_ir_exports"))
        export_dir.mkdir(parents=True, exist_ok=True)

        yaml_content = _build_ha_scripts_export(device_key, device, controller, mqtt_base_topic)
        file = export_dir / f"{device_key}_scripts.yaml"
        file.write_text(yaml_content)

    async def test_command(call: ServiceCall) -> dict[str, Any]:
        entry = await _async_get_entry(hass, call.data["entry_id"])
        controller = resolve_controller_type(entry)

        store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
        device_key = call.data["device_key"]
        command_name = call.data["command_name"]

        device = store.get_device(device_key)
        if device is None:
            raise HomeAssistantError(f"Device profile '{device_key}' not found.")

        commands = device.get("commands", {})
        if command_name not in commands:
            raise HomeAssistantError(
                f"Command '{command_name}' not found in profile '{device_key}'. "
                f"Available: {', '.join(sorted(commands.keys())) or 'none'}"
            )

        code = commands[command_name]
        if not isinstance(code, str) or not code:
            raise HomeAssistantError(
                f"Command '{command_name}' has no valid code stored."
            )

        if controller == CONTROLLER_TASMOTA_MQTT:
            from .mqtt_controller import async_send_tasmota_code

            base_topic = resolve_mqtt_base_topic(entry)
            if not base_topic:
                raise HomeAssistantError(
                    "MQTT base topic is not configured for this entry."
                )
            await async_send_tasmota_code(hass, base_topic, code)
            return {
                "device_key": device_key,
                "command_name": command_name,
                "mqtt_base_topic": base_topic,
                "status": "sent",
            }

        remote = entry.data.get(CONF_REMOTE_ENTITY)
        if not remote:
            raise HomeAssistantError("Remote entity is not configured for this entry.")

        # Send the raw Base64 code via Broadlink's b64: prefix. This works for
        # both captured commands (already in Broadlink's storage) and codes that
        # were pasted in manually (which Broadlink wouldn't otherwise know about).
        await hass.services.async_call(
            "remote",
            "send_command",
            {"command": f"b64:{code}"},
            target={"entity_id": remote},
            blocking=True,
        )

        return {
            "device_key": device_key,
            "command_name": command_name,
            "remote_entity": remote,
            "status": "sent",
        }

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
        default_encoding = (
            "TasmotaIR" if resolve_controller_type(entry) == CONTROLLER_TASMOTA_MQTT else "Base64"
        )
        data["commands_encoding"] = data.get(
            "commands_encoding", existing.get("commands_encoding", default_encoding)
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

    async def delete_device(call: ServiceCall) -> None:
        store: ARSmartIRStore = hass.data[DOMAIN][DATA_STORE]
        device_key = call.data["device_key"]
        entry_id = call.data.get("entry_id")
        if not entry_id:
            existing = store.get_device(device_key)
            if existing:
                entry_id = existing.get("entry_id")
        if not entry_id:
            raise HomeAssistantError(
                f"Cannot delete '{device_key}': entry_id not found."
            )
        entry = await _async_get_entry(hass, entry_id)
        deleted = await store.delete_device(entry, device_key)
        if not deleted:
            raise HomeAssistantError(f"Profile '{device_key}' not found.")
        await store.async_save()
        async_dispatcher_send(hass, SIGNAL_DEVICES_UPDATED)

    hass.services.async_register(
        DOMAIN, "learn_and_capture", learn,
        schema=LEARN_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(DOMAIN, "save_device", save_device, schema=SAVE_SCHEMA)
    hass.services.async_register(
        DOMAIN,
        "export_device",
        export,
        schema=EXPORT_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(DOMAIN, "export_ha_scripts", export_ha_scripts, schema=EXPORT_SCHEMA)
    hass.services.async_register(
        DOMAIN, "test_command", test_command,
        schema=TEST_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(DOMAIN, "delete_device", delete_device, schema=DELETE_SCHEMA)


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
                "controller_type": resolve_controller_type(entry),
                "mqtt_base_topic": resolve_mqtt_base_topic(entry),
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
