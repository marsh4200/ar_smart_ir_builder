from __future__ import annotations

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
