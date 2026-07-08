"""Turn a Builder profile (flat {name: code} commands) into an ar_smart_ir
codeset (typed, nested per platform).

The Builder stores every learned button as a flat command:

    {"off": "...", "cool_22": "...", "fan_low": "...", "hdmi1": "..."}

ar_smart_ir instead demands platform-specific, nested structures:

    climate       commands[mode][fan]([swing])[temp]  + operationModes/fanModes/
                  minTemperature/maxTemperature/precision
    fan           speed:[...]  + commands[speed] (+ off/oscillate)
    media_player  commands: off/on/volumeUp/.../sources:{...}

This module bridges the two so a Builder export drops straight into
<config>/ar_smart_ir_codes/<platform>/<code>.json and works.
"""

from __future__ import annotations

import re
from typing import Any

from .storage import canonical_device_type, normalize_device

# device_type (Builder) -> platform (ar_smart_ir codes/<platform> folder)
_PLATFORM_MAP = {
    "climate": "climate",
    "fan": "fan",
    "media_player": "media_player",
    "tv": "media_player",
}

_CLIMATE_MODES = ["cool", "heat", "dry", "fan_only", "auto"]
_TEMP_RE = re.compile(r"^(?:temp|temperature)_(\d{1,2})$")
_DEFAULT_TEMP = 24


class SmartIRExportError(Exception):
    """A profile can't be turned into an ar_smart_ir codeset."""


def _controller_labels(controller: str) -> tuple[str, str]:
    """(supportedController, commandsEncoding) as ar_smart_ir expects them.

    ar_smart_ir ships no Tasmota controller, so Tasmota/MQTT profiles can't be
    consumed by it — refuse rather than emit a codeset that silently fails.
    """
    if controller == "tasmota_mqtt":
        raise SmartIRExportError(
            "Tasmota (MQTT) profiles can't be exported to ar_smart_ir — it has "
            "no Tasmota controller. Re-learn this device on a Broadlink entry, "
            "or use 'Export HA scripts' instead."
        )
    return "Broadlink", "Base64"


def _str_code(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _prefixed_values(commands: dict[str, Any], prefix: str) -> list[str]:
    """Values after `prefix`, in learn (insertion) order — preserves the
    low->high ordering fan/speed lists rely on."""
    out: list[str] = []
    for name in commands:
        if name.startswith(prefix) and name[len(prefix):]:
            out.append(name[len(prefix):])
    return out


# --------------------------------------------------------------------------- #
# climate
# --------------------------------------------------------------------------- #
def _build_climate(commands: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    off = _str_code(commands.get("off"))
    if off is None:
        raise SmartIRExportError(
            "Climate export needs an 'off' command, but none was learned."
        )

    fan_modes = _prefixed_values(commands, "fan_") or ["auto"]
    swing_modes = _prefixed_values(commands, "swing_")

    modes = [
        m for m in _CLIMATE_MODES
        if m in commands or any(n.startswith(f"{m}_") for n in commands)
    ]
    if not modes:
        modes = ["cool"]

    temps: set[int] = set()
    for name in commands:
        m = _TEMP_RE.match(name)
        if m:
            temps.add(int(m.group(1)))
        for mode in modes:
            mm = re.match(rf"^{re.escape(mode)}_(\d{{1,2}})$", name)
            if mm:
                temps.add(int(mm.group(1)))
    temperatures = sorted(temps) or [_DEFAULT_TEMP]

    def code_for(mode: str, temp: int) -> str | None:
        for cand in (
            f"{mode}_{temp}", f"{mode}_{temp:02d}",
            f"temp_{temp}", f"temperature_{temp}",
            mode,
        ):
            code = _str_code(commands.get(cand))
            if code:
                return code
        return None

    tree: dict[str, Any] = {"off": off}
    on = _str_code(commands.get("on"))
    if on:
        tree["on"] = on

    # ar_smart_ir keys temps with f"{temp:g}" -> str(int) for whole degrees.
    for mode in modes:
        fan_branch: dict[str, Any] = {}
        for fan in fan_modes:
            temp_leaf = {str(t): code_for(mode, t) for t in temperatures}
            temp_leaf = {t: c for t, c in temp_leaf.items() if c}
            if not temp_leaf:
                continue
            if swing_modes:
                fan_branch[fan] = {sw: temp_leaf for sw in swing_modes}
            else:
                fan_branch[fan] = temp_leaf
        if fan_branch:
            tree[mode] = fan_branch

    fields: dict[str, Any] = {
        "minTemperature": min(temperatures),
        "maxTemperature": max(temperatures),
        "precision": 1,
        "operationModes": modes,
        "fanModes": fan_modes,
    }
    if swing_modes:
        fields["swingModes"] = swing_modes
    fields["commands"] = tree

    report: dict[str, Any] = {}
    notes: list[str] = []
    if not _prefixed_values(commands, "fan_"):
        notes.append("No fan_* commands learned; used a single 'auto' fan mode.")
    if temps == set():
        notes.append(
            f"No temperature commands found; mapped bare mode codes to "
            f"{_DEFAULT_TEMP}°C."
        )
    if _prefixed_values(commands, "fan_"):
        notes.append(
            "Fan is a separate button on this remote, so the same temp code is "
            "reused across fan modes — changing fan speed in ar_smart_ir won't "
            "send a distinct code."
        )
    if notes:
        report["notes"] = notes
    return fields, report


# --------------------------------------------------------------------------- #
# fan
# --------------------------------------------------------------------------- #
def _build_fan(commands: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    speeds = _prefixed_values(commands, "fan_")
    if not speeds:
        raise SmartIRExportError(
            "Fan export needs at least one fan_* speed command, but none was "
            "learned."
        )

    cmd: dict[str, Any] = {}
    off = _str_code(commands.get("off"))
    if off:
        cmd["off"] = off
    for speed in speeds:
        code = _str_code(commands.get(f"fan_{speed}"))
        if code:
            cmd[speed] = code
    for name in ("oscillate", "swing"):
        code = _str_code(commands.get(name))
        if code:
            cmd["oscillate"] = code
            break

    fields = {"speed": speeds, "commands": cmd}
    report: dict[str, Any] = {}
    if off is None:
        report["notes"] = ["No 'off' command learned; turning the fan off won't work."]
    return fields, report


# --------------------------------------------------------------------------- #
# media_player / tv
# --------------------------------------------------------------------------- #
_MP_ALIASES: dict[str, tuple[str, ...]] = {
    "on": ("on", "power_on", "poweron", "turn_on"),
    "off": ("off", "power_off", "poweroff", "turn_off"),
    "volumeUp": ("volume_up", "vol_up", "volumeup", "volup", "vol_plus"),
    "volumeDown": ("volume_down", "vol_down", "volumedown", "voldown", "vol_minus"),
    "mute": ("mute", "volume_mute"),
    "nextChannel": (
        "channel_up", "ch_up", "chan_up", "next_channel", "nextchannel",
        "chup", "program_up", "prog_up",
    ),
    "previousChannel": (
        "channel_down", "ch_down", "chan_down", "prev_channel",
        "previous_channel", "chdown", "program_down", "prog_down",
    ),
}
# Physical inputs we're confident routing to the source list.
_SOURCE_TOKENS = re.compile(
    r"^(hdmi\d?|av\d?|video\d?|component\d?|comp\d?|vga|dvi|usb\d?|scart|"
    r"optical|aux|pc|tv|dtv|atv)$"
)


def _norm(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def _build_media_player(
    commands: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    # normalized builder name -> canonical transport key
    lookup: dict[str, str] = {}
    for canonical, variants in _MP_ALIASES.items():
        for v in variants:
            lookup[v] = canonical

    cmd: dict[str, Any] = {}
    sources: dict[str, str] = {}
    unmapped: list[str] = []

    for raw_name, value in commands.items():
        code = _str_code(value)
        if not code:
            continue
        n = _norm(raw_name)

        if n in lookup:
            cmd.setdefault(lookup[n], code)
            continue
        # A single toggle 'power' button drives both on and off.
        if n in ("power", "power_toggle", "toggle"):
            cmd.setdefault("on", code)
            cmd.setdefault("off", code)
            continue
        # Explicit source/input prefixes.
        for pfx in ("source_", "input_", "src_"):
            if n.startswith(pfx) and n[len(pfx):]:
                label = n[len(pfx):].replace("_", " ").upper().strip()
                sources[label] = code
                break
        else:
            if _SOURCE_TOKENS.match(n):
                sources[raw_name.strip().upper()] = code
            else:
                unmapped.append(raw_name)

    if sources:
        cmd["sources"] = sources

    if not cmd:
        raise SmartIRExportError(
            "None of the learned buttons map to media-player controls "
            "(power/volume/channel/source)."
        )

    report: dict[str, Any] = {}
    if unmapped:
        report["unmapped"] = sorted(unmapped)
        report["notes"] = [
            "These buttons have no media_player equivalent and were left out: "
            + ", ".join(sorted(unmapped))
        ]
    return {"commands": cmd}, report


# --------------------------------------------------------------------------- #
# dispatcher
# --------------------------------------------------------------------------- #
def build_codeset(
    device_key: str, device: dict[str, Any], controller: str
) -> tuple[str, dict[str, Any], dict[str, Any]]:
    """Return (platform, codeset_payload, report).

    Raises SmartIRExportError with a user-facing message when the profile
    can't be represented as an ar_smart_ir codeset.
    """
    profile = normalize_device(device)
    dtype = canonical_device_type(profile.get("device_type"))
    platform = _PLATFORM_MAP.get(dtype)
    if platform is None:
        raise SmartIRExportError(
            f"Device type '{dtype or 'unknown'}' has no ar_smart_ir equivalent "
            "(supported: climate, fan, media_player/tv)."
        )

    commands = profile.get("commands")
    if not isinstance(commands, dict) or not commands:
        raise SmartIRExportError("This profile has no learned commands to export.")

    controller_label, encoding_label = _controller_labels(controller)

    models = profile.get("supported_models") or []
    if not models:
        models = [profile.get("model") or device_key]

    common = {
        "manufacturer": profile.get("manufacturer") or "Unknown",
        "supportedModels": models,
        "supportedController": controller_label,
        "commandsEncoding": encoding_label,
    }

    if platform == "climate":
        fields, report = _build_climate(commands)
    elif platform == "fan":
        fields, report = _build_fan(commands)
    else:
        fields, report = _build_media_player(commands)

    return platform, {**common, **fields}, report
