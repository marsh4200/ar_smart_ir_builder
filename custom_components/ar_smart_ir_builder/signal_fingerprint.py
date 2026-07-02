"""Protocol-agnostic signal identity for learned IR/RF codes.

Both controller backends store an opaque code string (a Broadlink base64
packet, or a Tasmota IRSend JSON body) and we currently have no way to tell
whether two captures are "the same button" short of comparing the strings
byte-for-byte. That falls apart with real hardware: two presses of the same
button rarely produce identical bytes because of timing jitter, and Tasmota
falls back to raw pulse arrays for anything it can't decode (the same class
of remote where Broadlink also gets flaky, per the README's known
limitation).

This module gives every captured code a short/long (S/L) pulse fingerprint:
each pulse duration is bucketed as short or long relative to a split found
in that signal's own timings, producing a pattern string that's stable
across normal jitter between presses. It doesn't replace the stored code —
the raw code remains what gets transmitted — it's an identity layer on top,
useful for:

  * flagging a re-learn that produced the exact same signal as an existing
    command on the same device (probably learned the wrong button, or the
    remote didn't register the press)
  * sanity-checking toggle-capture pairs for relative/stateless AC remotes:
    the "on" and "off" snapshots should fingerprint differently, and if they
    don't, the second capture likely didn't actually happen
  * a future duplicate/dedup pass across a device's whole command set

Unsupported or malformed codes fingerprint to None rather than raising —
callers treat that as "no opinion", not an error.
"""

from __future__ import annotations

import base64
import hashlib
import json
import statistics
from typing import Any

# Broadlink RM IR packets encode pulse durations in units of this many
# microseconds. A duration byte of 0x00 means "the real duration didn't fit
# in one byte", and the next two bytes (big-endian) hold the tick count
# instead.
_BROADLINK_TICK_US = 32.84
_BROADLINK_IR_FLAG = 0x26

# Ignore signals too short to meaningfully fingerprint (noise, truncated
# captures) and cap how many pulses we bucket so one huge AC payload can't
# make this expensive.
_MIN_PULSES = 8
_MAX_PULSES = 800


def decode_broadlink_ir(code_b64: str) -> list[int] | None:
    """Return pulse durations (microseconds) from a Broadlink IR packet.

    Returns None if the code isn't a base64 IR packet we recognise (wrong
    flag byte, truncated, not base64 at all, RF rather than IR, etc).
    """
    try:
        raw = base64.b64decode(code_b64, validate=False)
    except (ValueError, TypeError):
        return None

    if len(raw) < 4 or raw[0] != _BROADLINK_IR_FLAG:
        return None

    length = raw[2] | (raw[3] << 8)
    payload = raw[4 : 4 + length]

    pulses: list[int] = []
    i = 0
    while i < len(payload) and len(pulses) < _MAX_PULSES:
        byte = payload[i]
        if byte == 0x00:
            if i + 2 >= len(payload):
                break
            ticks = (payload[i + 1] << 8) | payload[i + 2]
            i += 3
        else:
            ticks = byte
            i += 1
        if ticks:
            pulses.append(round(ticks * _BROADLINK_TICK_US))

    return pulses or None


def _tasmota_raw_pulses(parsed: dict[str, Any]) -> list[int] | None:
    """Pull a raw pulse array out of a Tasmota IRSend body, if present.

    Only the RAW fallback (protocols Tasmota can't decode) carries actual
    timings — those are already in microseconds, no unit conversion needed.
    """
    if str(parsed.get("Protocol", "")).upper() != "RAW":
        return None
    data = parsed.get("Data")
    if not isinstance(data, list) or not data:
        return None
    try:
        return [abs(int(v)) for v in data[:_MAX_PULSES]]
    except (TypeError, ValueError):
        return None


def _decoded_protocol_identity(parsed: dict[str, Any]) -> str | None:
    """Identity string for a Tasmota code Tasmota *did* manage to decode.

    No pulse timings are available for these (Tasmota only republishes the
    decoded fields), so there's nothing to S/L-classify — but Protocol +
    Bits + Data is already an exact, jitter-free identity on its own.
    """
    protocol = parsed.get("Protocol")
    if not protocol or str(protocol).upper() in ("RAW", "UNKNOWN"):
        return None
    bits = parsed.get("Bits")
    data = parsed.get("Data")
    if data is None:
        return None
    return f"proto:{protocol}:{bits}:{data}".lower()


def _pulses_from_code(code: str, encoding: str) -> list[int] | None:
    encoding = (encoding or "").strip().lower()

    if encoding == "tasmotair":
        try:
            parsed = json.loads(code)
        except (ValueError, TypeError):
            return None
        if not isinstance(parsed, dict):
            return None
        return _tasmota_raw_pulses(parsed)

    # Default / "base64" (Broadlink).
    return decode_broadlink_ir(code)


def classify_short_long(pulses: list[int]) -> str | None:
    """Bucket each pulse as short ('S') or long ('L') and join into a string.

    The split point is the median of the signal's own pulse durations, not
    a fixed threshold, so it adapts to whatever short/long ratio the signal
    happens to use. Median rather than a gap-based split deliberately: most
    consumer protocols spend the bulk of their pulses on data bits (one or
    two duration classes repeated many times) with a single long leader
    burst at the start. A split chosen by "biggest gap between distinct
    values" gets pulled toward that one outlier leader pulse instead of the
    bit-level short/long boundary that actually carries the signal's
    identity, which is what a median naturally resists.
    """
    if len(pulses) < _MIN_PULSES:
        return None

    threshold = statistics.median(pulses)
    if min(pulses) == max(pulses):
        return None

    return "".join("L" if p > threshold else "S" for p in pulses)


def fingerprint_command(code: str, encoding: str) -> str | None:
    """Best-effort identity for a stored command code.

    Returns a short, storage-friendly string: "sl:<hash>" for anything we
    could pulse-classify (Broadlink, Tasmota RAW), or "proto:..." for a
    Tasmota code Tasmota already decoded. None means "couldn't fingerprint
    this one" — callers should treat that as neutral, not a failure.
    """
    if not code:
        return None

    encoding_l = (encoding or "").strip().lower()
    if encoding_l == "tasmotair":
        try:
            parsed = json.loads(code)
        except (ValueError, TypeError):
            parsed = None
        if isinstance(parsed, dict):
            decoded_id = _decoded_protocol_identity(parsed)
            if decoded_id:
                return decoded_id

    pulses = _pulses_from_code(code, encoding)
    if not pulses:
        return None

    pattern = classify_short_long(pulses)
    if not pattern:
        return None

    digest = hashlib.sha1(pattern.encode("ascii")).hexdigest()[:16]
    return f"sl:{digest}"


def fingerprints_match(a: str | None, b: str | None) -> bool:
    """True only when both sides fingerprinted successfully and are equal.

    Two codes we couldn't fingerprint are never considered a match — that
    would produce false "this is a duplicate" warnings for every code this
    module can't read yet.
    """
    return bool(a) and bool(b) and a == b
