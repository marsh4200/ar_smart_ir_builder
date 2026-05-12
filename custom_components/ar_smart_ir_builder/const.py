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
SUPPORTED_DEVICE_TYPES: list[str] = ["climate", "fan", "media_player", "tv"]


def resolve_remote_entity(entry) -> str | None:
    return entry.data.get(CONF_REMOTE_ENTITY) or entry.options.get(CONF_REMOTE_ENTITY)


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
    remote_entity: str | None,
    code: str,
    profile: dict[str, Any] | None,
    command_name: str,
) -> None:
    """Send a Broadlink b64 code, honouring any per-command repeat policy."""
    if not remote_entity or not code:
        return
    repeat, delay = resolve_repeat_policy(profile, command_name)
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
