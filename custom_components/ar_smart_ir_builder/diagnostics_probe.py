"""
Deep diagnostic sweep — service reyee_local.deep_probe / button.

v3: probes the REAL module names captured from the eWeb (HAR), with the exact
request shapes the web UI uses (noParse flag + data sub-objects). Read-only:
uses devSta.get / devConfig.get / acConfig.get only, never a setter.
"""
import json
import logging

from homeassistant.components.persistent_notification import async_create

_LOGGER = logging.getLogger(__name__)

# (method, module, data, no_parse) — shapes taken verbatim from the eWeb capture.
_PROBES = [
    # ── the high-value unknowns ────────────────────────────────────────────
    ("devSta.get",    "port_status",     None,                              False),
    ("devSta.get",    "user_list",       {"devType": "all", "dataType": "timely"}, True),
    ("devSta.get",    "flow",            {"func": "interface_info"},        True),
    ("devConfig.get", "devRemark",       None,                              False),
    ("devSta.get",    "local_topology",  {"fromcache": "true", "caller": "eweb"}, True),
    ("devSta.get",    "ipinfo",          None,                              True),
    ("devSta.get",    "vlanRef",         None,                              False),
    ("devSta.get",    "networkConnect",  None,                              False),
    ("devSta.get",    "conflict_status", None,                              False),
    ("devSta.get",    "pppoeLog",        {"intf_name": ["wan"]},            False),
    ("devSta.get",    "pppoeLog",        {"intf_name": ["wan1"]},           False),
    ("devConfig.get", "dhcp_option",     None,                              False),
    ("devConfig.get", "hwnat",           None,                              False),
    # ── per-client flow variants worth trying ─────────────────────────────
    ("devSta.get",    "flow",            {"func": "user_info"},             True),
    ("devSta.get",    "flow",            {"func": "rate_info"},             True),
    ("devSta.get",    "user_list",       {"devType": "all", "dataType": "total"}, True),
    # ── AC (wireless controller) modules — APs are cloud but try anyway ────
    ("acConfig.get",  "wireless",        None,                              False),
    ("acConfig.get",  "wirelessMacFilter", None,                            False),
    ("acConfig.get",  "wqos",            None,                              False),
]


def _classify(body):
    if not isinstance(body, dict):
        return "other", str(body)[:2000]
    if "_error" in body:
        return "error", body["_error"]
    rcode = body.get("rcode")
    rmsg = body.get("rmsg") or body.get("message")
    data = body.get("data")
    if isinstance(data, str) and data.strip() == "":
        return "empty", ""
    if rcode and str(rcode) != "00000000":
        return "error", f"rcode={rcode} {rmsg or ''}"[:100]
    if rmsg and not data:
        return "error", str(rmsg)[:100]
    if data not in (None, {}, []):
        return "data", json.dumps(data, ensure_ascii=False)[:2000]
    real = {k: v for k, v in body.items()
            if k not in ("code", "id", "error", "rcode", "message", "rmsg", "data")}
    if real:
        return "data", json.dumps(real, ensure_ascii=False)[:2000]
    return "empty", ""


async def run_deep_probe(hass, coordinator):
    api = coordinator.api
    hits, empties, errors = [], [], []

    for method, module, data, no_parse in _PROBES:
        body = await api.raw_cmd(method, module, data=data, no_parse=no_parse)
        kind, preview = _classify(body)
        label = f"{method} {module}"
        if data:
            label += f" {json.dumps(data, ensure_ascii=False)}"
        if kind == "data":
            hits.append((label, preview))
        elif kind == "error":
            errors.append(module)
        else:
            empties.append(label)

    lines = [f"## Reyee Deep Probe v3\n\n**{len(hits)} modules returned real data.**\n"]
    for label, preview in hits:
        lines.append(f"### ✅ {label}\n```\n{preview}\n```\n")
    if empties:
        lines.append(f"\n**Empty (exist, unconfigured):** {', '.join(empties)}")
    if errors:
        lines.append(f"\n**Errored:** {', '.join(errors)}")

    async_create(
        hass, "\n".join(lines),
        title="Reyee Deep Probe v3",
        notification_id="reyee_deep_probe",
    )
    _LOGGER.info("Reyee deep probe v3: %d hits, %d empty, %d errors",
                 len(hits), len(empties), len(errors))
