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
    "projector": "media_player",
    "receiver": "media_player",
    "soundbar": "media_player",
    "decoder": "media_player",
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


def _normalise_temperature_unit(value: Any) -> str:
    """Map a loose unit onto the "C"/"F" that ar_smart_ir expects."""
    token = str(value or "").strip().upper().lstrip("\u00b0")
    if token in {"F", "FAHRENHEIT", "DEGF"}:
        return "F"
    return "C"


def _distinct_fingerprints(
    fingerprints: dict[str, str], names: list[str]
) -> set[str] | None:
    """Signal identities for `names`, or None if any is unknown.

    None means "can't tell" - never guess from a partial picture.
    """
    seen: set[str] = set()
    for name in names:
        fp = fingerprints.get(name)
        if not fp:
            return None
        seen.add(fp)
    return seen


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
def _build_climate(
    commands: dict[str, Any], temperature_unit: str = "C"
) -> tuple[dict[str, Any], dict[str, Any]]:
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
        # Declared explicitly so ar_smart_ir doesn't have to infer it from the
        # range. A Fahrenheit remote learned as 65-86 was previously exported
        # bare and then read back as Celsius (ar_smart_ir issue #33).
        "temperatureUnit": temperature_unit,
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
def _toggle_power_code(
    commands: dict[str, Any], fingerprints: dict[str, str]
) -> str | None:
    """The single button that powers a toggle remote on and off."""
    for name in ("power", "power_toggle", "toggle", "onoff", "on_off"):
        code = _str_code(commands.get(name))
        if code:
            return code

    on = _str_code(commands.get("on"))
    off = _str_code(commands.get("off"))

    # on and off learned from the same physical button -> it's a toggle.
    if on and off and _distinct_fingerprints(fingerprints, ["on", "off"]) == {
        fingerprints.get("on")
    }:
        return on

    return on or off


def _toggle_oscillate_code(commands: dict[str, Any]) -> str | None:
    for name in ("oscillate", "swing", "swing_on", "oscillate_on"):
        code = _str_code(commands.get(name))
        if code:
            return code
    return None


def _build_fan(
    commands: dict[str, Any], fingerprints: dict[str, str] | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
    fingerprints = fingerprints or {}
    speeds = _prefixed_values(commands, "fan_")
    if not speeds:
        raise SmartIRExportError(
            "Fan export needs at least one fan_* speed command, but none was "
            "learned. If your remote has a single speed button that cycles "
            "through the speeds, learn it once per speed (fan_low, fan_medium, "
            "fan_high) and the export will detect the cycle automatically."
        )

    notes: list[str] = []

    # --- toggle/cycle remote detection ----------------------------------- #
    # One physical speed button learned into every fan_* slot: the codes are
    # byte-identical, so a discrete codeset would send the same pulse for
    # every speed and never actually reach the requested one. ar_smart_ir's
    # toggleMode drives it properly by counting presses instead.
    speed_names = [f"fan_{s}" for s in speeds if _str_code(commands.get(f"fan_{s}"))]
    speed_fps = _distinct_fingerprints(fingerprints, speed_names)
    is_cycle = len(speed_names) > 1 and speed_fps is not None and len(speed_fps) == 1

    if is_cycle:
        cycle_code = _str_code(commands.get(speed_names[0]))
        power_code = _toggle_power_code(commands, fingerprints)

        if power_code is None:
            raise SmartIRExportError(
                "This looks like a cycle remote (one speed button for all "
                "speeds), but no power button was learned. Learn the power "
                "button as 'power' (or 'on'), then export again."
            )

        if _distinct_fingerprints(fingerprints, ["fan_" + speeds[0]]) == \
                _distinct_fingerprints(fingerprints, ["on"]):
            notes.append(
                "The power and speed buttons look identical - check you "
                "learned two different buttons."
            )

        cmd: dict[str, Any] = {"power": power_code, "speed_cycle": cycle_code}

        oscillate = _toggle_oscillate_code(commands)
        if oscillate:
            cmd["oscillate"] = oscillate

        fields = {
            "toggleMode": True,
            "powerOnSpeed": speeds[0],
            "speed": speeds,
            "commands": cmd,
        }

        notes.append(
            f"Detected a toggle/cycle remote: one power button and one speed "
            f"button cycling {' -> '.join(speeds)}. Exported with "
            f"\"toggleMode\": true - ar_smart_ir counts presses to reach the "
            f"speed you pick, assuming it powers on at '{speeds[0]}'. If your "
            f"fan starts on a different speed, change \"powerOnSpeed\"."
        )
        if not oscillate:
            notes.append("No oscillate/swing button learned; oscillation won't work.")

        return fields, {"notes": notes}

    # --- discrete remote (a distinct code per speed) ---------------------- #
    cmd = {}
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

    if off is None:
        notes.append("No 'off' command learned; turning the fan off won't work.")
    elif _distinct_fingerprints(fingerprints, ["on", "off"]) == {fingerprints.get("off")} \
            and fingerprints.get("off"):
        notes.append(
            "'on' and 'off' were learned from the same button, so this fan's "
            "power is a toggle. Each speed still has its own code, so speeds "
            "will work, but Home Assistant may get out of sync with the fan's "
            "real on/off state."
        )
    if speed_fps is not None and len(speed_fps) < len(speed_names):
        notes.append(
            "Some speed buttons share the same code - those speeds will "
            "behave identically."
        )

    report: dict[str, Any] = {}
    if notes:
        report["notes"] = notes
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
    device_key: str,
    device: dict[str, Any],
    controller: str,
    temperature_unit: Any = None,
) -> tuple[str, dict[str, Any], dict[str, Any]]:
    """Return (platform, codeset_payload, report).

    Raises SmartIRExportError with a user-facing message when the profile
    can't be represented as an ar_smart_ir codeset.
    """
    profile = normalize_device(device)
    dtype = canonical_device_type(profile.get("device_type"))
    platform = _PLATFORM_MAP.get(dtype)
    if platform is None:
        if dtype == "custom":
            raise SmartIRExportError(
                "Custom profiles (blinds, screens, gates, ...) can't be exported "
                "as an ar_smart_ir codeset — ar_smart_ir only understands "
                "climate, fan and media player devices. Use \"Export HA scripts\" "
                "instead, then wrap the generated scripts in a template cover/"
                "switch in Home Assistant."
            )
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

    fingerprints = profile.get("command_fingerprints")
    if not isinstance(fingerprints, dict):
        fingerprints = {}

    if platform == "climate":
        # A unit stamped on the profile wins over the caller's current setting.
        fields, report = _build_climate(
            commands,
            _normalise_temperature_unit(
                profile.get("temperature_unit") or temperature_unit
            ),
        )
    elif platform == "fan":
        fields, report = _build_fan(commands, fingerprints)
    else:
        fields, report = _build_media_player(commands)

    return platform, {**common, **fields}, report
