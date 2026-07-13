from __future__ import annotations

import asyncio
from typing import Any

DOMAIN = "ar_smart_ir_builder"
PLATFORMS: list[str] = ["climate", "fan", "media_player"]
PANEL_URL_PATH = "ar-smart-ir-builder"
PANEL_TITLE = "AR Smart IR"
PANEL_ICON = "mdi:remote-tv"
DATA_STORE = "store"
DATA_UNSUB = "unsub"
CONF_REMOTE_ENTITY = "remote_entity"
CONF_DEVICE_KEY = "device_key"
CONF_DEVICES = "devices"
CONF_TITLE = "title"
CONF_ENTRY_ID = "entry_id"
CONF_BROADLINK_DEVICE = "broadlink_device"
DEFAULT_TITLE = "AR Smart IR Builder"
SIGNAL_DEVICES_UPDATED = f"{DOMAIN}_devices_updated"
SUPPORTED_DEVICE_TYPES: list[str] = ["climate", "fan", "media_player", "tv", "custom"]
# "custom" is a free-form profile (blinds, screens, gates, projectors, ...).
# It creates no HA entity and cannot be exported as an ar_smart_ir codeset —
# use "Export HA scripts" for these and wrap the scripts in e.g. a template cover.

# --- Controller types -------------------------------------------------
# A config entry talks to exactly one physical IR blaster, via one of these
# backends. Broadlink remains the default for existing entries (entries
# created before this option existed have no controller_type stored, and
# resolve_controller_type() falls back to "broadlink" for them).
CONF_CONTROLLER_TYPE = "controller_type"
CONF_MQTT_BASE_TOPIC = "mqtt_base_topic"
CONTROLLER_BROADLINK = "broadlink"
CONTROLLER_TASMOTA_MQTT = "tasmota_mqtt"
CONTROLLER_TYPES: list[str] = [CONTROLLER_BROADLINK, CONTROLLER_TASMOTA_MQTT]
CONTROLLER_LABELS: dict[str, str] = {
    CONTROLLER_BROADLINK: "Broadlink (remote entity)",
    CONTROLLER_TASMOTA_MQTT: "Tasmota IR (MQTT)",
}
DEFAULT_MQTT_LEARN_TIMEOUT = 25.0


def resolve_remote_entity(entry) -> str | None:
    return entry.data.get(CONF_REMOTE_ENTITY) or entry.options.get(CONF_REMOTE_ENTITY)


def resolve_controller_type(entry) -> str:
    value = entry.data.get(CONF_CONTROLLER_TYPE) or entry.options.get(CONF_CONTROLLER_TYPE)
    return value if value in CONTROLLER_TYPES else CONTROLLER_BROADLINK


def resolve_mqtt_base_topic(entry) -> str | None:
    return entry.data.get(CONF_MQTT_BASE_TOPIC) or entry.options.get(CONF_MQTT_BASE_TOPIC)


def resolve_controller_available(hass, entry) -> bool:
    """Best-effort availability check that works for either controller type.

    Broadlink: mirrors the original behaviour — the remote entity must exist
    and not be unavailable/unknown.
    Tasmota/MQTT: there's no HA entity to check state on, so this just
    confirms a base topic is configured and the MQTT integration is loaded.
    Real online/offline status would need subscribing to the device's LWT
    topic (tele/<topic>/LWT), which isn't wired up here.
    """
    if resolve_controller_type(entry) == CONTROLLER_TASMOTA_MQTT:
        return bool(resolve_mqtt_base_topic(entry)) and "mqtt" in hass.config.components

    remote_entity = resolve_remote_entity(entry)
    if not remote_entity:
        return False
    state = hass.states.get(remote_entity)
    return state is not None and state.state not in {"unavailable", "unknown"}


def resolve_repeat_policy(
    profile: dict[str, Any] | None, command_name: str
) -> tuple[int, float]:
    """Return (repeat_count, delay_seconds) for a given command.

    Defaults to (1, 0.0) when no policy is set, so callers can always loop
    range(repeat) and sleep(delay) without branching.
    """
    if not profile or not command_name:
        return 1, 0.0
    options = profile.get("command_options") or {}
    policy = options.get(command_name)
    if not isinstance(policy, dict):
        return 1, 0.0
    try:
        repeat = int(policy.get("repeat", 1))
    except (TypeError, ValueError):
        repeat = 1
    try:
        delay = float(policy.get("delay", 0))
    except (TypeError, ValueError):
        delay = 0.0
    unit = str(policy.get("delay_unit", "ms")).lower()
    if unit == "ms":
        delay = delay / 1000.0
    repeat = max(1, min(repeat, 20))
    delay = max(0.0, min(delay, 60.0))
    return repeat, delay


async def send_with_policy(
    hass,
    entry,
    code: str,
    profile: dict[str, Any] | None,
    command_name: str,
) -> None:
    """Send a stored code, honouring any per-command repeat policy.

    Dispatches to the right backend based on the entry's controller_type:
    Broadlink (HA `remote.send_command` with a b64: code) or Tasmota over
    MQTT (`cmnd/<topic>/irsend` with a Tasmota IRSend JSON payload).
    """
    if not code:
        return
    controller = resolve_controller_type(entry)
    repeat, delay = resolve_repeat_policy(profile, command_name)

    if controller == CONTROLLER_TASMOTA_MQTT:
        from .mqtt_controller import async_send_tasmota_code

        base_topic = resolve_mqtt_base_topic(entry)
        if not base_topic:
            return
        for i in range(repeat):
            await async_send_tasmota_code(hass, base_topic, code)
            if delay > 0 and i < repeat - 1:
                await asyncio.sleep(delay)
        return

    remote_entity = resolve_remote_entity(entry)
    if not remote_entity:
        return
    for i in range(repeat):
        await hass.services.async_call(
            "remote",
            "send_command",
            {"command": f"b64:{code}"},
            target={"entity_id": remote_entity},
            blocking=True,
        )
        if delay > 0 and i < repeat - 1:
            await asyncio.sleep(delay)
