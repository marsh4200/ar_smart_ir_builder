// AR Smart IR Builder — panel.js v2.0.0
// Full rebuild: test commands, HA script export, polished remote UI

const RECOMMENDED = {
  climate: [
    ["Modes", ["off", "cool", "heat", "dry", "auto", "fan_only"]],
    ["Temperature", ["temp_16","temp_18","temp_20","temp_22","temp_24","temp_26","temp_28","temp_30"]],
    ["Fan speed", ["fan_low","fan_medium","fan_high","fan_auto"]],
    ["Swing", ["swing_on","swing_off"]],
  ],
  fan: [
    ["Power", ["on","off"]],
    ["Speed", ["fan_low","fan_medium","fan_high"]],
    ["Oscillation", ["swing_on","swing_off"]],
    ["Timer", ["timer_1h","timer_2h","timer_4h","timer_8h"]],
  ],
  media_player: [
    ["Power", ["power","power_on","power_off"]],
    ["Volume", ["volume_up","volume_down","mute"]],
    ["Playback", ["play","pause","stop","next","previous"]],
    ["Navigation", ["home","back","menu","ok","up","down","left","right"]],
    ["Sources", ["source_hdmi1","source_hdmi2","netflix","youtube"]],
  ],
  tv: [
    ["Power", ["power","power_on","power_off"]],
    ["Volume", ["volume_up","volume_down","mute"]],
    ["Channels", ["channel_up","channel_down"]],
    ["Navigation", ["home","back","menu","ok","up","down","left","right"]],
    ["Sources & apps", ["source_hdmi1","source_hdmi2","source_tv","netflix","youtube"]],
  ],
};

const TYPE_LABELS = { climate: "Climate", fan: "Fan", media_player: "Media player", tv: "TV" };
const TYPE_ICONS  = { climate: "❄️", fan: "🌀", media_player: "📺", tv: "📺" };

const COMMAND_HINTS = {
  off:"Power off", on:"Power on",
  cool:"Cooling mode", heat:"Heating mode", dry:"Dry / dehumidify",
  auto:"Auto mode", fan_only:"Fan only",
  fan_low:"Fan low speed", fan_medium:"Fan medium speed", fan_high:"Fan high speed", fan_auto:"Fan auto",
  swing_on:"Oscillation on", swing_off:"Oscillation off",
  power:"Power toggle", power_on:"Power on", power_off:"Power off",
  volume_up:"Volume +", volume_down:"Volume −", mute:"Mute toggle",
  play:"Play", pause:"Pause", stop:"Stop", next:"Next track", previous:"Previous track",
  channel_up:"Channel +", channel_down:"Channel −",
  home:"Home screen", back:"Back", menu:"Menu", ok:"Confirm / OK",
  up:"Up", down:"Down", left:"Left", right:"Right",
  source_hdmi1:"HDMI 1", source_hdmi2:"HDMI 2", source_tv:"TV input",
  netflix:"Netflix", youtube:"YouTube",
  timer_1h:"Timer 1 hour", timer_2h:"Timer 2 hours",
  timer_4h:"Timer 4 hours", timer_8h:"Timer 8 hours",
};

function humanize(key) {
  return String(key || "").replace(/[_-]+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}
function slugify(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// ─── Remote layout maps ────────────────────────────────────────────────────

const REMOTE_LAYOUTS = {
  tv: [
    { type: "row", btns: [
      { cmd: "power", icon: "⏻", label: "Power", cls: "power" },
      { cmd: "mute", icon: "🔇", label: "Mute" },
      { cmd: "source_hdmi1", icon: "⬡", label: "HDMI 1" },
    ]},
    { type: "row", btns: [
      { cmd: "channel_up", icon: "▲", label: "CH +" },
      { cmd: "volume_up", icon: "＋", label: "Vol +" },
    ]},
    { type: "dpad" },
    { type: "row", btns: [
      { cmd: "channel_down", icon: "▼", label: "CH −" },
      { cmd: "volume_down", icon: "－", label: "Vol −" },
    ]},
    { type: "row", btns: [
      { cmd: "home", icon: "⌂", label: "Home" },
      { cmd: "back", icon: "↩", label: "Back" },
      { cmd: "menu", icon: "☰", label: "Menu" },
    ]},
    { type: "row", btns: [
      { cmd: "play", icon: "▶", label: "Play" },
      { cmd: "pause", icon: "⏸", label: "Pause" },
      { cmd: "stop", icon: "⏹", label: "Stop" },
    ]},
    { type: "row", btns: [
      { cmd: "netflix", icon: "N", label: "Netflix", cls:"app" },
      { cmd: "youtube", icon: "▶", label: "YouTube", cls:"app" },
    ]},
  ],
  media_player: [
    { type: "row", btns: [
      { cmd: "power", icon: "⏻", label: "Power", cls: "power" },
      { cmd: "mute", icon: "🔇", label: "Mute" },
    ]},
    { type: "row", btns: [
      { cmd: "volume_up", icon: "＋", label: "Vol +" },
      { cmd: "volume_down", icon: "－", label: "Vol −" },
    ]},
    { type: "dpad" },
    { type: "row", btns: [
      { cmd: "home", icon: "⌂", label: "Home" },
      { cmd: "back", icon: "↩", label: "Back" },
      { cmd: "menu", icon: "☰", label: "Menu" },
    ]},
    { type: "row", btns: [
      { cmd: "previous", icon: "⏮", label: "Prev" },
      { cmd: "play", icon: "▶", label: "Play" },
      { cmd: "pause", icon: "⏸", label: "Pause" },
      { cmd: "next", icon: "⏭", label: "Next" },
    ]},
    { type: "row", btns: [
      { cmd: "netflix", icon: "N", label: "Netflix", cls:"app" },
      { cmd: "youtube", icon: "▶", label: "YouTube", cls:"app" },
    ]},
  ],
  climate: [
    { type: "row", btns: [
      { cmd: "off", icon: "⏻", label: "Off", cls: "power" },
      { cmd: "cool", icon: "❄", label: "Cool" },
      { cmd: "heat", icon: "♨", label: "Heat" },
      { cmd: "auto", icon: "⟳", label: "Auto" },
    ]},
    { type: "row", btns: [
      { cmd: "dry", icon: "💧", label: "Dry" },
      { cmd: "fan_only", icon: "🌀", label: "Fan" },
    ]},
    { type: "row", btns: [
      { cmd: "temp_18", icon: "18°", label: "18°C" },
      { cmd: "temp_20", icon: "20°", label: "20°C" },
      { cmd: "temp_22", icon: "22°", label: "22°C" },
      { cmd: "temp_24", icon: "24°", label: "24°C" },
    ]},
    { type: "row", btns: [
      { cmd: "temp_26", icon: "26°", label: "26°C" },
      { cmd: "temp_28", icon: "28°", label: "28°C" },
      { cmd: "temp_30", icon: "30°", label: "30°C" },
    ]},
    { type: "row", btns: [
      { cmd: "fan_low", icon: "〜", label: "Low" },
      { cmd: "fan_medium", icon: "〰", label: "Med" },
      { cmd: "fan_high", icon: "≈", label: "High" },
      { cmd: "fan_auto", icon: "⟳", label: "Auto" },
    ]},
    { type: "row", btns: [
      { cmd: "swing_on", icon: "↕", label: "Swing On" },
      { cmd: "swing_off", icon: "—", label: "Swing Off" },
    ]},
  ],
  fan: [
    { type: "row", btns: [
      { cmd: "on", icon: "⏻", label: "On", cls: "power" },
      { cmd: "off", icon: "⏹", label: "Off" },
    ]},
    { type: "row", btns: [
      { cmd: "fan_low", icon: "〜", label: "Low" },
      { cmd: "fan_medium", icon: "〰", label: "Med" },
      { cmd: "fan_high", icon: "≈", label: "High" },
    ]},
    { type: "row", btns: [
      { cmd: "swing_on", icon: "↕", label: "Oscillate On" },
      { cmd: "swing_off", icon: "—", label: "Oscillate Off" },
    ]},
    { type: "row", btns: [
      { cmd: "timer_1h", icon: "1h", label: "Timer 1h" },
      { cmd: "timer_2h", icon: "2h", label: "Timer 2h" },
      { cmd: "timer_4h", icon: "4h", label: "Timer 4h" },
    ]},
  ],
};

// ─── Component ────────────────────────────────────────────────────────────

class ARSmartIRPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._data = { entries: [], store: { devices: {} } };
    this._step = 1;
    this._busy = false;
    this._currentKey = "";
    this._testFeedback = {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._rendered = true;
      this._render();
      this._attachEvents();
      this._load();
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _render() {
    this.innerHTML = `
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { display: block; }

  .ir-wrap {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px 24px 60px;
    color: var(--primary-text-color);
    font-family: var(--paper-font-body1_-_font-family, sans-serif);
  }

  /* Header */
  .ir-header {
    display: flex; align-items: center; gap: 14px; margin-bottom: 22px;
  }
  .ir-header-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: var(--primary-color);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; flex-shrink: 0;
  }
  .ir-header h1 { font-size: 20px; font-weight: 700; }
  .ir-header .ir-version { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }
  .ir-remote-select {
    margin-left: auto;
    padding: 7px 10px; border-radius: 9px;
    border: 1px solid rgba(127,127,127,.3);
    background: var(--secondary-background-color, rgba(0,0,0,.04));
    color: var(--primary-text-color); font-size: 13px;
    max-width: 220px;
  }

  /* Setup guard */
  .ir-setup-guard {
    display: none; padding: 28px; border-radius: 18px;
    background: rgba(127,127,127,.07);
    border: 1px solid rgba(127,127,127,.2);
    text-align: center; margin-bottom: 20px;
  }
  .ir-setup-guard.show { display: block; }
  .ir-setup-guard h2 { font-size: 17px; margin-bottom: 8px; }
  .ir-setup-guard p { font-size: 14px; color: var(--secondary-text-color); margin-bottom: 18px; }

  /* Steps */
  .ir-steps {
    display: flex; gap: 0; border-bottom: 1px solid rgba(127,127,127,.18);
    margin-bottom: 20px; overflow-x: auto;
  }
  .ir-step-tab {
    display: flex; align-items: center; gap: 7px;
    padding: 11px 16px;
    background: none; border: none; border-bottom: 2px solid transparent;
    cursor: pointer; font-size: 13px; font-weight: 600;
    color: var(--secondary-text-color);
    transition: color .15s; white-space: nowrap;
  }
  .ir-step-tab:hover { color: var(--primary-text-color); }
  .ir-step-tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
  .ir-step-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; border-radius: 50%;
    font-size: 11px; font-weight: 700;
    background: rgba(127,127,127,.14); color: var(--secondary-text-color);
  }
  .ir-step-tab.active .ir-step-num { background: var(--primary-color); color: #fff; }
  .ir-step-tab.done .ir-step-num { background: #1a9966; color: #fff; }
  .ir-step-tab.done .ir-step-num::after { content: "✓"; }

  /* Cards */
  .ir-card {
    background: var(--card-background-color, rgba(255,255,255,.03));
    border: 1px solid rgba(127,127,127,.18);
    border-radius: 18px; padding: 22px; margin-bottom: 14px;
  }
  .ir-card-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .ir-card-desc {
    font-size: 13px; color: var(--secondary-text-color);
    line-height: 1.55; margin-bottom: 18px;
  }

  /* Panels */
  .ir-panel { display: none; }
  .ir-panel.active { display: block; }

  /* Grid */
  .ir-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 640px) { .ir-grid2 { grid-template-columns: 1fr; } }

  /* Fields */
  .ir-field { margin-bottom: 14px; }
  .ir-field label {
    display: block; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .07em;
    color: var(--secondary-text-color); margin-bottom: 5px;
  }
  .ir-field input, .ir-field select {
    width: 100%; padding: 9px 12px; border-radius: 10px;
    border: 1px solid rgba(127,127,127,.32);
    background: var(--secondary-background-color, rgba(0,0,0,.04));
    color: var(--primary-text-color); font-size: 14px;
    transition: border-color .15s;
  }
  .ir-field input:focus, .ir-field select:focus {
    outline: none; border-color: var(--primary-color);
  }
  .ir-hint { font-size: 12px; color: var(--secondary-text-color); margin-top: 4px; }

  /* Buttons */
  .ir-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .ir-btn {
    min-height: 38px; padding: 0 16px; border-radius: 999px;
    border: none; cursor: pointer; font-size: 13px; font-weight: 700;
    transition: opacity .15s, transform .1s;
  }
  .ir-btn:active { transform: scale(.97); }
  .ir-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
  .ir-btn-primary { background: var(--primary-color); color: #fff; }
  .ir-btn-secondary { background: rgba(127,127,127,.14); color: var(--primary-text-color); }
  .ir-btn-ghost { background: transparent; border: 1px solid rgba(127,127,127,.25); color: var(--primary-text-color); }
  .ir-btn-success { background: #1a9966; color: #fff; }
  .ir-btn-danger { background: transparent; border: 1px solid rgba(220,50,50,.4); color: #e03030; }
  .ir-btn-sm { min-height: 30px; padding: 0 12px; font-size: 12px; }

  /* Callouts */
  .ir-callout {
    padding: 11px 14px; border-radius: 12px; font-size: 13px;
    line-height: 1.5; margin-bottom: 14px; display: none;
  }
  .ir-callout.show { display: block; }
  .ir-callout.info { background: rgba(27,122,255,.09); border: 1px solid rgba(27,122,255,.22); }
  .ir-callout.success { background: rgba(26,153,107,.1); border: 1px solid rgba(26,153,107,.25); }
  .ir-callout.error { background: rgba(220,50,50,.09); border: 1px solid rgba(220,50,50,.25); color: #c83030; }
  .ir-callout.learning { background: rgba(250,150,0,.09); border: 1px solid rgba(250,150,0,.3); }

  /* Profile list */
  .ir-profile-list { display: grid; gap: 8px; }
  .ir-profile-item {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    border-radius: 12px; border: 1px solid rgba(127,127,127,.18);
    background: var(--card-background-color, rgba(255,255,255,.03));
    cursor: pointer; transition: border-color .15s, background .15s;
  }
  .ir-profile-item:hover { border-color: rgba(127,127,127,.35); }
  .ir-profile-item.selected { border-color: var(--primary-color); background: rgba(27,122,255,.06); }
  .ir-profile-icon {
    width: 36px; height: 36px; border-radius: 9px;
    background: rgba(127,127,127,.12);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; flex-shrink: 0;
  }
  .ir-profile-name { font-weight: 700; font-size: 14px; }
  .ir-profile-meta { font-size: 12px; color: var(--secondary-text-color); }
  .ir-profile-badges { margin-left: auto; display: flex; gap: 6px; align-items: center; }
  .ir-badge {
    font-size: 11px; font-weight: 700; padding: 3px 9px;
    border-radius: 999px;
    background: rgba(127,127,127,.12); color: var(--secondary-text-color);
  }
  .ir-badge.green { background: rgba(26,153,107,.15); color: #0f6e56; }
  .ir-badge.blue { background: rgba(27,122,255,.12); color: #185fa5; }

  /* Coverage bar */
  .ir-cov-bar {
    height: 5px; border-radius: 3px;
    background: rgba(127,127,127,.15); margin: 10px 0 6px; overflow: hidden;
  }
  .ir-cov-fill {
    height: 100%; border-radius: 3px;
    background: #1a9966; transition: width .4s ease;
  }

  /* Stats */
  .ir-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .ir-stat {
    flex: 1; min-width: 90px; padding: 10px 13px;
    border-radius: 11px;
    background: var(--card-background-color, rgba(255,255,255,.03));
    border: 1px solid rgba(127,127,127,.14);
  }
  .ir-stat-k { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color); margin-bottom: 3px; }
  .ir-stat-v { font-size: 16px; font-weight: 700; }

  /* Pills */
  .ir-pill-group { margin-top: 18px; }
  .ir-pill-group-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--secondary-text-color); margin-bottom: 8px; }
  .ir-pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .ir-pill {
    padding: 6px 13px; border-radius: 999px; font-size: 12px; font-weight: 600;
    border: 1px solid rgba(127,127,127,.25); background: rgba(127,127,127,.08);
    cursor: pointer; color: var(--primary-text-color);
    transition: background .12s, border-color .12s, transform .08s;
  }
  .ir-pill:hover { background: rgba(127,127,127,.16); border-color: rgba(127,127,127,.4); }
  .ir-pill:active { transform: scale(.94); }
  .ir-pill.learned { background: rgba(26,153,107,.13); border-color: rgba(26,153,107,.35); color: #0f6e56; }

  /* Learn row */
  .ir-cmd-row { display: flex; gap: 8px; align-items: flex-end; }
  .ir-cmd-row .ir-field { flex: 1; margin-bottom: 0; }

  /* Spinner */
  .ir-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
    border-radius: 50%; animation: ir-spin .6s linear infinite;
    vertical-align: middle; margin-right: 6px;
  }
  @keyframes ir-spin { to { transform: rotate(360deg); } }
  @keyframes ir-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
  .ir-learning-pulse { animation: ir-pulse 1.2s ease-in-out infinite; }

  /* Delete confirm */
  .ir-delete-confirm {
    display: none; margin-top: 10px; padding: 12px 14px; border-radius: 11px;
    background: rgba(220,50,50,.07); border: 1px solid rgba(220,50,50,.22);
  }
  .ir-delete-confirm.show { display: block; }
  .ir-delete-confirm p { font-size: 13px; margin-bottom: 10px; }

  /* Repeat / Retry editor */
  .ir-rep-empty {
    font-size: 13px; color: var(--secondary-text-color);
    padding: 10px 0 4px;
  }
  .ir-rep-row {
    display: grid;
    grid-template-columns: minmax(140px, 1.4fr) 78px 92px 70px 36px;
    gap: 8px; align-items: center;
    padding: 8px 10px; border-radius: 10px;
    background: rgba(127,127,127,.06);
    border: 1px solid rgba(127,127,127,.15);
    margin-bottom: 6px;
  }
  .ir-rep-row.is-active {
    background: rgba(26,153,107,.08);
    border-color: rgba(26,153,107,.30);
  }
  .ir-rep-name {
    font-size: 13px; font-weight: 500;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ir-rep-row input[type="number"], .ir-rep-row select {
    width: 100%; padding: 5px 6px; font-size: 13px; box-sizing: border-box;
    border: 1px solid var(--divider-color); border-radius: 6px;
    background: var(--card-background-color); color: var(--primary-text-color);
  }
  .ir-rep-clear {
    background: transparent; border: none; cursor: pointer;
    color: var(--secondary-text-color); font-size: 16px;
    padding: 4px 6px; border-radius: 6px;
  }
  .ir-rep-clear:hover { background: rgba(220,50,50,.1); color: #c33; }
  .ir-rep-add-row { display: flex; gap: 8px; align-items: flex-end; margin-top: 8px; }
  .ir-rep-add-row .ir-field { flex: 1; margin-bottom: 0; }
  .ir-rep-head {
    display: grid;
    grid-template-columns: minmax(140px, 1.4fr) 78px 92px 70px 36px;
    gap: 8px;
    font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--secondary-text-color);
    padding: 0 10px 4px;
  }

  /* Checklist */
  .ir-checklist { display: grid; gap: 6px; }
  .ir-cl-item {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 10px 13px; border-radius: 11px;
    background: rgba(127,127,127,.07); border: 1px solid transparent;
    cursor: pointer; transition: background .12s;
  }
  .ir-cl-item:hover { background: rgba(127,127,127,.12); }
  .ir-cl-item.learned { background: rgba(26,153,107,.08); border-color: rgba(26,153,107,.22); }
  .ir-cl-name { font-weight: 700; font-size: 13px; }
  .ir-cl-hint { font-size: 12px; color: var(--secondary-text-color); }
  .ir-cl-badge {
    font-size: 11px; font-weight: 700; padding: 3px 9px;
    border-radius: 999px; flex-shrink: 0;
    background: rgba(127,127,127,.12); color: var(--secondary-text-color);
  }
  .ir-cl-item.learned .ir-cl-badge { background: rgba(26,153,107,.18); color: #0f6e56; }

  /* Raw export */
  .ir-mono {
    font-family: "JetBrains Mono", "Fira Code", monospace; font-size: 12px;
    padding: 14px; border-radius: 12px;
    background: rgba(0,0,0,.2); color: rgba(255,255,255,.8);
    white-space: pre-wrap; word-break: break-all;
    max-height: 220px; overflow-y: auto; margin-top: 10px;
  }
  details summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--secondary-text-color); margin-top: 14px; }
  details summary:hover { color: var(--primary-text-color); }
  .ir-advanced summary { font-size: 12px; margin-top: 0; margin-bottom: 12px; }

  /* ── Virtual Remote ── */
  .ir-remote-wrap {
    display: flex; flex-direction: column; align-items: center;
    gap: 0;
  }
  .ir-remote-shell {
    background: var(--card-background-color, #1e1e2e);
    border: 1px solid rgba(127,127,127,.25);
    border-radius: 28px; padding: 22px 18px 28px;
    width: 100%; max-width: 340px;
    box-shadow: 0 4px 24px rgba(0,0,0,.18);
  }
  .ir-remote-top {
    text-align: center; margin-bottom: 16px;
    font-size: 12px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: var(--secondary-text-color);
  }
  .ir-remote-row {
    display: flex; justify-content: center; gap: 10px;
    margin-bottom: 10px; flex-wrap: wrap;
  }
  .ir-rbtn {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    min-width: 58px; min-height: 52px; padding: 8px 10px;
    border-radius: 14px; border: 1px solid rgba(127,127,127,.22);
    background: rgba(127,127,127,.09);
    cursor: pointer; color: var(--primary-text-color);
    font-size: 18px; font-weight: 700;
    transition: background .1s, transform .08s, border-color .1s;
    position: relative;
  }
  .ir-rbtn:hover { background: rgba(127,127,127,.18); border-color: rgba(127,127,127,.4); }
  .ir-rbtn:active { transform: scale(.92); background: rgba(127,127,127,.28); }
  .ir-rbtn.power { background: rgba(220,50,50,.12); border-color: rgba(220,50,50,.3); }
  .ir-rbtn.power:hover { background: rgba(220,50,50,.22); }
  .ir-rbtn.app { background: rgba(27,122,255,.1); border-color: rgba(27,122,255,.25); font-size: 13px; }
  .ir-rbtn.app:hover { background: rgba(27,122,255,.2); }
  .ir-rbtn-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color); }
  .ir-rbtn.missing { opacity: .28; cursor: not-allowed; }
  .ir-rbtn.missing:hover { background: rgba(127,127,127,.09); border-color: rgba(127,127,127,.22); transform: none; }
  .ir-rbtn.testing { animation: ir-pulse .5s ease-in-out 3; }
  .ir-rbtn.sent { border-color: rgba(26,153,107,.5) !important; background: rgba(26,153,107,.15) !important; }

  /* D-Pad */
  .ir-dpad {
    display: grid;
    grid-template-areas: ". up ." "left ok right" ". down .";
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px; margin: 0 auto 10px; width: fit-content;
  }
  .ir-dpad .up    { grid-area: up; }
  .ir-dpad .down  { grid-area: down; }
  .ir-dpad .left  { grid-area: left; }
  .ir-dpad .right { grid-area: right; }
  .ir-dpad .ok    { grid-area: ok; border-radius: 50%; width: 52px; height: 52px; }

  /* Test feedback strip */
  .ir-test-strip {
    font-size: 12px; color: var(--secondary-text-color);
    text-align: center; margin-top: 12px; min-height: 20px;
    transition: color .2s;
  }
  .ir-test-strip.ok { color: #1a9966; font-weight: 700; }
  .ir-test-strip.err { color: #e03030; }

  /* Export tab layout */
  .ir-export-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
  }
  @media (max-width: 640px) { .ir-export-grid { grid-template-columns: 1fr; } }
  .ir-export-card {
    padding: 18px; border-radius: 14px;
    border: 1px solid rgba(127,127,127,.18);
    background: var(--card-background-color, rgba(255,255,255,.03));
  }
  .ir-export-card h3 { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
  .ir-export-card p { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 14px; line-height: 1.5; }

  @media (max-width: 540px) {
    .ir-wrap { padding: 14px 14px 40px; }
    .ir-step-tab { padding: 10px 11px; font-size: 12px; }
  }
</style>

<div class="ir-wrap">

  <!-- Header -->
  <div class="ir-header">
    <div class="ir-header-icon">📡</div>
    <div>
      <h1>AR Smart IR Builder</h1>
      <div class="ir-version">v2.0.0</div>
    </div>
    <select id="ir-entry" class="ir-remote-select" title="Select remote"></select>
  </div>

  <!-- Setup guard -->
  <div id="ir-setup-guard" class="ir-setup-guard">
    <h2>Integration setup required</h2>
    <p id="ir-setup-msg">Go to Settings → Devices &amp; Services and add the AR Smart IR Builder integration with at least one Broadlink remote.</p>
    <div class="ir-actions" style="justify-content:center">
      <button class="ir-btn ir-btn-primary" id="ir-open-integrations">Open integrations</button>
      <button class="ir-btn ir-btn-secondary" id="ir-retry">Retry</button>
    </div>
  </div>

  <!-- Global callout -->
  <div id="ir-callout" class="ir-callout"></div>

  <!-- Step tabs -->
  <div class="ir-steps">
    <button class="ir-step-tab" data-step="1">
      <span class="ir-step-num">1</span><span class="ir-step-label">Profiles</span>
    </button>
    <button class="ir-step-tab" data-step="2">
      <span class="ir-step-num">2</span><span class="ir-step-label">Details</span>
    </button>
    <button class="ir-step-tab" data-step="3">
      <span class="ir-step-num">3</span><span class="ir-step-label">Learn</span>
    </button>
    <button class="ir-step-tab" data-step="4">
      <span class="ir-step-num">4</span><span class="ir-step-label">Test Remote</span>
    </button>
    <button class="ir-step-tab" data-step="5">
      <span class="ir-step-num">5</span><span class="ir-step-label">Export</span>
    </button>
  </div>

  <!-- ── Step 1: Profiles ── -->
  <div class="ir-panel" data-panel="1">
    <div class="ir-card">
      <div class="ir-card-title">Your profiles</div>
      <div class="ir-card-desc">Pick a profile to continue, or create a new one.</div>
      <div id="ir-profile-list" class="ir-profile-list"></div>
      <div class="ir-actions" style="margin-top:14px">
        <button class="ir-btn ir-btn-primary" id="ir-new-profile">+ New profile</button>
      </div>
    </div>

    <div class="ir-card" style="border-color:rgba(220,50,50,.2)">
      <div class="ir-card-title" style="font-size:13px">Remove integration entry</div>
      <div class="ir-card-desc" style="margin-bottom:12px">Permanently delete a Broadlink remote entry and all its profiles. Cannot be undone.</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <select id="ir-delete-entry-select" class="ir-remote-select" style="flex:1;min-width:180px"></select>
        <button class="ir-btn ir-btn-danger" id="ir-delete-entry-btn">Delete entry</button>
      </div>
      <div id="ir-delete-entry-confirm" class="ir-delete-confirm">
        <p>Delete <strong id="ir-delete-entry-name"></strong>? All profiles for this remote are permanently removed.</p>
        <div class="ir-actions" style="margin-top:0">
          <button class="ir-btn ir-btn-danger ir-btn-sm" id="ir-delete-entry-confirm-btn">Yes, delete permanently</button>
          <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-delete-entry-cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Step 2: Details ── -->
  <div class="ir-panel" data-panel="2">
    <div class="ir-card">
      <div class="ir-card-title" id="ir-details-title">New profile</div>
      <div class="ir-card-desc">Fill in the basics. Advanced fields enrich the SmartIR export.</div>
      <div class="ir-grid2">
        <div>
          <div class="ir-field">
            <label>Device name</label>
            <input id="ir-name" placeholder="Living Room TV" autocomplete="off">
          </div>
          <div class="ir-field">
            <label>Device key <span style="font-weight:400;text-transform:none;letter-spacing:0">(internal ID)</span></label>
            <input id="ir-key" placeholder="living_room_tv" autocomplete="off">
            <div class="ir-hint">Lowercase letters, numbers, underscores. Auto-fills from name.</div>
          </div>
          <div class="ir-field">
            <label>Type</label>
            <select id="ir-type">
              <option value="climate">Climate / air conditioner</option>
              <option value="fan">Fan</option>
              <option value="media_player">Media player</option>
              <option value="tv">TV</option>
            </select>
          </div>
        </div>
        <details class="ir-advanced">
          <summary>Advanced fields (optional)</summary>
          <div class="ir-field" style="margin-top:10px">
            <label>Manufacturer</label>
            <input id="ir-manufacturer" placeholder="Samsung">
          </div>
          <div class="ir-field">
            <label>Model</label>
            <input id="ir-model" placeholder="UA55AU7000">
          </div>
          <div class="ir-field">
            <label>Supported models</label>
            <input id="ir-supported-models" placeholder="UA55AU7000, UA65AU7000">
            <div class="ir-hint">Comma-separated. Leave blank for single model.</div>
          </div>
        </details>
      </div>
      <div class="ir-actions">
        <button class="ir-btn ir-btn-primary" id="ir-save-details">Save &amp; continue →</button>
        <button class="ir-btn ir-btn-ghost" id="ir-back-to-1">← Back</button>
      </div>
    </div>
  </div>

  <!-- ── Step 3: Learn ── -->
  <div class="ir-panel" data-panel="3">
    <div class="ir-card">
      <div class="ir-card-title">Learn commands</div>
      <div class="ir-card-desc">Click a command pill to fill the name, then click Learn and press the button on your remote.</div>

      <div class="ir-stats">
        <div class="ir-stat"><div class="ir-stat-k">Learned</div><div class="ir-stat-v" id="ir-stat-learned">0</div></div>
        <div class="ir-stat"><div class="ir-stat-k">Coverage</div><div class="ir-stat-v" id="ir-stat-cov">0 / 0</div></div>
        <div class="ir-stat"><div class="ir-stat-k">Profile</div><div class="ir-stat-v" id="ir-stat-name">—</div></div>
      </div>
      <div class="ir-cov-bar"><div class="ir-cov-fill" id="ir-cov-fill" style="width:0%"></div></div>
      <div id="ir-learn-callout" class="ir-callout" style="display:none"></div>

      <div class="ir-cmd-row">
        <div class="ir-field">
          <label>Command name</label>
          <input id="ir-cmd" list="ir-cmd-list" placeholder="e.g. power_on" autocomplete="off">
          <datalist id="ir-cmd-list"></datalist>
        </div>
        <button class="ir-btn ir-btn-primary" id="ir-learn-btn" style="flex-shrink:0;margin-bottom:0">Learn</button>
        <button class="ir-btn ir-btn-secondary" id="ir-paste-btn" style="flex-shrink:0;margin-bottom:0" title="Paste a Base64 code instead of capturing">Paste code</button>
      </div>

      <div id="ir-paste-card" class="ir-callout" style="display:none;margin-top:8px">
        <div style="font-weight:600;margin-bottom:6px">Paste Base64 code for "<span id="ir-paste-cmd-label">—</span>"</div>
        <div style="font-size:12px;color:var(--secondary-text-color);margin-bottom:8px">
          Paste the Broadlink Base64 string (typically starts with <code>JgB</code> for IR or <code>sgB</code> for RF).
        </div>
        <textarea id="ir-paste-input" rows="4" style="width:100%;font-family:monospace;font-size:12px;padding:8px;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:6px;resize:vertical" placeholder="JgBQAAAB..."></textarea>
        <div class="ir-actions" style="margin-top:8px">
          <button class="ir-btn ir-btn-primary ir-btn-sm" id="ir-paste-save-btn">Save code</button>
          <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-paste-cancel-btn">Cancel</button>
        </div>
      </div>

      <div id="ir-pill-container"></div>

      <div class="ir-card" style="margin-top:18px;padding:14px 16px;background:rgba(127,127,127,.04);border:1px solid var(--divider-color)">
        <div class="ir-card-title" style="font-size:15px">Repeat / Retry</div>
        <div class="ir-card-desc" style="margin-bottom:10px">
          Some IR receivers miss the first pulse, or need a double/triple press (e.g. power off, mute, source).
          Set commands here to be sent more than once, with an optional delay between presses.
          Commands not listed below send once (default).
        </div>
        <div id="ir-rep-list"></div>

        <div class="ir-rep-add-row">
          <div class="ir-field">
            <label>Add command to repeat policy</label>
            <select id="ir-rep-add-select">
              <option value="">— Select a learned command —</option>
            </select>
          </div>
          <button class="ir-btn ir-btn-secondary ir-btn-sm" id="ir-rep-add-btn" style="margin-bottom:0">Add</button>
        </div>

        <div class="ir-actions" style="margin-top:12px">
          <button class="ir-btn ir-btn-primary ir-btn-sm" id="ir-rep-save-btn">Save repeat settings</button>
          <span id="ir-rep-status" style="font-size:12px;color:var(--secondary-text-color);align-self:center"></span>
        </div>
      </div>

      <div class="ir-actions" style="margin-top:20px">
        <button class="ir-btn ir-btn-secondary" id="ir-back-to-2">← Details</button>
        <button class="ir-btn ir-btn-ghost" id="ir-bulk-import-btn">Bulk import…</button>
        <button class="ir-btn ir-btn-ghost" id="ir-to-test" style="margin-left:auto">Test remote →</button>
      </div>

      <div id="ir-bulk-import-modal" class="ir-delete-confirm" style="display:none">
        <p style="font-weight:600;margin-bottom:4px">Bulk import codes</p>
        <p style="font-size:12px;color:var(--secondary-text-color);margin-top:0">
          Paste a JSON object mapping command names to Base64 codes. Existing commands with the same name will be overwritten.
        </p>
        <textarea id="ir-bulk-input" rows="8" style="width:100%;font-family:monospace;font-size:12px;padding:8px;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:6px;resize:vertical" placeholder='{
  "power": "JgBQAAAB...",
  "volume_up": "JgBQAAAB...",
  "volume_down": "JgBQAAAB..."
}'></textarea>
        <div id="ir-bulk-feedback" style="font-size:12px;margin-top:6px;min-height:16px"></div>
        <div class="ir-actions" style="margin-top:8px">
          <button class="ir-btn ir-btn-primary ir-btn-sm" id="ir-bulk-import-confirm-btn">Import codes</button>
          <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-bulk-import-cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Step 4: Test Remote ── -->
  <div class="ir-panel" data-panel="4">
    <div class="ir-grid2" style="align-items:start">
      <!-- Left: virtual remote -->
      <div class="ir-card" style="padding:18px">
        <div class="ir-card-title">Virtual remote</div>
        <div class="ir-card-desc" style="margin-bottom:12px">Click any button to fire the command immediately through your Broadlink.</div>
        <div class="ir-remote-wrap">
          <div class="ir-remote-shell">
            <div class="ir-remote-top" id="ir-remote-name">Remote</div>
            <div id="ir-remote-body"></div>
          </div>
          <div class="ir-test-strip" id="ir-test-strip">Ready — tap a button to test</div>
        </div>
      </div>

      <!-- Right: command list tester -->
      <div class="ir-card" style="padding:18px">
        <div class="ir-card-title">All commands</div>
        <div class="ir-card-desc" style="margin-bottom:12px">Test any stored command, including custom ones not on the remote layout.</div>
        <div id="ir-all-commands-list" style="display:grid;gap:6px;max-height:420px;overflow-y:auto"></div>

        <div class="ir-actions" style="margin-top:20px">
          <button class="ir-btn ir-btn-secondary" id="ir-back-to-3">← Learn more</button>
          <button class="ir-btn ir-btn-ghost" id="ir-to-export">Export →</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Step 5: Export ── -->
  <div class="ir-panel" data-panel="5">
    <div class="ir-card">
      <div class="ir-card-title">Export &amp; review</div>
      <div class="ir-card-desc">Export your profile in one or both formats, then use it in your HA setup.</div>

      <div class="ir-export-grid">
        <div class="ir-export-card">
          <h3>📦 SmartIR JSON</h3>
          <p>Compatible with the SmartIR integration. Exports to <code>/config/www/ar_smart_ir_exports/{key}.json</code>.</p>
          <button class="ir-btn ir-btn-primary" id="ir-export-smartir-btn">Export SmartIR JSON</button>
        </div>
        <div class="ir-export-card">
          <h3>📜 HA Scripts YAML</h3>
          <p>Generates a <code>scripts.yaml</code> snippet — one script per learned command. Copy into your HA config.</p>
          <button class="ir-btn ir-btn-success" id="ir-export-scripts-btn">Export HA Scripts</button>
        </div>
      </div>

      <div class="ir-actions" style="margin-top:18px">
        <button class="ir-btn ir-btn-secondary" id="ir-resave-btn">Re-save profile</button>
        <button class="ir-btn ir-btn-ghost" id="ir-back-to-4">← Test remote</button>
        <button class="ir-btn ir-btn-danger ir-btn-sm" id="ir-delete-btn" style="margin-left:auto">Delete profile</button>
      </div>

      <div id="ir-delete-confirm" class="ir-delete-confirm">
        <p>Delete <strong id="ir-delete-name"></strong>? Removes all learned commands. Cannot be undone.</p>
        <div class="ir-actions" style="margin-top:0">
          <button class="ir-btn ir-btn-danger ir-btn-sm" id="ir-delete-confirm-btn">Yes, delete</button>
          <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-delete-cancel-btn">Cancel</button>
        </div>
      </div>

      <details style="margin-top:20px" open>
        <summary>Recommended coverage</summary>
        <div id="ir-checklist" class="ir-checklist" style="margin-top:12px"></div>
      </details>
      <details style="margin-top:4px">
        <summary>Stored commands JSON (preview)</summary>
        <pre id="ir-raw" class="ir-mono">—</pre>
      </details>
    </div>
  </div>

</div>
    `;
  }

  // ── Events ───────────────────────────────────────────────────────────────

  _attachEvents() {
    this.querySelectorAll("[data-step]").forEach(btn =>
      btn.addEventListener("click", () => this._setStep(Number(btn.dataset.step)))
    );

    this.qs("#ir-entry").addEventListener("change", () => this._refreshDerivedUI());
    this.qs("#ir-open-integrations").onclick = () => window.location.assign("/config/integrations/dashboard");
    this.qs("#ir-retry").onclick = () => this._load();

    // Step 1
    this.qs("#ir-new-profile").onclick = () => { this._startNew(); this._setStep(2); };
    this.qs("#ir-delete-entry-btn").onclick = () => this._showDeleteEntryConfirm();
    this.qs("#ir-delete-entry-confirm-btn").onclick = () => this._deleteEntry();
    this.qs("#ir-delete-entry-cancel-btn").onclick = () =>
      this.qs("#ir-delete-entry-confirm").classList.remove("show");

    // Step 2
    this.qs("#ir-name").addEventListener("input", () => {
      const key = this.qs("#ir-key");
      if (!key.dataset.manualEdit) key.value = slugify(this.qs("#ir-name").value);
    });
    this.qs("#ir-key").addEventListener("input", () => {
      this.qs("#ir-key").dataset.manualEdit = "1";
    });
    this.qs("#ir-save-details").onclick = () => this._saveDetails();
    this.qs("#ir-back-to-1").onclick = () => this._setStep(1);

    // Step 3
    this.qs("#ir-learn-btn").onclick = () => this._learnCommand();
    this.qs("#ir-paste-btn").onclick = () => this._showPasteCard();
    this.qs("#ir-paste-save-btn").onclick = () => this._savePastedCode();
    this.qs("#ir-paste-cancel-btn").onclick = () => this._hidePasteCard();
    this.qs("#ir-bulk-import-btn").onclick = () => this._showBulkImport();
    this.qs("#ir-bulk-import-confirm-btn").onclick = () => this._runBulkImport();
    this.qs("#ir-bulk-import-cancel-btn").onclick = () => this._hideBulkImport();
    this.qs("#ir-back-to-2").onclick = () => this._setStep(2);
    this.qs("#ir-to-test").onclick = () => this._setStep(4);
    this.qs("#ir-cmd").addEventListener("keydown", e => { if (e.key === "Enter") this._learnCommand(); });

    // Step 3 — Repeat / Retry editor
    this.qs("#ir-rep-add-btn").onclick = () => this._addRepeatRow();
    this.qs("#ir-rep-save-btn").onclick = () => this._saveRepeatPolicy();

    // Step 4
    this.qs("#ir-back-to-3").onclick = () => this._setStep(3);
    this.qs("#ir-to-export").onclick = () => this._setStep(5);

    // Step 5
    this.qs("#ir-export-smartir-btn").onclick = () => this._exportSmartIR();
    this.qs("#ir-export-scripts-btn").onclick = () => this._exportHAScripts();
    this.qs("#ir-resave-btn").onclick = () => this._resaveProfile();
    this.qs("#ir-back-to-4").onclick = () => this._setStep(4);
    this.qs("#ir-delete-btn").onclick = () => this._showDeleteConfirm();
    this.qs("#ir-delete-confirm-btn").onclick = () => this._deleteProfile();
    this.qs("#ir-delete-cancel-btn").onclick = () =>
      this.qs("#ir-delete-confirm").classList.remove("show");
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  _setStep(step) {
    this._step = Math.min(5, Math.max(1, step));
    this.querySelectorAll("[data-step]").forEach(btn => {
      const n = Number(btn.dataset.step);
      btn.classList.toggle("active", n === this._step);
    });
    this.querySelectorAll(".ir-panel").forEach(panel => {
      panel.classList.toggle("active", Number(panel.dataset.panel) === this._step);
    });
    this._hideCallout();
    if (this._step === 3) { this._renderPills(); this._renderRepeatEditor(); }
    if (this._step === 4) this._renderTestRemote();
    if (this._step === 5) { this._renderChecklist(); this._renderRaw(); }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async _load() {
    try {
      this._data = await this._hass.callApi("GET", "ar_smart_ir_builder/data");
    } catch (err) {
      this._data = { entries: [], store: { devices: {} } };
      this._showSetupGuard(err?.body?.message || err?.message || "Cannot reach integration backend.");
      return;
    }
    if (!Array.isArray(this._data.entries) || this._data.entries.length === 0) {
      this._showSetupGuard();
      return;
    }
    this._hideSetupGuard();
    this._populateEntries();
    this._renderProfileList();
    this._refreshDerivedUI();
  }

  _populateEntries() {
    const sel = this.qs("#ir-entry");
    const prev = sel.value;
    sel.innerHTML = "";
    (this._data.entries || []).forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.entry_id;
      opt.text = e.remote_entity || e.title;
      sel.add(opt);
    });
    if (prev && this._data.entries.some(e => e.entry_id === prev)) sel.value = prev;

    const delSel = this.qs("#ir-delete-entry-select");
    if (delSel) {
      delSel.innerHTML = "";
      (this._data.entries || []).forEach(e => {
        const opt = document.createElement("option");
        opt.value = e.entry_id;
        opt.text = e.remote_entity || e.title;
        delSel.add(opt);
      });
    }
  }

  _renderProfileList() {
    const container = this.qs("#ir-profile-list");
    const devices = this._data.store?.devices || {};
    const keys = Object.keys(devices).sort();
    container.innerHTML = "";

    if (keys.length === 0) {
      container.innerHTML = `<p style="font-size:13px;color:var(--secondary-text-color)">No profiles yet. Click "New profile" to get started.</p>`;
      return;
    }

    keys.forEach(key => {
      const d = devices[key];
      const icon = TYPE_ICONS[d.device_type] || "📡";
      const cmdCount = Object.keys(d.commands || {}).length;
      const rec = (RECOMMENDED[d.device_type] || RECOMMENDED.climate).flatMap(([, c]) => c);
      const covered = rec.filter(c => d.commands?.[c]).length;
      const pct = rec.length ? Math.round(covered / rec.length * 100) : 0;

      const item = document.createElement("div");
      item.className = "ir-profile-item" + (key === this._currentKey ? " selected" : "");
      item.innerHTML = `
        <div class="ir-profile-icon">${icon}</div>
        <div style="flex:1;min-width:0">
          <div class="ir-profile-name">${d.name || humanize(key)}</div>
          <div class="ir-profile-meta">${TYPE_LABELS[d.device_type] || d.device_type} · ${key}</div>
        </div>
        <div class="ir-profile-badges">
          <span class="ir-badge">${cmdCount} cmd${cmdCount !== 1 ? "s" : ""}</span>
          <span class="ir-badge ${pct >= 80 ? "green" : pct >= 40 ? "blue" : ""}">${pct}%</span>
        </div>
      `;
      item.addEventListener("click", () => { this._loadProfile(key); this._setStep(2); });
      container.appendChild(item);
    });
  }

  // ── Profile form ──────────────────────────────────────────────────────────

  _startNew() {
    this._currentKey = "";
    this.qs("#ir-name").value = "";
    this.qs("#ir-key").value = "";
    delete this.qs("#ir-key").dataset.manualEdit;
    this.qs("#ir-type").value = "climate";
    this.qs("#ir-manufacturer").value = "";
    this.qs("#ir-model").value = "";
    this.qs("#ir-supported-models").value = "";
    this.qs("#ir-details-title").textContent = "New profile";
  }

  _loadProfile(key) {
    this._currentKey = key;
    const d = this._data.store?.devices?.[key] || {};
    this.qs("#ir-name").value = d.name || humanize(key);
    this.qs("#ir-key").value = key;
    this.qs("#ir-key").dataset.manualEdit = "1";
    this.qs("#ir-type").value = d.device_type || "climate";
    this.qs("#ir-manufacturer").value = d.manufacturer || "";
    this.qs("#ir-model").value = d.model || "";
    this.qs("#ir-supported-models").value = (d.supported_models || []).join(", ");
    this.qs("#ir-details-title").textContent = d.name || humanize(key);
    if (d.entry_id) {
      const sel = this.qs("#ir-entry");
      if ([...sel.options].some(o => o.value === d.entry_id)) sel.value = d.entry_id;
    }
  }

  _profilePayload() {
    const key = this.qs("#ir-key").value.trim();
    const name = this.qs("#ir-name").value.trim() || humanize(key);
    const model = this.qs("#ir-model").value.trim() || name;
    const rawModels = this.qs("#ir-supported-models").value.split(",").map(s => s.trim()).filter(Boolean);
    const existing = this._data.store?.devices?.[key] || {};
    return {
      device_key: key,
      entry_id: this.qs("#ir-entry").value,
      name, manufacturer: this.qs("#ir-manufacturer").value.trim(),
      model, device_type: this.qs("#ir-type").value || "climate",
      supported_models: rawModels.length ? rawModels : [model],
      commands: existing.commands || {},
    };
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async _saveDetails() {
    const key = this.qs("#ir-key").value.trim();
    const name = this.qs("#ir-name").value.trim();
    if (!key) { this._showCallout("Device key is required.", "error"); return; }
    if (!name) this.qs("#ir-name").value = humanize(key);
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());
      this._currentKey = key;
      await this._load();
      this._showCallout(`Profile "${name || humanize(key)}" saved.`, "success");
      this._setStep(3);
    });
  }

  async _learnCommand() {
    const cmdName = this.qs("#ir-cmd").value.trim();
    const entryId = this.qs("#ir-entry").value;
    const key = this._currentKey;
    if (!cmdName) { this._showLearnCallout("Enter a command name first.", "error"); return; }
    if (!key) { this._showCallout("Save a profile first.", "error"); this._setStep(2); return; }
    if (!entryId) { this._showCallout("Select a remote entry.", "error"); return; }
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());
      this._showLearnCallout(`⏳ Point remote at Broadlink and press the button for "${cmdName}"…`, "learning");
      this._setLearning(true);
      await this._hass.callApi(
        "POST",
        "services/ar_smart_ir_builder/learn_and_capture?return_response",
        { entry_id: entryId, device_key: key, command_name: cmdName }
      );
      this._setLearning(false);
      await this._load();
      this.qs("#ir-cmd").value = "";
      this._renderPills();
      this._showLearnCallout(`✓ "${cmdName}" learned successfully.`, "success");
    }, () => {
      this._setLearning(false);
      this._showLearnCallout("", "");
    });
  }

  _setLearning(on) {
    const btn = this.qs("#ir-learn-btn");
    btn.disabled = on;
    btn.innerHTML = on ? `<span class="ir-spinner"></span>Learning…` : "Learn";
  }

  // ── Paste single code ─────────────────────────────────────────────────────
  _isLikelyBase64(s) {
    if (typeof s !== "string") return false;
    const trimmed = s.trim();
    if (trimmed.length < 16) return false;
    // Standard + URL-safe base64, optional padding. Whitespace not allowed mid-string.
    if (!/^[A-Za-z0-9+/_\-]+={0,2}$/.test(trimmed)) return false;
    return true;
  }

  _showPasteCard() {
    const cmdName = this.qs("#ir-cmd").value.trim();
    if (!cmdName) {
      this._showLearnCallout("Enter a command name first, then click Paste code.", "error");
      return;
    }
    if (!this._currentKey) {
      this._showCallout("Save a profile first.", "error");
      this._setStep(2);
      return;
    }
    this.qs("#ir-paste-cmd-label").textContent = cmdName;
    this.qs("#ir-paste-input").value = "";
    this.qs("#ir-paste-card").style.display = "block";
    this.qs("#ir-paste-input").focus();
  }

  _hidePasteCard() {
    this.qs("#ir-paste-card").style.display = "none";
    this.qs("#ir-paste-input").value = "";
  }

  async _savePastedCode() {
    const cmdName = this.qs("#ir-cmd").value.trim();
    const code = this.qs("#ir-paste-input").value.trim();
    const key = this._currentKey;
    const entryId = this.qs("#ir-entry").value;

    if (!cmdName) { this._showLearnCallout("Command name is empty.", "error"); return; }
    if (!key) { this._showCallout("Save a profile first.", "error"); this._setStep(2); return; }
    if (!entryId) { this._showCallout("Select a remote entry.", "error"); return; }
    if (!code) { this._showLearnCallout("Paste a Base64 code first.", "error"); return; }
    if (!this._isLikelyBase64(code)) {
      this._showLearnCallout("That doesn't look like a valid Base64 code. Check for spaces, line breaks, or missing characters.", "error");
      return;
    }

    await this._run(async () => {
      // Merge the pasted code into the existing commands and save.
      const existing = this._data.store?.devices?.[key] || {};
      const mergedCommands = { ...(existing.commands || {}), [cmdName]: code };
      const payload = this._profilePayload();
      payload.commands = mergedCommands;

      await this._hass.callService("ar_smart_ir_builder", "save_device", payload);
      await this._load();
      this.qs("#ir-cmd").value = "";
      this._hidePasteCard();
      this._renderPills();
      this._showLearnCallout(`✓ "${cmdName}" code saved.`, "success");
    });
  }

  // ── Bulk import ───────────────────────────────────────────────────────────
  _showBulkImport() {
    if (!this._currentKey) {
      this._showCallout("Save a profile first.", "error");
      this._setStep(2);
      return;
    }
    this.qs("#ir-bulk-input").value = "";
    this.qs("#ir-bulk-feedback").textContent = "";
    this.qs("#ir-bulk-feedback").style.color = "";
    this.qs("#ir-bulk-import-modal").style.display = "block";
    this.qs("#ir-bulk-input").focus();
  }

  _hideBulkImport() {
    this.qs("#ir-bulk-import-modal").style.display = "none";
    this.qs("#ir-bulk-input").value = "";
    this.qs("#ir-bulk-feedback").textContent = "";
  }

  _parseBulkPayload(raw) {
    // Accept either a raw {cmd: code} object, or a full SmartIR-style file with a "commands" field.
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object.");
    }
    let commands = parsed;
    if (parsed.commands && typeof parsed.commands === "object" && !Array.isArray(parsed.commands)) {
      commands = parsed.commands;
    }

    // Flatten one level: SmartIR climate files often nest commands by mode/temp/fan.
    // We keep top-level string entries; if a value is an object we recurse and join keys with "_".
    const out = {};
    const walk = (prefix, obj) => {
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}_${k}` : k;
        if (typeof v === "string") {
          out[name] = v.trim();
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
          walk(name, v);
        }
        // ignore arrays/null/numbers
      }
    };
    walk("", commands);
    return out;
  }

  async _runBulkImport() {
    const raw = this.qs("#ir-bulk-input").value.trim();
    const feedback = this.qs("#ir-bulk-feedback");
    const key = this._currentKey;
    const entryId = this.qs("#ir-entry").value;

    if (!raw) { feedback.style.color = "#c0392b"; feedback.textContent = "Paste a JSON object first."; return; }
    if (!key) { this._showCallout("Save a profile first.", "error"); return; }
    if (!entryId) { this._showCallout("Select a remote entry.", "error"); return; }

    let imported;
    try {
      imported = this._parseBulkPayload(raw);
    } catch (e) {
      feedback.style.color = "#c0392b";
      feedback.textContent = e.message;
      return;
    }

    const valid = {};
    const skipped = [];
    for (const [name, code] of Object.entries(imported)) {
      if (this._isLikelyBase64(code)) {
        valid[name] = code;
      } else {
        skipped.push(name);
      }
    }

    if (Object.keys(valid).length === 0) {
      feedback.style.color = "#c0392b";
      feedback.textContent = "No valid Base64 codes found in the input.";
      return;
    }

    await this._run(async () => {
      const existing = this._data.store?.devices?.[key] || {};
      const mergedCommands = { ...(existing.commands || {}), ...valid };
      const payload = this._profilePayload();
      payload.commands = mergedCommands;

      await this._hass.callService("ar_smart_ir_builder", "save_device", payload);
      await this._load();
      this._renderPills();
      this._hideBulkImport();
      const importedCount = Object.keys(valid).length;
      let msg = `✓ Imported ${importedCount} command${importedCount === 1 ? "" : "s"}.`;
      if (skipped.length) msg += ` Skipped (invalid): ${skipped.join(", ")}.`;
      this._showLearnCallout(msg, "success");
    });
  }

  async _testCommandDirect(cmdName, btnEl) {
    const key = this._currentKey;
    const entryId = this.qs("#ir-entry").value;
    if (!key || !entryId || !cmdName) return;

    const strip = this.qs("#ir-test-strip");
    try {
      if (btnEl) { btnEl.classList.add("testing"); btnEl.disabled = true; }
      if (strip) { strip.className = "ir-test-strip"; strip.textContent = `Sending "${cmdName}"…`; }

      await this._hass.callApi(
        "POST",
        "services/ar_smart_ir_builder/test_command?return_response",
        { entry_id: entryId, device_key: key, command_name: cmdName }
      );

      if (btnEl) { btnEl.classList.remove("testing"); btnEl.classList.add("sent"); btnEl.disabled = false; setTimeout(() => btnEl?.classList.remove("sent"), 1200); }
      if (strip) { strip.className = "ir-test-strip ok"; strip.textContent = `✓ "${cmdName}" sent successfully`; }
    } catch (err) {
      if (btnEl) { btnEl.classList.remove("testing"); btnEl.disabled = false; }
      const msg = err?.body?.message || err?.message || String(err);
      if (strip) { strip.className = "ir-test-strip err"; strip.textContent = `✗ ${msg}`; }
    }
  }

  async _exportSmartIR() {
    const key = this._currentKey;
    if (!key) { this._showCallout("No profile selected.", "error"); return; }
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());
      await this._hass.callService("ar_smart_ir_builder", "export_device", { device_key: key });
      this._showCallout(`SmartIR JSON exported → /local/ar_smart_ir_exports/${key}.json`, "success");
      window.open(`/local/ar_smart_ir_exports/${key}.json`, "_blank");
    });
  }

  async _exportHAScripts() {
    const key = this._currentKey;
    if (!key) { this._showCallout("No profile selected.", "error"); return; }
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());
      await this._hass.callService("ar_smart_ir_builder", "export_ha_scripts", { device_key: key });
      this._showCallout(`HA scripts YAML exported → /local/ar_smart_ir_exports/${key}_scripts.yaml`, "success");
      window.open(`/local/ar_smart_ir_exports/${key}_scripts.yaml`, "_blank");
    });
  }

  async _resaveProfile() {
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());
      await this._load();
      this._showCallout("Profile re-saved.", "success");
    });
  }

  _showDeleteConfirm() {
    this.qs("#ir-delete-name").textContent = this.qs("#ir-name").value || this._currentKey;
    this.qs("#ir-delete-confirm").classList.add("show");
  }

  async _deleteProfile() {
    const key = this._currentKey;
    if (!key) return;
    this.qs("#ir-delete-confirm").classList.remove("show");
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "delete_device", {
        device_key: key, entry_id: this.qs("#ir-entry").value || undefined,
      });
      this._currentKey = "";
      await this._load();
      this._renderProfileList();
      this._startNew();
      this._showCallout(`Profile "${key}" deleted.`, "success");
      this._setStep(1);
    });
  }

  // ── Virtual Remote ────────────────────────────────────────────────────────

  _renderTestRemote() {
    const device = this._data.store?.devices?.[this._currentKey];
    const type = device?.device_type || this.qs("#ir-type")?.value || "climate";
    const commands = device?.commands || {};
    const layout = REMOTE_LAYOUTS[type] || REMOTE_LAYOUTS.tv;
    const name = device?.name || humanize(this._currentKey) || "Remote";

    const nameEl = this.qs("#ir-remote-name");
    if (nameEl) nameEl.textContent = name;

    const body = this.qs("#ir-remote-body");
    if (!body) return;
    body.innerHTML = "";

    layout.forEach(section => {
      if (section.type === "dpad") {
        const dpad = document.createElement("div");
        dpad.className = "ir-dpad";
        [
          { cmd: "up", icon: "▲", cls: "up" },
          { cmd: "left", icon: "◀", cls: "left" },
          { cmd: "ok", icon: "OK", cls: "ok" },
          { cmd: "right", icon: "▶", cls: "right" },
          { cmd: "down", icon: "▼", cls: "down" },
        ].forEach(({ cmd, icon, cls }) => {
          const btn = this._makeRemoteBtn({ cmd, icon, label: cmd }, commands, cls);
          dpad.appendChild(btn);
        });
        body.appendChild(dpad);
      } else {
        const row = document.createElement("div");
        row.className = "ir-remote-row";
        section.btns.forEach(b => row.appendChild(this._makeRemoteBtn(b, commands)));
        body.appendChild(row);
      }
    });

    // All commands list
    this._renderAllCommandsList(commands);
  }

  _makeRemoteBtn(def, commands, extraCls = "") {
    const { cmd, icon, label, cls: defCls = "" } = def;
    const has = !!commands[cmd];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `ir-rbtn ${defCls} ${extraCls} ${has ? "" : "missing"}`.trim();
    btn.title = has ? `Fire: ${cmd}` : `${cmd} — not learned yet`;
    btn.innerHTML = `<span>${icon}</span><span class="ir-rbtn-label">${label}</span>`;
    if (has) {
      btn.onclick = () => this._testCommandDirect(cmd, btn);
    }
    return btn;
  }

  _renderAllCommandsList(commands) {
    const container = this.qs("#ir-all-commands-list");
    if (!container) return;
    container.innerHTML = "";
    const keys = Object.keys(commands).sort();
    if (keys.length === 0) {
      container.innerHTML = `<p style="font-size:13px;color:var(--secondary-text-color)">No commands learned yet.</p>`;
      return;
    }
    keys.forEach(cmd => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(127,127,127,.07);border:1px solid transparent;";
      const info = document.createElement("div");
      info.innerHTML = `<div style="font-weight:700;font-size:13px">${cmd}</div><div style="font-size:11px;color:var(--secondary-text-color)">${COMMAND_HINTS[cmd] || "Custom command"}</div>`;
      const testBtn = document.createElement("button");
      testBtn.type = "button";
      testBtn.className = "ir-btn ir-btn-ghost ir-btn-sm";
      testBtn.textContent = "▶ Test";
      testBtn.style.flexShrink = "0";
      testBtn.onclick = async () => {
        testBtn.disabled = true;
        testBtn.textContent = "Sending…";
        row.style.borderColor = "rgba(27,122,255,.3)";
        try {
          await this._testCommandDirect(cmd, null);
          testBtn.textContent = "✓ Sent";
          row.style.borderColor = "rgba(26,153,107,.4)";
          row.style.background = "rgba(26,153,107,.08)";
          setTimeout(() => {
            testBtn.textContent = "▶ Test";
            testBtn.disabled = false;
            row.style.borderColor = "transparent";
            row.style.background = "rgba(127,127,127,.07)";
          }, 1500);
        } catch (err) {
          const msg = err?.body?.message || err?.message || (typeof err === "string" ? err : "Send failed");
          testBtn.textContent = "✗ Error";
          testBtn.title = msg;
          testBtn.disabled = false;
          row.style.borderColor = "rgba(220,50,50,.4)";
          const strip = this.qs("#ir-test-strip");
          if (strip) { strip.className = "ir-test-strip err"; strip.textContent = `✗ ${msg}`; }
          setTimeout(() => {
            testBtn.textContent = "▶ Test";
            row.style.borderColor = "transparent";
          }, 2000);
        }
      };
      row.appendChild(info);
      row.appendChild(testBtn);
      container.appendChild(row);
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  _refreshDerivedUI() {
    if (this._step === 3) { this._renderPills(); this._renderRepeatEditor(); }
    if (this._step === 4) this._renderTestRemote();
    if (this._step === 5) { this._renderChecklist(); this._renderRaw(); }
  }

  _currentCommands() {
    return Object.keys(this._data.store?.devices?.[this._currentKey]?.commands || {});
  }

  _recommendedGroups() {
    const type = this.qs("#ir-type")?.value || "climate";
    return RECOMMENDED[type] || RECOMMENDED.climate;
  }

  _allRecommended() {
    return this._recommendedGroups().flatMap(([, cmds]) => cmds);
  }

  _renderPills() {
    const container = this.qs("#ir-pill-container");
    if (!container) return;
    const learned = new Set(this._currentCommands());
    container.innerHTML = "";
    this._recommendedGroups().forEach(([title, cmds]) => {
      const section = document.createElement("div");
      section.className = "ir-pill-group";
      section.innerHTML = `<div class="ir-pill-group-title">${title}</div><div class="ir-pill-row"></div>`;
      const row = section.querySelector(".ir-pill-row");
      cmds.forEach(cmd => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "ir-pill" + (learned.has(cmd) ? " learned" : "");
        pill.textContent = cmd;
        pill.title = COMMAND_HINTS[cmd] || cmd;
        pill.onclick = () => { this.qs("#ir-cmd").value = cmd; this.qs("#ir-cmd").focus(); };
        row.appendChild(pill);
      });
      container.appendChild(section);
    });
    this._updateStats(learned);

    const dl = this.qs("#ir-cmd-list");
    dl.innerHTML = "";
    new Set([...this._allRecommended(), ...Object.keys(COMMAND_HINTS), ...this._currentCommands()])
      .forEach(v => { const o = document.createElement("option"); o.value = v; dl.appendChild(o); });

    // Keep the Repeat / Retry editor in sync with the current command list.
    this._renderRepeatEditor();
  }

  _updateStats(learnedSet) {
    const learned = learnedSet || new Set(this._currentCommands());
    const rec = this._allRecommended();
    const covered = rec.filter(c => learned.has(c)).length;
    const pct = rec.length ? Math.round(covered / rec.length * 100) : 0;
    const el = n => this.qs(n);
    if (el("#ir-stat-learned")) el("#ir-stat-learned").textContent = learned.size;
    if (el("#ir-stat-cov")) el("#ir-stat-cov").textContent = `${covered} / ${rec.length}`;
    if (el("#ir-stat-name")) el("#ir-stat-name").textContent =
      this.qs("#ir-name")?.value || humanize(this._currentKey) || "—";
    if (el("#ir-cov-fill")) el("#ir-cov-fill").style.width = pct + "%";
  }

  _renderChecklist() {
    const container = this.qs("#ir-checklist");
    if (!container) return;
    const learned = new Set(this._currentCommands());
    container.innerHTML = "";
    this._allRecommended().forEach(cmd => {
      const done = learned.has(cmd);
      const item = document.createElement("div");
      item.className = "ir-cl-item" + (done ? " learned" : "");
      item.innerHTML = `
        <div>
          <div class="ir-cl-name">${cmd}</div>
          <div class="ir-cl-hint">${COMMAND_HINTS[cmd] || "Custom command"}</div>
        </div>
        <div class="ir-cl-badge">${done ? "✓ Learned" : "Missing"}</div>
      `;
      if (!done) item.onclick = () => { this.qs("#ir-cmd").value = cmd; this._setStep(3); };
      container.appendChild(item);
    });
    this._updateStats(learned);
  }

  _renderRaw() {
    const cmds = this._data.store?.devices?.[this._currentKey]?.commands || {};
    const pre = this.qs("#ir-raw");
    if (pre) pre.textContent = Object.keys(cmds).length
      ? JSON.stringify(Object.fromEntries(
          Object.entries(cmds).map(([k, v]) => [k, typeof v === "string" && v.length > 32 ? v.slice(0, 32) + "…" : v])
        ), null, 2)
      : "No commands stored yet.";
  }

  // ── Repeat / Retry editor ─────────────────────────────────────────────────

  /**
   * Local working copy of the repeat policy for the currently-edited device.
   * Shape: { [command_name]: { repeat: int, delay: number, delay_unit: 'ms'|'s' } }
   * We keep edits here until the user clicks "Save repeat settings" so the
   * backend isn't pinged on every keystroke.
   */
  _ensureRepeatBuffer() {
    if (!this._repeatBuffer) this._repeatBuffer = {};
    const key = this._currentKey || "";
    if (this._repeatBufferKey !== key) {
      // Switched to a different device — reload from store.
      const saved = this._data.store?.devices?.[key]?.command_options || {};
      // Deep-copy so edits don't mutate the cached store data.
      this._repeatBuffer = JSON.parse(JSON.stringify(saved));
      this._repeatBufferKey = key;
    }
    return this._repeatBuffer;
  }

  _renderRepeatEditor() {
    const list = this.qs("#ir-rep-list");
    const select = this.qs("#ir-rep-add-select");
    const status = this.qs("#ir-rep-status");
    if (!list || !select) return;
    if (status) status.textContent = "";

    const buffer = this._ensureRepeatBuffer();
    const allCmds = this._currentCommands().sort();
    const inPolicy = new Set(Object.keys(buffer));

    // Clean out buffer entries for commands that no longer exist.
    let cleaned = false;
    Object.keys(buffer).forEach(name => {
      if (!allCmds.includes(name)) { delete buffer[name]; cleaned = true; }
    });
    if (cleaned) inPolicy.clear(), Object.keys(buffer).forEach(n => inPolicy.add(n));

    // Render rows.
    list.innerHTML = "";
    if (inPolicy.size === 0) {
      const empty = document.createElement("div");
      empty.className = "ir-rep-empty";
      empty.textContent = allCmds.length === 0
        ? "Learn some commands first, then come back to set repeat policies."
        : "No repeat policies set. All commands send once.";
      list.appendChild(empty);
    } else {
      const head = document.createElement("div");
      head.className = "ir-rep-head";
      head.innerHTML = `<div>Command</div><div>Repeat</div><div>Delay</div><div>Unit</div><div></div>`;
      list.appendChild(head);

      [...inPolicy].sort().forEach(cmdName => {
        const opts = buffer[cmdName];
        const row = document.createElement("div");
        row.className = "ir-rep-row is-active";
        row.dataset.cmd = cmdName;
        row.innerHTML = `
          <div class="ir-rep-name" title="${cmdName}">${cmdName}</div>
          <input type="number" min="1" max="20" step="1" data-field="repeat" value="${opts.repeat}">
          <input type="number" min="0" step="any" data-field="delay" value="${opts.delay}">
          <select data-field="delay_unit">
            <option value="ms"${opts.delay_unit === "ms" ? " selected" : ""}>ms</option>
            <option value="s"${opts.delay_unit === "s" ? " selected" : ""}>sec</option>
          </select>
          <button type="button" class="ir-rep-clear" title="Remove from repeat policy">✕</button>
        `;
        row.querySelectorAll("input,select").forEach(input => {
          input.addEventListener("change", () => this._captureRepeatRow(row));
          input.addEventListener("input", () => this._captureRepeatRow(row));
        });
        row.querySelector(".ir-rep-clear").onclick = () => {
          delete this._repeatBuffer[cmdName];
          this._renderRepeatEditor();
        };
        list.appendChild(row);
      });
    }

    // Populate the "Add command" dropdown with learned commands not yet in policy.
    const addable = allCmds.filter(c => !inPolicy.has(c));
    select.innerHTML = "";
    if (addable.length === 0) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = allCmds.length === 0
        ? "— No commands learned yet —"
        : "— All commands already have repeat policies —";
      select.appendChild(o);
      select.disabled = true;
      if (this.qs("#ir-rep-add-btn")) this.qs("#ir-rep-add-btn").disabled = true;
    } else {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "— Select a learned command —";
      select.appendChild(placeholder);
      addable.forEach(c => {
        const o = document.createElement("option");
        o.value = c; o.textContent = c;
        select.appendChild(o);
      });
      select.disabled = false;
      if (this.qs("#ir-rep-add-btn")) this.qs("#ir-rep-add-btn").disabled = false;
    }
  }

  _captureRepeatRow(row) {
    const cmd = row.dataset.cmd;
    if (!cmd || !this._repeatBuffer) return;
    const repeatInput = row.querySelector('[data-field="repeat"]');
    const delayInput = row.querySelector('[data-field="delay"]');
    const unitSelect = row.querySelector('[data-field="delay_unit"]');
    let repeat = parseInt(repeatInput.value, 10);
    if (!Number.isFinite(repeat) || repeat < 1) repeat = 1;
    if (repeat > 20) repeat = 20;
    let delay = parseFloat(delayInput.value);
    if (!Number.isFinite(delay) || delay < 0) delay = 0;
    const unit = unitSelect.value === "s" ? "s" : "ms";
    // Clamp delay so unit changes don't allow accidental 60-second waits.
    const maxDelay = unit === "s" ? 60 : 60000;
    if (delay > maxDelay) delay = maxDelay;
    this._repeatBuffer[cmd] = { repeat, delay, delay_unit: unit };
  }

  _addRepeatRow() {
    const select = this.qs("#ir-rep-add-select");
    if (!select) return;
    const cmd = select.value;
    if (!cmd) return;
    const buffer = this._ensureRepeatBuffer();
    // Sensible defaults: repeat twice with 300ms gap — typical fix for missed pulses.
    buffer[cmd] = { repeat: 2, delay: 300, delay_unit: "ms" };
    select.value = "";
    this._renderRepeatEditor();
  }

  async _saveRepeatPolicy() {
    const key = this._currentKey;
    if (!key) { this._showCallout("Save a profile first.", "error"); this._setStep(2); return; }
    const entryId = this.qs("#ir-entry")?.value;
    if (!entryId) { this._showCallout("Select a remote entry.", "error"); return; }

    // Capture any in-flight edits from the DOM first.
    this.qs("#ir-rep-list")?.querySelectorAll(".ir-rep-row").forEach(row =>
      this._captureRepeatRow(row)
    );

    const buffer = this._ensureRepeatBuffer();
    // Drop entries with repeat<=1 — those are no-ops, no need to persist.
    const policy = {};
    Object.entries(buffer).forEach(([cmd, opts]) => {
      if (opts.repeat > 1) policy[cmd] = opts;
    });

    const status = this.qs("#ir-rep-status");
    if (status) status.textContent = "Saving…";

    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", {
        device_key: key,
        entry_id: entryId,
        command_options: policy,
      });
      await this._load();
      // Reset buffer to the freshly-saved state.
      this._repeatBufferKey = null;
      this._renderRepeatEditor();
      if (status) {
        const n = Object.keys(policy).length;
        status.textContent = n === 0
          ? "✓ No repeat policies — all commands send once."
          : `✓ Saved repeat policy for ${n} command${n === 1 ? "" : "s"}.`;
        setTimeout(() => { if (status) status.textContent = ""; }, 4000);
      }
    }, () => {
      if (status) status.textContent = "";
    });
  }

  // ── Setup guard ───────────────────────────────────────────────────────────

  _showSetupGuard(detail) {
    if (detail) this.qs("#ir-setup-msg").textContent = detail;
    this.qs("#ir-setup-guard").classList.add("show");
  }
  _hideSetupGuard() { this.qs("#ir-setup-guard").classList.remove("show"); }

  // ── Callouts ──────────────────────────────────────────────────────────────

  _showCallout(msg, type = "info") {
    const el = this.qs("#ir-callout");
    el.textContent = msg;
    el.className = `ir-callout show ${type}`;
  }
  _hideCallout() {
    const el = this.qs("#ir-callout");
    if (el) el.className = "ir-callout";
  }
  _showLearnCallout(msg, type) {
    const el = this.qs("#ir-learn-callout");
    if (!el) return;
    if (!msg) { el.style.display = "none"; return; }
    el.textContent = msg;
    el.className = `ir-callout ${type}`;
    el.style.display = "block";
  }

  // ── Run wrapper ───────────────────────────────────────────────────────────

  async _run(fn, onError) {
    if (this._busy) return;
    this._busy = true;
    this._setBusy(true);
    try {
      await fn();
    } catch (err) {
      const msg = err?.body?.message || err?.message || String(err);
      this._showCallout(`Error: ${msg}`, "error");
      if (onError) onError(err);
    } finally {
      this._busy = false;
      this._setBusy(false);
    }
  }

  _setBusy(on) {
    this.querySelectorAll(".ir-btn").forEach(btn => {
      if (["ir-open-integrations","ir-retry"].includes(btn.id)) return;
      btn.disabled = on;
    });
  }

  // ── Delete entry ──────────────────────────────────────────────────────────

  _showDeleteEntryConfirm() {
    const sel = this.qs("#ir-delete-entry-select");
    const entryId = sel?.value;
    if (!entryId) return;
    const entry = (this._data.entries || []).find(e => e.entry_id === entryId);
    this.qs("#ir-delete-entry-name").textContent = entry ? (entry.remote_entity || entry.title) : entryId;
    this.qs("#ir-delete-entry-confirm").classList.add("show");
  }

  async _deleteEntry() {
    const sel = this.qs("#ir-delete-entry-select");
    const entryId = sel?.value;
    if (!entryId) return;
    this.qs("#ir-delete-entry-confirm").classList.remove("show");
    await this._run(async () => {
      await this._hass.callApi("DELETE", `config/config_entries/${entryId}`);
      this._currentKey = "";
      this._startNew();
      await this._load();
      this._showCallout("Integration entry deleted.", "success");
    });
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  qs(sel) { return this.querySelector(sel); }
}

if (!customElements.get("ar-smart-ir-panel")) {
  customElements.define("ar-smart-ir-panel", ARSmartIRPanel);
}
