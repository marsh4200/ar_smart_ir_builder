"""Tasmota IR backend, talking to the device over MQTT instead of HA's
`remote` entity domain (which Tasmota doesn't implement).

Tasmota's IR commands (https://tasmota.github.io/docs/IRSend/):
  Send:   publish JSON to        cmnd/<base_topic>/irsend
          e.g. {"Protocol":"NEC","Bits":32,"Data":"0x20DF10EF"}
          or, for protocols Tasmota can't decode (common on ACs):
          {"Protocol":"RAW","Data":[9000,4500,560,560, ...]}
  Learn:  enable IR receive on the device (SetOption58 1, or a dedicated
          IR-receive GPIO), then the device republishes any IR it sees to
          tele/<base_topic>/RESULT as {"IrReceived": {...}}.

We store the *Tasmota-ready send payload* as the "code" string in each
command slot — i.e. exactly the JSON object Tasmota expects after
"IRSend ". That keeps test/replay trivial: just publish it verbatim.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError

from .const import DEFAULT_MQTT_LEARN_TIMEOUT


def _send_topic(base_topic: str) -> str:
    return f"cmnd/{base_topic.strip('/')}/irsend"


def _result_topics(base_topic: str) -> list[str]:
    topic = base_topic.strip("/")
    # Tasmota publishes IrReceived results under tele/.../RESULT. Some
    # configurations (SetOption4) mirror command acks to stat/.../RESULT
    # too, so we listen on both to be safe.
    return [f"tele/{topic}/RESULT", f"stat/{topic}/RESULT"]


async def _get_mqtt(hass: HomeAssistant):
    if "mqtt" not in hass.config.components:
        raise HomeAssistantError(
            "MQTT integration is not set up in Home Assistant. Tasmota IR "
            "controllers require Settings → Devices & Services → MQTT to be "
            "configured first."
        )
    from homeassistant.components import mqtt

    return mqtt


def _code_to_payload(code: str) -> str:
    """Normalize a stored code into the JSON body that follows `IRSend `.

    Accepts either an already-JSON string (the normal case — what we store
    after learning, or what a user pastes in from Tasmota console output)
    or a bare object-less string, which is rejected with a clear error
    rather than silently sent garbage to the device.
    """
    code = code.strip()
    if not code:
        raise HomeAssistantError("Command has no stored code.")
    try:
        parsed = json.loads(code)
    except (ValueError, TypeError) as exc:
        raise HomeAssistantError(
            "This command's stored code isn't valid Tasmota IRSend JSON "
            "(expected something like {\"Protocol\":\"NEC\",\"Bits\":32,"
            "\"Data\":\"0x20DF10EF\"}). Re-learn or re-paste it."
        ) from exc
    if not isinstance(parsed, dict):
        raise HomeAssistantError("Tasmota IRSend code must be a JSON object.")
    return json.dumps(parsed)


async def async_send_tasmota_code(hass: HomeAssistant, base_topic: str, code: str) -> None:
    """Publish a single IRSend command for the given code."""
    mqtt = await _get_mqtt(hass)
    payload = _code_to_payload(code)
    await mqtt.async_publish(hass, _send_topic(base_topic), payload, qos=0, retain=False)


def _extract_ir_received(payload_obj: dict[str, Any]) -> dict[str, Any] | None:
    ir = payload_obj.get("IrReceived")
    if isinstance(ir, dict):
        return ir
    return None


def _ir_received_to_send_payload(ir: dict[str, Any]) -> dict[str, Any]:
    """Reshape a Tasmota IrReceived result into a ready-to-send IRSend body.

    Decoded protocols carry Protocol/Bits/Data and can be sent straight
    back. Protocols Tasmota can't decode show Protocol":"UNKNOWN" with a
    raw timing array (only present if SetOption58 1 is enabled on the
    device) — we fall back to a RAW send in that case. This is the same
    limitation Broadlink has with exotic AC remotes; some units may need
    manual correction either way.
    """
    protocol = ir.get("Protocol")
    if protocol and str(protocol).upper() != "UNKNOWN" and "Bits" in ir and "Data" in ir:
        return {
            "Protocol": protocol,
            "Bits": ir.get("Bits"),
            "Data": ir.get("Data"),
        }

    raw = ir.get("RawData") or ir.get("Pulse")
    if isinstance(raw, list) and raw:
        return {"Protocol": "RAW", "Data": raw}

    raise HomeAssistantError(
        "Tasmota couldn't decode that IR signal and didn't return raw timing "
        "data. On the Tasmota console run 'SetOption58 1' (enables raw "
        "capture for unknown protocols) and try learning again."
    )


async def async_learn_tasmota_code(
    hass: HomeAssistant,
    base_topic: str,
    timeout: float = DEFAULT_MQTT_LEARN_TIMEOUT,
) -> str:
    """Wait for the next IR signal the Tasmota device receives and return it
    as a JSON string ready to store/replay.

    Unlike Broadlink, Tasmota doesn't need an explicit "start learning"
    command — an IR-receive-enabled device republishes whatever it sees.
    So this just subscribes and waits for the next matching message; the
    caller is responsible for telling the user to press the remote button
    *after* calling this (or right around the same time — there's a
    `timeout` second window).
    """
    mqtt = await _get_mqtt(hass)
    result_future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()

    @callback
    def _on_message(msg) -> None:
        if result_future.done():
            return
        try:
            payload_obj = json.loads(msg.payload)
        except (ValueError, TypeError):
            return
        ir = _extract_ir_received(payload_obj)
        if ir is None:
            return
        if not result_future.done():
            result_future.set_result(ir)

    unsub_callbacks = []
    for topic in _result_topics(base_topic):
        unsub = await mqtt.async_subscribe(hass, topic, _on_message)
        unsub_callbacks.append(unsub)

    try:
        ir = await asyncio.wait_for(result_future, timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise HomeAssistantError(
            f"No IR signal received within {int(timeout)}s on "
            f"{', '.join(_result_topics(base_topic))}. Make sure IR receive "
            "is enabled on the Tasmota device and you pressed the remote "
            "button while this was waiting."
        ) from exc
    finally:
        for unsub in unsub_callbacks:
            unsub()

    send_payload = _ir_received_to_send_payload(ir)
    return json.dumps(send_payload)
