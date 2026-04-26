// AR Smart IR Builder — panel.js
// Rewritten for clarity, usability, and correctness.

const RECOMMENDED = {
  climate: [
    ["Modes", ["off", "cool", "heat", "dry", "auto", "fan_only"]],
    ["Temperature", ["temp_16", "temp_18", "temp_20", "temp_22", "temp_24", "temp_26", "temp_28", "temp_30"]],
    ["Fan speed", ["fan_low", "fan_medium", "fan_high", "fan_auto"]],
    ["Swing", ["swing_on", "swing_off"]],
  ],
  fan: [
    ["Power", ["on", "off"]],
    ["Speed", ["fan_low", "fan_medium", "fan_high"]],
  ],
  media_player: [
    ["Power", ["power", "power_on", "power_off"]],
    ["Volume", ["volume_up", "volume_down", "mute"]],
    ["Playback", ["play", "pause", "stop", "next", "previous"]],
    ["Navigation", ["home", "back", "menu", "ok", "up", "down", "left", "right"]],
    ["Sources", ["source_hdmi1", "source_hdmi2", "netflix", "youtube"]],
  ],
  tv: [
    ["Power", ["power", "power_on", "power_off"]],
    ["Volume", ["volume_up", "volume_down", "mute"]],
    ["Channels", ["channel_up", "channel_down"]],
    ["Navigation", ["home", "back", "menu", "ok", "up", "down", "left", "right"]],
    ["Sources & apps", ["source_hdmi1", "source_hdmi2", "source_tv", "netflix", "youtube"]],
  ],
};

const TYPE_LABELS = { climate: "Climate", fan: "Fan", media_player: "Media player", tv: "TV" };

const COMMAND_HINTS = {
  off: "Power off", on: "Power on",
  cool: "Cooling mode", heat: "Heating mode", dry: "Dry / dehumidify", auto: "Auto mode", fan_only: "Fan only",
  fan_low: "Fan low speed", fan_medium: "Fan medium speed", fan_high: "Fan high speed", fan_auto: "Fan auto speed",
  swing_on: "Oscillation on", swing_off: "Oscillation off",
  power: "Power toggle", power_on: "Power on", power_off: "Power off",
  volume_up: "Volume +", volume_down: "Volume −", mute: "Mute",
  play: "Play", pause: "Pause", stop: "Stop", next: "Next track", previous: "Previous track",
  channel_up: "Channel +", channel_down: "Channel −",
  home: "Home screen", back: "Back", menu: "Menu", ok: "Confirm / OK",
  up: "Up", down: "Down", left: "Left", right: "Right",
  source_hdmi1: "HDMI 1", source_hdmi2: "HDMI 2", source_tv: "TV input",
  netflix: "Netflix", youtube: "YouTube",
};

function humanize(key) {
  return String(key || "").replace(/[_-]+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}

function slugify(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

class ARSmartIRPanel extends HTMLElement {
  constructor() {
    super();
    // State
    this._hass = null;
    this._data = { entries: [], store: { devices: {} } };
    this._step = 1;
    this._busy = false;
    this._currentKey = "";   // the profile being edited
    this._setupShown = false;
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

  // ─── Render ──────────────────────────────────────────────────────────────

  _render() {
    this.innerHTML = `
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host { display: block; }

  .ir-wrap {
    max-width: 980px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    color: var(--primary-text-color);
    font-family: var(--paper-font-body1_-_font-family, sans-serif);
  }

  /* ── Header ── */
  .ir-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
    flex-wrap: wrap;
  }
  .ir-header-icon {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #1b7aff22, #1a996b14);
    border: 1px solid rgba(127,127,127,.18);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .ir-header h1 {
    font-size: 18px; font-weight: 700; flex: 1;
    color: var(--primary-text-color);
  }
  .ir-remote-select {
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid rgba(127,127,127,.3);
    background: var(--card-background-color, rgba(255,255,255,.05));
    color: var(--primary-text-color);
    font-size: 13px;
    min-width: 180px;
  }

  /* ── Setup guard ── */
  .ir-setup-guard {
    display: none;
    padding: 18px 20px;
    border-radius: 14px;
    border: 1px solid rgba(220,100,0,.35);
    background: linear-gradient(135deg, rgba(220,100,0,.1), rgba(255,190,50,.06));
    margin-bottom: 18px;
  }
  .ir-setup-guard.show { display: block; }
  .ir-setup-guard h2 { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
  .ir-setup-guard p { font-size: 13px; color: var(--secondary-text-color); line-height: 1.5; margin-bottom: 12px; }

  /* ── Step nav ── */
  .ir-steps {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(127,127,127,.18);
    margin-bottom: 18px;
    overflow-x: auto;
  }
  .ir-step-tab {
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--secondary-text-color);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    white-space: nowrap;
    transition: color .15s, border-color .15s;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .ir-step-tab:hover { color: var(--primary-text-color); }
  .ir-step-tab.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
  }
  .ir-step-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px;
    border-radius: 50%;
    font-size: 11px; font-weight: 700;
    background: rgba(127,127,127,.14);
    color: var(--secondary-text-color);
  }
  .ir-step-tab.active .ir-step-num {
    background: var(--primary-color);
    color: #fff;
  }
  .ir-step-tab.done .ir-step-num {
    background: #1a9966;
    color: #fff;
  }
  .ir-step-tab.done .ir-step-num::after { content: "✓"; }
  .ir-step-tab.done .ir-step-label { display: none; }
  .ir-step-tab.active .ir-step-label, .ir-step-tab:not(.done) .ir-step-label { display: inline; }

  /* ── Cards ── */
  .ir-card {
    background: var(--card-background-color, rgba(255,255,255,.03));
    border: 1px solid rgba(127,127,127,.18);
    border-radius: 18px;
    padding: 22px;
    margin-bottom: 14px;
  }
  .ir-card-title {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .ir-card-desc {
    font-size: 13px;
    color: var(--secondary-text-color);
    line-height: 1.55;
    margin-bottom: 18px;
  }

  /* ── Step panels ── */
  .ir-panel { display: none; }
  .ir-panel.active { display: block; }

  /* ── Grid ── */
  .ir-grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  @media (max-width: 680px) { .ir-grid2 { grid-template-columns: 1fr; } }

  /* ── Fields ── */
  .ir-field { margin-bottom: 14px; }
  .ir-field label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--secondary-text-color);
    margin-bottom: 5px;
  }
  .ir-field input, .ir-field select {
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid rgba(127,127,127,.32);
    background: var(--secondary-background-color, rgba(0,0,0,.04));
    color: var(--primary-text-color);
    font-size: 14px;
    transition: border-color .15s;
  }
  .ir-field input:focus, .ir-field select:focus {
    outline: none;
    border-color: var(--primary-color);
  }
  .ir-hint { font-size: 12px; color: var(--secondary-text-color); margin-top: 4px; }

  /* ── Buttons ── */
  .ir-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .ir-btn {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    transition: opacity .15s, transform .1s;
  }
  .ir-btn:active { transform: scale(.97); }
  .ir-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
  .ir-btn-primary { background: var(--primary-color); color: #fff; }
  .ir-btn-secondary { background: rgba(127,127,127,.14); color: var(--primary-text-color); }
  .ir-btn-ghost { background: transparent; border: 1px solid rgba(127,127,127,.25); color: var(--primary-text-color); }
  .ir-btn-danger { background: transparent; border: 1px solid rgba(220,50,50,.4); color: #e03030; }
  .ir-btn-sm { min-height: 30px; padding: 0 12px; font-size: 12px; }

  /* ── Callout ── */
  .ir-callout {
    padding: 11px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 14px;
    display: none;
  }
  .ir-callout.show { display: block; }
  .ir-callout.info { background: rgba(27,122,255,.09); border: 1px solid rgba(27,122,255,.22); color: var(--primary-text-color); }
  .ir-callout.success { background: rgba(26,153,107,.1); border: 1px solid rgba(26,153,107,.25); color: var(--primary-text-color); }
  .ir-callout.error { background: rgba(220,50,50,.09); border: 1px solid rgba(220,50,50,.25); color: #c83030; }
  .ir-callout.learning { background: rgba(250,150,0,.09); border: 1px solid rgba(250,150,0,.3); color: var(--primary-text-color); }

  /* ── Profile list (step 1) ── */
  .ir-profile-list { display: grid; gap: 8px; }
  .ir-profile-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(127,127,127,.18);
    background: var(--card-background-color, rgba(255,255,255,.03));
    cursor: pointer;
    transition: border-color .15s, background .15s;
  }
  .ir-profile-item:hover { border-color: rgba(127,127,127,.35); }
  .ir-profile-item.selected {
    border-color: var(--primary-color);
    background: rgba(27,122,255,.06);
  }
  .ir-profile-icon {
    width: 34px; height: 34px; border-radius: 9px;
    background: rgba(127,127,127,.12);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
  }
  .ir-profile-name { font-weight: 700; font-size: 14px; }
  .ir-profile-meta { font-size: 12px; color: var(--secondary-text-color); }
  .ir-profile-cmd-count {
    margin-left: auto; font-size: 12px; font-weight: 700;
    color: var(--secondary-text-color);
  }
  .ir-new-profile-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px dashed rgba(127,127,127,.3);
    background: transparent;
    cursor: pointer;
    color: var(--primary-text-color);
    font-size: 14px;
    font-weight: 600;
    width: 100%;
    text-align: left;
    transition: border-color .15s;
  }
  .ir-new-profile-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }

  /* ── Coverage bar ── */
  .ir-cov-bar {
    height: 5px;
    border-radius: 3px;
    background: rgba(127,127,127,.15);
    margin: 10px 0 6px;
    overflow: hidden;
  }
  .ir-cov-fill {
    height: 100%;
    border-radius: 3px;
    background: #1a9966;
    transition: width .4s ease;
  }

  /* ── Stat strip ── */
  .ir-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .ir-stat {
    flex: 1; min-width: 90px;
    padding: 10px 13px;
    border-radius: 11px;
    background: var(--card-background-color, rgba(255,255,255,.03));
    border: 1px solid rgba(127,127,127,.14);
  }
  .ir-stat-k { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color); margin-bottom: 3px; }
  .ir-stat-v { font-size: 16px; font-weight: 700; }

  /* ── Pill commands ── */
  .ir-pill-group { margin-top: 18px; }
  .ir-pill-group-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--secondary-text-color); margin-bottom: 8px; }
  .ir-pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .ir-pill {
    padding: 6px 13px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid rgba(127,127,127,.25);
    background: rgba(127,127,127,.08);
    cursor: pointer;
    color: var(--primary-text-color);
    transition: background .12s, border-color .12s, transform .08s;
  }
  .ir-pill:hover { background: rgba(127,127,127,.16); border-color: rgba(127,127,127,.4); }
  .ir-pill:active { transform: scale(.94); }
  .ir-pill.learned {
    background: rgba(26,153,107,.13);
    border-color: rgba(26,153,107,.35);
    color: #0f6e56;
  }

  /* ── Learn command area ── */
  .ir-cmd-row { display: flex; gap: 8px; align-items: flex-end; }
  .ir-cmd-row .ir-field { flex: 1; margin-bottom: 0; }

  /* ── Coverage checklist ── */
  .ir-checklist { display: grid; gap: 6px; }
  .ir-cl-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 13px;
    border-radius: 11px;
    background: rgba(127,127,127,.07);
    border: 1px solid transparent;
    cursor: pointer;
    transition: background .12s;
  }
  .ir-cl-item:hover { background: rgba(127,127,127,.12); }
  .ir-cl-item.learned { background: rgba(26,153,107,.08); border-color: rgba(26,153,107,.22); }
  .ir-cl-name { font-weight: 700; font-size: 13px; }
  .ir-cl-hint { font-size: 12px; color: var(--secondary-text-color); }
  .ir-cl-badge {
    font-size: 11px; font-weight: 700; padding: 3px 9px;
    border-radius: 999px; flex-shrink: 0;
    background: rgba(127,127,127,.12);
    color: var(--secondary-text-color);
  }
  .ir-cl-item.learned .ir-cl-badge {
    background: rgba(26,153,107,.18);
    color: #0f6e56;
  }

  /* ── Raw export ── */
  .ir-mono {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 12px;
    padding: 14px;
    border-radius: 12px;
    background: rgba(0,0,0,.2);
    color: rgba(255,255,255,.8);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 220px;
    overflow-y: auto;
    margin-top: 10px;
  }
  details summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--secondary-text-color); margin-top: 14px; }
  details summary:hover { color: var(--primary-text-color); }

  /* ── Advanced fields toggle ── */
  .ir-advanced { margin-top: 4px; }
  .ir-advanced summary { font-size: 12px; color: var(--secondary-text-color); margin-top: 0; margin-bottom: 12px; }

  /* ── Spinner ── */
  .ir-spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ir-spin .6s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  @keyframes ir-spin { to { transform: rotate(360deg); } }

  /* ── Learning pulse ── */
  @keyframes ir-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .5; }
  }
  .ir-learning-pulse { animation: ir-pulse 1.2s ease-in-out infinite; }

  /* ── Delete confirm ── */
  .ir-delete-confirm { display: none; margin-top: 10px; padding: 12px 14px; border-radius: 11px; background: rgba(220,50,50,.07); border: 1px solid rgba(220,50,50,.22); }
  .ir-delete-confirm.show { display: block; }
  .ir-delete-confirm p { font-size: 13px; margin-bottom: 10px; }

  @media (max-width: 540px) {
    .ir-wrap { padding: 14px 14px 30px; }
    .ir-step-tab { padding: 10px 12px; }
  }
</style>

<div class="ir-wrap">
  <!-- Header -->
  <div class="ir-header">
    <div class="ir-header-icon">📡</div>
    <h1>AR Smart IR Builder</h1>
    <select id="ir-entry" class="ir-remote-select" title="Select remote"></select>
  </div>

  <!-- Setup guard (inline, no alert) -->
  <div id="ir-setup-guard" class="ir-setup-guard">
    <h2>Integration setup required</h2>
    <p id="ir-setup-msg">Please go to Settings → Devices &amp; Services and add the AR Smart IR Builder integration with at least one Broadlink remote.</p>
    <div class="ir-actions">
      <button class="ir-btn ir-btn-primary" id="ir-open-integrations">Open integrations</button>
      <button class="ir-btn ir-btn-secondary" id="ir-retry">Retry</button>
    </div>
  </div>

  <!-- Main callout (errors / success) -->
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
      <span class="ir-step-num">4</span><span class="ir-step-label">Export</span>
    </button>
  </div>

  <!-- ── Step 1: Pick profile ── -->
  <div class="ir-panel" data-panel="1">
    <div class="ir-card">
      <div class="ir-card-title">Choose a profile</div>
      <div class="ir-card-desc">Load an existing profile to continue working on it, or start a fresh one.</div>
      <div id="ir-profile-list" class="ir-profile-list"></div>
      <div class="ir-actions" style="margin-top:14px">
        <button class="ir-btn ir-btn-primary" id="ir-new-profile">+ New profile</button>
      </div>
    </div>

    <div class="ir-card" style="border-color:rgba(220,50,50,.2)">
      <div class="ir-card-title" style="font-size:13px">Remove integration entry</div>
      <div class="ir-card-desc" style="margin-bottom:12px">Permanently delete this Broadlink remote entry and all its profiles from Home Assistant. This cannot be undone.</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <select id="ir-delete-entry-select" class="ir-remote-select" style="flex:1;min-width:180px"></select>
        <button class="ir-btn ir-btn-danger" id="ir-delete-entry-btn">Delete entry</button>
      </div>
      <div id="ir-delete-entry-confirm" class="ir-delete-confirm">
        <p>Delete <strong id="ir-delete-entry-name"></strong>? All profiles and learned commands for this remote will be permanently removed.</p>
        <div class="ir-actions" style="margin-top:0">
          <button class="ir-btn ir-btn-danger ir-btn-sm" id="ir-delete-entry-confirm-btn">Yes, delete permanently</button>
          <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-delete-entry-cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Step 2: Profile details ── -->
  <div class="ir-panel" data-panel="2">
    <div class="ir-card">
      <div class="ir-card-title" id="ir-details-title">New profile</div>
      <div class="ir-card-desc">Fill in the basics. Advanced fields are optional — they enrich the SmartIR export.</div>
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

  <!-- ── Step 3: Learn commands ── -->
  <div class="ir-panel" data-panel="3">
    <div class="ir-card">
      <div class="ir-card-title">Learn commands</div>
      <div class="ir-card-desc">Select or type a command name, then click Learn and press the button on your remote.</div>

      <div class="ir-stats">
        <div class="ir-stat"><div class="ir-stat-k">Learned</div><div class="ir-stat-v" id="ir-stat-learned">0</div></div>
        <div class="ir-stat"><div class="ir-stat-k">Coverage</div><div class="ir-stat-v" id="ir-stat-cov">0 / 0</div></div>
        <div class="ir-stat"><div class="ir-stat-k">Profile</div><div class="ir-stat-v" id="ir-stat-name">—</div></div>
      </div>

      <div class="ir-cov-bar"><div class="ir-cov-fill" id="ir-cov-fill" style="width:0%"></div></div>
      <div id="ir-learn-callout" class="ir-callout info" style="display:none"></div>

      <div class="ir-cmd-row">
        <div class="ir-field">
          <label>Command name</label>
          <input id="ir-cmd" list="ir-cmd-list" placeholder="e.g. power_on" autocomplete="off">
          <datalist id="ir-cmd-list"></datalist>
        </div>
        <button class="ir-btn ir-btn-primary" id="ir-learn-btn" style="margin-bottom:0; flex-shrink:0">Learn</button>
      </div>

      <div id="ir-pill-container"></div>

      <div class="ir-actions" style="margin-top:20px">
        <button class="ir-btn ir-btn-secondary" id="ir-back-to-2">← Details</button>
        <button class="ir-btn ir-btn-ghost" id="ir-to-review">Review →</button>
      </div>
    </div>
  </div>

  <!-- ── Step 4: Review & export ── -->
  <div class="ir-panel" data-panel="4">
    <div class="ir-card">
      <div class="ir-card-title">Review &amp; export</div>
      <div class="ir-card-desc">Check your coverage below, then export when you're happy.</div>

      <div class="ir-actions">
        <button class="ir-btn ir-btn-primary" id="ir-export-btn">Export SmartIR JSON</button>
        <button class="ir-btn ir-btn-secondary" id="ir-resave-btn">Re-save profile</button>
        <button class="ir-btn ir-btn-ghost" id="ir-back-to-3">← Learn more</button>
        <button class="ir-btn ir-btn-danger ir-btn-sm" id="ir-delete-btn">Delete profile</button>
      </div>

      <div id="ir-delete-confirm" class="ir-delete-confirm">
        <p>Delete <strong id="ir-delete-name"></strong>? This removes all learned commands and cannot be undone.</p>
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
        <summary>Stored commands JSON</summary>
        <pre id="ir-raw" class="ir-mono">—</pre>
      </details>
    </div>
  </div>
</div>
    `;
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  _attachEvents() {
    // Step tabs
    this.querySelectorAll("[data-step]").forEach(btn =>
      btn.addEventListener("click", () => this._setStep(Number(btn.dataset.step)))
    );

    // Header remote selector
    this.qs("#ir-entry").addEventListener("change", () => this._refreshDerivedUI());

    // Setup guard
    this.qs("#ir-open-integrations").onclick = () =>
      window.location.assign("/config/integrations/dashboard");
    this.qs("#ir-retry").onclick = () => this._load();

    // Step 1
    this.qs("#ir-new-profile").onclick = () => { this._startNew(); this._setStep(2); };

    // Step 2
    this.qs("#ir-name").addEventListener("input", () => {
      const key = this.qs("#ir-key");
      // Auto-fill key only when key hasn't been manually edited
      if (!key.dataset.manualEdit) {
        key.value = slugify(this.qs("#ir-name").value);
      }
    });
    this.qs("#ir-key").addEventListener("input", () => {
      this.qs("#ir-key").dataset.manualEdit = "1";
    });
    this.qs("#ir-save-details").onclick = () => this._saveDetails();
    this.qs("#ir-back-to-1").onclick = () => this._setStep(1);

    // Step 3
    this.qs("#ir-learn-btn").onclick = () => this._learnCommand();
    this.qs("#ir-back-to-2").onclick = () => this._setStep(2);
    this.qs("#ir-to-review").onclick = () => this._setStep(4);
    this.qs("#ir-cmd").addEventListener("keydown", e => {
      if (e.key === "Enter") this._learnCommand();
    });

    // Step 4
    this.qs("#ir-export-btn").onclick = () => this._exportProfile();
    this.qs("#ir-resave-btn").onclick = () => this._resaveProfile();
    this.qs("#ir-back-to-3").onclick = () => this._setStep(3);
    this.qs("#ir-delete-btn").onclick = () => this._showDeleteConfirm();
    this.qs("#ir-delete-confirm-btn").onclick = () => this._deleteProfile();
    this.qs("#ir-delete-cancel-btn").onclick = () => {
      this.qs("#ir-delete-confirm").classList.remove("show");
    };

    // Delete integration entry
    this.qs("#ir-delete-entry-btn").onclick = () => this._showDeleteEntryConfirm();
    this.qs("#ir-delete-entry-confirm-btn").onclick = () => this._deleteEntry();
    this.qs("#ir-delete-entry-cancel-btn").onclick = () => {
      this.qs("#ir-delete-entry-confirm").classList.remove("show");
    };
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  _setStep(step) {
    this._step = Math.min(4, Math.max(1, step));
    this.querySelectorAll("[data-step]").forEach(btn => {
      const n = Number(btn.dataset.step);
      btn.classList.toggle("active", n === this._step);
    });
    this.querySelectorAll(".ir-panel").forEach(panel => {
      panel.classList.toggle("active", Number(panel.dataset.panel) === this._step);
    });
    this._hideCallout();
    if (this._step === 3) this._renderPills();
    if (this._step === 4) { this._renderChecklist(); this._renderRaw(); }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

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

    // Also populate the delete-entry selector on step 1
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
    keys.forEach(key => {
      const d = devices[key];
      const icon = { climate: "❄️", fan: "🌀", media_player: "📺", tv: "📺" }[d.device_type] || "📡";
      const cmdCount = Object.keys(d.commands || {}).length;
      const item = document.createElement("div");
      item.className = "ir-profile-item" + (key === this._currentKey ? " selected" : "");
      item.innerHTML = `
        <div class="ir-profile-icon">${icon}</div>
        <div>
          <div class="ir-profile-name">${d.name || humanize(key)}</div>
          <div class="ir-profile-meta">${TYPE_LABELS[d.device_type] || d.device_type} · ${key}</div>
        </div>
        <div class="ir-profile-cmd-count">${cmdCount} cmd${cmdCount !== 1 ? "s" : ""}</div>
      `;
      item.addEventListener("click", () => {
        this._loadProfile(key);
        this._setStep(2);
      });
      container.appendChild(item);
    });

    if (keys.length === 0) {
      container.innerHTML = `<p style="font-size:13px;color:var(--secondary-text-color)">No profiles yet. Click "New profile" to get started.</p>`;
    }
  }

  // ─── Profile form ─────────────────────────────────────────────────────────

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
    this.qs("#ir-key").dataset.manualEdit = "1"; // treat as manually set
    this.qs("#ir-type").value = d.device_type || "climate";
    this.qs("#ir-manufacturer").value = d.manufacturer || "";
    this.qs("#ir-model").value = d.model || "";
    this.qs("#ir-supported-models").value = (d.supported_models || []).join(", ");
    this.qs("#ir-details-title").textContent = d.name || humanize(key);

    // Sync entry selector if stored
    if (d.entry_id) {
      const sel = this.qs("#ir-entry");
      if ([...sel.options].some(o => o.value === d.entry_id)) sel.value = d.entry_id;
    }
  }

  _profilePayload() {
    const key = this.qs("#ir-key").value.trim();
    const name = this.qs("#ir-name").value.trim() || humanize(key);
    const model = this.qs("#ir-model").value.trim() || name;
    const rawModels = this.qs("#ir-supported-models").value
      .split(",").map(s => s.trim()).filter(Boolean);
    const existing = this._data.store?.devices?.[key] || {};
    return {
      device_key: key,
      entry_id: this.qs("#ir-entry").value,
      name,
      manufacturer: this.qs("#ir-manufacturer").value.trim(),
      model,
      device_type: this.qs("#ir-type").value || "climate",
      supported_models: rawModels.length ? rawModels : [model],
      commands: existing.commands || {},
    };
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  async _saveDetails() {
    const key = this.qs("#ir-key").value.trim();
    const name = this.qs("#ir-name").value.trim();
    if (!key) { this._showCallout("Device key is required.", "error"); return; }
    if (!name) { this.qs("#ir-name").value = humanize(key); }

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
      // Auto-save profile metadata before learning to ensure it exists
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());

      this._showLearnCallout(`⏳ Point remote at Broadlink and press the button for "${cmdName}"…`, "learning");
      this._setLearning(true);

      const result = await this._hass.callApi(
        "POST",
        "services/ar_smart_ir_builder/learn_and_capture?return_response",
        { entry_id: entryId, device_key: key, command_name: cmdName }
      );

      this._setLearning(false);
      await this._load();
      this.qs("#ir-cmd").value = "";
      this._renderPills();
      this._showLearnCallout(`✓ "${cmdName}" learned.`, "success");
    }, () => {
      this._setLearning(false);
      this._showLearnCallout("", "");
    });
  }

  _setLearning(on) {
    this.qs("#ir-learn-btn").disabled = on;
    if (on) {
      this.qs("#ir-learn-btn").innerHTML = `<span class="ir-spinner"></span>Learning…`;
    } else {
      this.qs("#ir-learn-btn").textContent = "Learn";
    }
  }

  async _exportProfile() {
    const key = this._currentKey;
    if (!key) { this._showCallout("No profile selected.", "error"); return; }
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());
      await this._hass.callService("ar_smart_ir_builder", "export_device", { device_key: key });
      this._showCallout(`Exported to /local/ar_smart_ir_exports/${key}.json`, "success");
      window.open(`/local/ar_smart_ir_exports/${key}.json`, "_blank");
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
        device_key: key,
        entry_id: this.qs("#ir-entry").value || undefined,
      });
      this._currentKey = "";
      await this._load();
      this._renderProfileList();
      this._startNew();
      this._showCallout(`Profile "${key}" deleted.`, "success");
      this._setStep(1);
    });
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────

  _refreshDerivedUI() {
    if (this._step === 3) this._renderPills();
    if (this._step === 4) { this._renderChecklist(); this._renderRaw(); }
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
        pill.onclick = () => {
          this.qs("#ir-cmd").value = cmd;
          this.qs("#ir-cmd").focus();
        };
        row.appendChild(pill);
      });
      container.appendChild(section);
    });
    this._updateStats(learned);

    // Populate datalist
    const dl = this.qs("#ir-cmd-list");
    dl.innerHTML = "";
    const all = new Set([
      ...this._allRecommended(),
      ...Object.keys(COMMAND_HINTS),
      ...this._currentCommands(),
    ]);
    all.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      dl.appendChild(o);
    });
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
      if (!done) {
        item.onclick = () => {
          this.qs("#ir-cmd").value = cmd;
          this._setStep(3);
        };
      }
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

  // ─── Setup guard ──────────────────────────────────────────────────────────

  _showSetupGuard(detail) {
    if (detail) this.qs("#ir-setup-msg").textContent = detail;
    this.qs("#ir-setup-guard").classList.add("show");
  }

  _hideSetupGuard() {
    this.qs("#ir-setup-guard").classList.remove("show");
  }

  // ─── Callouts ─────────────────────────────────────────────────────────────

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

  // ─── Run wrapper ──────────────────────────────────────────────────────────

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
      if (btn.id === "ir-open-integrations" || btn.id === "ir-retry") return;
      btn.disabled = on;
    });
  }

  // ─── Delete integration entry ─────────────────────────────────────────────

  _showDeleteEntryConfirm() {
    const sel = this.qs("#ir-delete-entry-select");
    const entryId = sel?.value;
    if (!entryId) return;
    const entry = (this._data.entries || []).find(e => e.entry_id === entryId);
    const label = entry ? (entry.remote_entity || entry.title) : entryId;
    this.qs("#ir-delete-entry-name").textContent = label;
    this.qs("#ir-delete-entry-confirm").classList.add("show");
  }

  async _deleteEntry() {
    const sel = this.qs("#ir-delete-entry-select");
    const entryId = sel?.value;
    if (!entryId) return;
    this.qs("#ir-delete-entry-confirm").classList.remove("show");

    await this._run(async () => {
      // Call HA's config entries REST API directly — works regardless of entry state
      await this._hass.callApi("DELETE", `config/config_entries/${entryId}`);
      this._currentKey = "";
      this._startNew();
      // Reload data — entry should be gone now
      await this._load();
      this._showCallout("Integration entry deleted.", "success");
    });
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  qs(sel) { return this.querySelector(sel); }
}

if (!customElements.get("ar-smart-ir-panel")) {
  customElements.define("ar-smart-ir-panel", ARSmartIRPanel);
}
