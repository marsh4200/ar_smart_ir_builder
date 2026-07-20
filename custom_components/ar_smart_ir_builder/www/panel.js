// AR Smart IR Builder — panel.js v2.3.0
// Adds: projector / AV receiver / soundbar / decoder device types with brand
// presets, a pre-learn remote preview, and a user-facing motion override
// (see _applyMotionPref — the animation pack used to be silently killed by
// the OS reduced-motion setting with no way to say otherwise).

const MOTION_PREF_KEY = "ar_smart_ir_builder.motion";
const PANEL_BUILD = "2.10.0";
const AR_KEYFRAMES = `
@keyframes ir-spin { to { transform: rotate(360deg); } }
@keyframes ir-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes ir-panel-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes ir-callout-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
@keyframes ir-shake {
    10%, 90% { transform: translateX(-2px); }
    20%, 80% { transform: translateX(3px); }
    30%, 50%, 70% { transform: translateX(-4px); }
    40%, 60% { transform: translateX(4px); }
  }
@keyframes ir-wave { 0% { transform: scale(1); opacity: .5; } 100% { transform: scale(1.85); opacity: 0; } }
@keyframes ir-pop {
    0% { transform: scale(1); } 35% { transform: scale(1.16); }
    60% { transform: scale(.96); } 100% { transform: scale(1); }
  }
@keyframes ir-shimmer { from { transform: translateX(-120%); } to { transform: translateX(320%); } }
@keyframes ir-flash {
    0% { box-shadow: 0 0 0 0 rgba(26,153,107,.5); }
    100% { box-shadow: 0 0 0 14px rgba(26,153,107,0); }
  }
@keyframes ir-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes ir-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ir-ring-fade { 0%, 100% { opacity: 0; } 50% { opacity: .5; } }
@keyframes ir-selftest {
    0%   { left: 0;   width: 24%; background: #e03030; }
    25%  { left: 25%; background: #e0a030; }
    50%  { left: 50%; background: #1a9966; }
    75%  { left: 60%; background: #1b7aff; }
    100% { left: 76%; width: 24%; background: #9b30e0; }
  }

  /* Virtual-remote press feedback (punchy) ------------------------------- */
  @keyframes ir-btn-press {
    0%   { transform: scale(1);   box-shadow: 0 0 0 0 rgba(27,122,255,.55); }
    30%  { transform: scale(.9);  box-shadow: 0 0 0 5px rgba(27,122,255,.35); }
    100% { transform: scale(1);   box-shadow: 0 0 0 14px rgba(27,122,255,0); }
  }
  @keyframes ir-btn-glow {
    0%   { background: rgba(27,122,255,.45); border-color: rgba(27,122,255,.9); }
    100% { background: rgba(127,127,127,.14); border-color: rgba(127,127,127,.28); }
  }
  /* Emitter dot pulse when a command fires */
  @keyframes ir-emit-dot {
    0%   { transform: scale(1);   background: #ff5252; box-shadow: 0 0 0 0 rgba(255,82,82,.7); }
    25%  { transform: scale(1.6); background: #ff5252; box-shadow: 0 0 12px 4px rgba(255,82,82,.9); }
    100% { transform: scale(1);   background: #b03030; box-shadow: 0 0 0 0 rgba(255,82,82,0); }
  }
  /* IR waves radiating out from the emitter */
  @keyframes ir-emit-wave {
    0%   { transform: translate(-50%, -50%) scale(.3); opacity: .9; border-width: 3px; }
    100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; border-width: 1px; }
  }

  /* "Listening for IR" radar --------------------------------------------- */
  @keyframes ir-radar-ping {
    0%   { transform: translate(-50%, -50%) scale(.25); opacity: .85; }
    100% { transform: translate(-50%, -50%) scale(1);   opacity: 0; }
  }
  @keyframes ir-radar-sweep {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes ir-radar-core {
    0%, 100% { opacity: 1;   box-shadow: 0 0 0 0 rgba(250,150,0,.55); }
    50%      { opacity: .55; box-shadow: 0 0 0 6px rgba(250,150,0,0); }
  }
`;


const RECOMMENDED = {
  climate: [
    ["Modes", ["off", "cool", "heat", "dry", "auto", "fan_only"]],
    ["Temperature", ["temp_16","temp_18","temp_20","temp_22","temp_24","temp_26","temp_28","temp_30"]],
    ["Fan speed", ["fan_low","fan_medium","fan_high","fan_auto"]],
    ["Swing", ["swing_on","swing_off"]],
  ],
  // For remotes with a single cycling "Mode" button and Temp +/- buttons
  // instead of a discrete button per mode/temperature value.
  climate_relative: [
    ["Power", ["power_toggle","off"]],
    ["Mode", ["mode_toggle"]],
    ["Temperature", ["temp_up","temp_down"]],
    ["Fan speed", ["fan_toggle","fan_low","fan_medium","fan_high","fan_auto"]],
    ["Swing", ["swing_toggle","swing_on","swing_off"]],
  ],
  custom: [
    ["Movement", ["open","close","stop"]],
    ["Position", ["up","down","preset_1","preset_2"]],
    ["Power", ["power","power_on","power_off"]],
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
  projector: [
    ["Power", ["power","power_on","power_off"]],
    ["Sources", ["source_hdmi1","source_hdmi2","source_vga","source_video","source"]],
    ["Picture", ["blank","freeze","aspect","image_mode","eco_mode"]],
    ["Geometry", ["keystone_up","keystone_down","zoom_in","zoom_out","focus_near","focus_far"]],
    ["Navigation", ["menu","ok","up","down","left","right","back","info"]],
    ["Volume", ["volume_up","volume_down","mute"]],
  ],
  receiver: [
    ["Power", ["power","power_on","power_off"]],
    ["Volume", ["volume_up","volume_down","mute"]],
    ["Sources", ["source_hdmi1","source_hdmi2","source_hdmi3","source_hdmi4","source_tv","source_bd","source_cd","source_tuner","source_aux","source_bluetooth"]],
    ["Sound", ["sound_mode","surround","stereo","direct","night_mode"]],
    ["Tone", ["bass_up","bass_down","treble_up","treble_down"]],
    ["Navigation", ["menu","ok","up","down","left","right","back","info"]],
  ],
  soundbar: [
    ["Power", ["power","power_on","power_off"]],
    ["Volume", ["volume_up","volume_down","mute"]],
    ["Sources", ["source_tv","source_hdmi","source_optical","source_bluetooth","source_aux"]],
    ["Sound", ["sound_mode","surround_on","surround_off","night_mode"]],
    ["Tone", ["bass_up","bass_down","treble_up","treble_down"]],
    ["Playback", ["play","pause","next","previous"]],
  ],
  decoder: [
    ["Power", ["power","power_on","power_off"]],
    ["Channels", ["channel_up","channel_down","last_channel"]],
    ["Keypad", ["num_1","num_2","num_3","num_4","num_5","num_6","num_7","num_8","num_9","num_0"]],
    ["Navigation", ["home","guide","menu","ok","up","down","left","right","back","exit","info"]],
    ["PVR", ["record","play","pause","stop","rewind","forward"]],
    ["Colour keys", ["red","green","yellow","blue"]],
    ["Volume", ["volume_up","volume_down","mute"]],
  ],
  tv: [
    ["Power", ["power","power_on","power_off"]],
    ["Volume", ["volume_up","volume_down","mute"]],
    ["Channels", ["channel_up","channel_down"]],
    ["Navigation", ["home","back","menu","ok","up","down","left","right"]],
    // The tv REMOTE_LAYOUT has always drawn these three; without them here the
    // checklist never asked for them, so they were permanently stuck greyed out.
    ["Playback", ["play","pause","stop"]],
    ["Sources & apps", ["source","source_hdmi1","source_hdmi2","source_tv","netflix","youtube"]],
  ],
};

const TYPE_LABELS = {
  climate: "Climate", fan: "Fan", media_player: "Media player", tv: "TV",
  projector: "Projector", receiver: "AV receiver", soundbar: "Soundbar",
  decoder: "Decoder / set-top box", custom: "Custom",
};
const TYPE_ICONS = {
  climate: "❄️", fan: "🌀", media_player: "📺", tv: "📺",
  projector: "📽️", receiver: "🔊", soundbar: "🎚️", decoder: "📡", custom: "🛸",
};

const COMMAND_HINTS = {
  off:"Power off", on:"Power on",
  open:"Open / extend", close:"Close / retract",
  preset_1:"Preset position 1", preset_2:"Preset position 2",
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
  power_toggle:"Power toggle (single button)",
  mode_toggle:"Mode button — cycles cool/heat/dry/auto/fan on each press",
  temp_up:"Temperature up (single step)", temp_down:"Temperature down (single step)",
  fan_toggle:"Fan speed button — cycles speeds on each press",
  swing_toggle:"Swing button — toggles on each press",
  temp_16:"Set 16°C", temp_18:"Set 18°C", temp_20:"Set 20°C", temp_22:"Set 22°C",
  temp_24:"Set 24°C", temp_26:"Set 26°C", temp_28:"Set 28°C", temp_30:"Set 30°C",

  // Projector
  source:"Source / input button — cycles inputs on each press",
  source_vga:"VGA / PC input", source_video:"Composite / AV input",
  blank:"Blank / AV mute — kills the image without powering down",
  freeze:"Freeze frame", aspect:"Aspect ratio", image_mode:"Picture / display mode",
  eco_mode:"Eco / lamp power mode",
  keystone_up:"Keystone +", keystone_down:"Keystone −",
  zoom_in:"Zoom in", zoom_out:"Zoom out",
  focus_near:"Focus near", focus_far:"Focus far",
  info:"Info / status",

  // AV receiver / soundbar
  source_hdmi3:"HDMI 3", source_hdmi4:"HDMI 4", source_hdmi:"HDMI input",
  source_bd:"Blu-ray / DVD input", source_cd:"CD input", source_tuner:"Tuner / radio",
  source_aux:"AUX input", source_bluetooth:"Bluetooth input", source_optical:"Optical input",
  sound_mode:"Sound / DSP mode — cycles on each press",
  surround:"Surround mode", surround_on:"Surround on", surround_off:"Surround off",
  stereo:"Stereo / 2ch mode", direct:"Direct / pure mode", night_mode:"Night mode",
  bass_up:"Bass +", bass_down:"Bass −", treble_up:"Treble +", treble_down:"Treble −",

  // Decoder / set-top box
  last_channel:"Last / previous channel",
  num_0:"Keypad 0", num_1:"Keypad 1", num_2:"Keypad 2", num_3:"Keypad 3", num_4:"Keypad 4",
  num_5:"Keypad 5", num_6:"Keypad 6", num_7:"Keypad 7", num_8:"Keypad 8", num_9:"Keypad 9",
  guide:"TV guide / EPG", exit:"Exit",
  record:"Record", rewind:"Rewind", forward:"Fast forward",
  red:"Red key", green:"Green key", yellow:"Yellow key", blue:"Blue key",
};


/* ════════════════════════════════════════════════════════════════════════
   Brand presets.

   A preset is a *template*, not a codeset — it never contains IR codes. All
   it does is tell the panel which buttons that family of remote actually has,
   so the checklist and the preview match the plastic in your hand instead of
   a generic guess. You still learn every code yourself.

   `groups` is the same shape as RECOMMENDED (title -> command names) and
   replaces the type default when set. `layout` is the same shape as
   REMOTE_LAYOUTS and replaces the type default when set. Omit either to
   inherit. `manufacturer` auto-fills the Advanced field on selection.
   ════════════════════════════════════════════════════════════════════════ */
const PRESETS = {
  projector: [
    { id: "generic", label: "Generic projector" },
    {
      id: "optoma",
      label: "Optoma — HD / UHD / GT / HZ series",
      manufacturer: "Optoma",
      note: "Optoma remotes have discrete On and Off keys rather than one toggle — learn power_on and power_off separately, and leave 'power' blank.",
      groups: [
        ["Power", ["power_on", "power_off"]],
        ["Sources", ["source_hdmi1", "source_hdmi2", "source_hdmi3", "source_vga", "source_video", "source"]],
        ["Picture", ["blank", "freeze", "aspect", "image_mode", "eco_mode", "resync"]],
        ["Geometry", ["keystone_up", "keystone_down", "zoom_in", "zoom_out"]],
        ["Navigation", ["menu", "ok", "up", "down", "left", "right", "back", "info"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
      ],
    },
    {
      id: "epson",
      label: "Epson — EH-TW / EB / EF series",
      manufacturer: "Epson",
      note: "Epson labels the blanking key 'A/V Mute' (learn it as blank), zoom is 'E-Zoom' and the picture preset key is 'Color Mode' (learn as image_mode). Power is a single toggle on most models — press twice to confirm off.",
      groups: [
        ["Power", ["power", "power_on", "power_off"]],
        ["Sources", ["source_hdmi1", "source_hdmi2", "source_vga", "source_video", "source"]],
        ["Picture", ["blank", "freeze", "aspect", "image_mode", "eco_mode"]],
        ["Geometry", ["keystone_up", "keystone_down", "zoom_in", "zoom_out"]],
        ["Navigation", ["menu", "ok", "up", "down", "left", "right", "back", "info", "help"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
      ],
    },
    {
      id: "benq",
      label: "BenQ — MS / MW / TK / W series",
      manufacturer: "BenQ",
      note: "BenQ blanking is 'Eco Blank'. Most models use discrete On/Off.",
      groups: [
        ["Power", ["power_on", "power_off", "power"]],
        ["Sources", ["source_hdmi1", "source_hdmi2", "source_vga", "source_video", "source"]],
        ["Picture", ["blank", "freeze", "aspect", "image_mode", "eco_mode", "resync"]],
        ["Geometry", ["keystone_up", "keystone_down", "zoom_in", "zoom_out"]],
        ["Navigation", ["menu", "ok", "up", "down", "left", "right", "back", "info"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
      ],
    },
    {
      id: "viewsonic",
      label: "ViewSonic — PA / PX / LS series",
      manufacturer: "ViewSonic",
    },
    {
      id: "nec",
      label: "NEC — M / P / PA series",
      manufacturer: "NEC",
      note: "NEC uses 'Picture Mute' for blanking and 'AUTO ADJ.' for resync.",
    },
    {
      id: "acer",
      label: "Acer — X / H / P series",
      manufacturer: "Acer",
    },
  ],

  receiver: [
    { id: "generic", label: "Generic AV receiver / amplifier" },
    {
      id: "yamaha",
      label: "Yamaha — RX-V / RX-A / TSR series",
      manufacturer: "Yamaha",
      note: "Yamaha scene keys (SCENE 1-4) are worth learning as preset_1..preset_4 — one press powers on and selects an input.",
      groups: [
        ["Power", ["power", "power_on", "power_off"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
        ["Scenes", ["preset_1", "preset_2", "preset_3", "preset_4"]],
        ["Sources", ["source_hdmi1", "source_hdmi2", "source_hdmi3", "source_hdmi4", "source_tv", "source_bd", "source_tuner", "source_bluetooth", "source_aux"]],
        ["Sound", ["sound_mode", "surround", "stereo", "direct", "night_mode"]],
        ["Navigation", ["menu", "ok", "up", "down", "left", "right", "back", "info"]],
      ],
    },
    {
      id: "denon",
      label: "Denon — AVR-S / AVR-X series",
      manufacturer: "Denon",
      note: "Denon and Marantz share a remote protocol family — if one preset doesn't capture cleanly, try the other.",
    },
    { id: "marantz", label: "Marantz — SR / NR series", manufacturer: "Marantz" },
    { id: "onkyo", label: "Onkyo — TX-NR / TX-SR series", manufacturer: "Onkyo" },
    { id: "pioneer", label: "Pioneer — VSX series", manufacturer: "Pioneer" },
    { id: "sony", label: "Sony — STR-DH / STR-DN series", manufacturer: "Sony" },
  ],

  soundbar: [
    { id: "generic", label: "Generic soundbar" },
    {
      id: "samsung",
      label: "Samsung — HW series",
      manufacturer: "Samsung",
      note: "Samsung soundbars cycle inputs on one 'Source' key rather than offering discrete input buttons. Learn 'source' and drive it with repeats.",
      groups: [
        ["Power", ["power"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
        ["Sources", ["source"]],
        ["Sound", ["sound_mode", "surround_on", "surround_off", "night_mode"]],
        ["Tone", ["bass_up", "bass_down", "treble_up", "treble_down"]],
        ["Playback", ["play", "pause", "next", "previous"]],
      ],
    },
    { id: "lg", label: "LG — SN / SP / S series", manufacturer: "LG" },
    { id: "jbl", label: "JBL — Bar series", manufacturer: "JBL" },
    { id: "polk", label: "Polk — Signa / MagniFi series", manufacturer: "Polk Audio" },
    { id: "bose", label: "Bose — Smart Soundbar series", manufacturer: "Bose" },
  ],

  decoder: [
    { id: "generic", label: "Generic decoder / set-top box" },
    {
      id: "dstv_explora",
      label: "DStv Explora / Explora Ultra",
      manufacturer: "MultiChoice",
      note: "The Explora remote is RF by default on newer units — pair it to IR mode first (Menu → Settings → Remote) or the blaster will have nothing to learn.",
      groups: [
        ["Power", ["power"]],
        ["Channels", ["channel_up", "channel_down", "last_channel"]],
        ["Keypad", ["num_1", "num_2", "num_3", "num_4", "num_5", "num_6", "num_7", "num_8", "num_9", "num_0"]],
        ["Navigation", ["home", "guide", "menu", "ok", "up", "down", "left", "right", "back", "exit", "info"]],
        ["PVR", ["record", "play", "pause", "stop", "rewind", "forward"]],
        ["Colour keys", ["red", "green", "yellow", "blue"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
      ],
    },
    {
      id: "dstv_hd",
      label: "DStv HD Decoder (single view)",
      manufacturer: "MultiChoice",
      note: "No PVR transport keys on the single-view HD decoder — skip the PVR group.",
      groups: [
        ["Power", ["power"]],
        ["Channels", ["channel_up", "channel_down", "last_channel"]],
        ["Keypad", ["num_1", "num_2", "num_3", "num_4", "num_5", "num_6", "num_7", "num_8", "num_9", "num_0"]],
        ["Navigation", ["guide", "menu", "ok", "up", "down", "left", "right", "back", "exit", "info"]],
        ["Colour keys", ["red", "green", "yellow", "blue"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
      ],
    },
    { id: "openview", label: "OpenView HD decoder", manufacturer: "OpenView" },
    { id: "starsat", label: "StarSat / OpenBox FTA receiver", manufacturer: "StarSat" },
    { id: "generic_fibre", label: "Fibre / IPTV set-top box", note: "Most IPTV boxes are IR — learn power, dpad, home and the transport keys." },
  ],

  tv: [
    { id: "generic", label: "Generic TV" },
    {
      id: "samsung",
      label: "Samsung — Tizen (AU / TU / QN series)",
      manufacturer: "Samsung",
      note: "Samsung uses a single power toggle and one 'Source' key that opens a picker — discrete HDMI keys usually don't exist on the remote.",
      groups: [
        ["Power", ["power"]],
        ["Volume", ["volume_up", "volume_down", "mute"]],
        ["Channels", ["channel_up", "channel_down"]],
        ["Navigation", ["home", "back", "menu", "ok", "up", "down", "left", "right"]],
        ["Sources & apps", ["source", "netflix", "youtube", "prime_video"]],
      ],
    },
    {
      id: "lg",
      label: "LG — webOS (UP / NANO / OLED series)",
      manufacturer: "LG",
      note: "Magic Remote models send Bluetooth for pointer and some keys — the IR fallback still covers power, volume, channel and the app keys.",
    },
    { id: "hisense", label: "Hisense — VIDAA series", manufacturer: "Hisense" },
    { id: "tcl", label: "TCL — Android / Google TV", manufacturer: "TCL" },
    { id: "sony", label: "Sony — Bravia", manufacturer: "Sony" },
    { id: "skyworth", label: "Skyworth / Sinotec / Telefunken", note: "Common SA budget-brand chassis — mostly shared IR protocols." },
  ],
};

const PRESET_EXTRA_HINTS = {
  resync: "Re-sync / auto adjust",
  help: "Help",
  prime_video: "Prime Video",
  preset_3: "Preset position 3", preset_4: "Preset position 4",
};
Object.assign(COMMAND_HINTS, PRESET_EXTRA_HINTS);

function presetsFor(type) { return PRESETS[type] || null; }
function findPreset(type, id) {
  return (presetsFor(type) || []).find(pr => pr.id === id) || null;
}

function humanize(key) {
  return String(key || "").replace(/[_-]+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
}
function slugify(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// ─── Remote layout maps ────────────────────────────────────────────────────

const REMOTE_LAYOUTS = {
  custom: [
    { type: "row", btns: [
      { cmd: "open", icon: "\u25b2", label: "Open" },
    ]},
    { type: "row", btns: [
      { cmd: "stop", icon: "\u25a0", label: "Stop" },
    ]},
    { type: "row", btns: [
      { cmd: "close", icon: "\u25bc", label: "Close" },
    ]},
    { type: "row", btns: [
      { cmd: "power", icon: "\u23fb", label: "Power", cls: "power" },
      { cmd: "preset_1", icon: "1", label: "Preset 1" },
      { cmd: "preset_2", icon: "2", label: "Preset 2" },
    ]},
  ],
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
  projector: [
    { type: "row", btns: [
      { cmd: "power_on", icon: "⏻", label: "On", cls: "power" },
      { cmd: "power_off", icon: "⏹", label: "Off", cls: "power" },
      { cmd: "power", icon: "◉", label: "Toggle", cls: "power" },
    ]},
    { type: "row", btns: [
      { cmd: "source_hdmi1", icon: "⬡", label: "HDMI 1" },
      { cmd: "source_hdmi2", icon: "⬡", label: "HDMI 2" },
      { cmd: "source_vga", icon: "▤", label: "VGA" },
      { cmd: "source", icon: "⇄", label: "Source" },
    ]},
    { type: "dpad" },
    { type: "row", btns: [
      { cmd: "menu", icon: "☰", label: "Menu" },
      { cmd: "back", icon: "↩", label: "Back" },
      { cmd: "info", icon: "ℹ", label: "Info" },
    ]},
    { type: "row", btns: [
      { cmd: "blank", icon: "⬛", label: "Blank" },
      { cmd: "freeze", icon: "❄", label: "Freeze" },
      { cmd: "aspect", icon: "⛶", label: "Aspect" },
      { cmd: "image_mode", icon: "🎨", label: "Picture" },
    ]},
    { type: "row", btns: [
      { cmd: "keystone_up", icon: "◺", label: "Keystone +" },
      { cmd: "keystone_down", icon: "◹", label: "Keystone −" },
      { cmd: "eco_mode", icon: "🌱", label: "Eco" },
    ]},
    { type: "row", btns: [
      { cmd: "zoom_out", icon: "－", label: "Zoom −" },
      { cmd: "zoom_in", icon: "＋", label: "Zoom +" },
      { cmd: "focus_near", icon: "◐", label: "Focus −" },
      { cmd: "focus_far", icon: "◑", label: "Focus +" },
    ]},
    { type: "row", btns: [
      { cmd: "volume_down", icon: "－", label: "Vol −" },
      { cmd: "mute", icon: "🔇", label: "Mute" },
      { cmd: "volume_up", icon: "＋", label: "Vol +" },
    ]},
  ],
  receiver: [
    { type: "row", btns: [
      { cmd: "power", icon: "⏻", label: "Power", cls: "power" },
      { cmd: "mute", icon: "🔇", label: "Mute" },
      { cmd: "info", icon: "ℹ", label: "Info" },
    ]},
    { type: "row", btns: [
      { cmd: "volume_down", icon: "－", label: "Vol −" },
      { cmd: "volume_up", icon: "＋", label: "Vol +" },
    ]},
    { type: "row", btns: [
      { cmd: "source_hdmi1", icon: "1", label: "HDMI 1" },
      { cmd: "source_hdmi2", icon: "2", label: "HDMI 2" },
      { cmd: "source_hdmi3", icon: "3", label: "HDMI 3" },
      { cmd: "source_hdmi4", icon: "4", label: "HDMI 4" },
    ]},
    { type: "row", btns: [
      { cmd: "source_tv", icon: "📺", label: "TV" },
      { cmd: "source_bd", icon: "💿", label: "BD" },
      { cmd: "source_tuner", icon: "📻", label: "Tuner" },
      { cmd: "source_bluetooth", icon: "ᛒ", label: "BT" },
    ]},
    { type: "dpad" },
    { type: "row", btns: [
      { cmd: "menu", icon: "☰", label: "Menu" },
      { cmd: "back", icon: "↩", label: "Back" },
    ]},
    { type: "row", btns: [
      { cmd: "sound_mode", icon: "🎚", label: "Mode" },
      { cmd: "surround", icon: "◎", label: "Surround" },
      { cmd: "stereo", icon: "◫", label: "Stereo" },
      { cmd: "night_mode", icon: "🌙", label: "Night" },
    ]},
    { type: "row", btns: [
      { cmd: "bass_down", icon: "－", label: "Bass −" },
      { cmd: "bass_up", icon: "＋", label: "Bass +" },
      { cmd: "treble_down", icon: "－", label: "Treble −" },
      { cmd: "treble_up", icon: "＋", label: "Treble +" },
    ]},
  ],
  soundbar: [
    { type: "row", btns: [
      { cmd: "power", icon: "⏻", label: "Power", cls: "power" },
      { cmd: "mute", icon: "🔇", label: "Mute" },
    ]},
    { type: "row", btns: [
      { cmd: "volume_down", icon: "－", label: "Vol −" },
      { cmd: "volume_up", icon: "＋", label: "Vol +" },
    ]},
    { type: "row", btns: [
      { cmd: "source_tv", icon: "📺", label: "TV" },
      { cmd: "source_hdmi", icon: "⬡", label: "HDMI" },
      { cmd: "source_optical", icon: "◇", label: "Optical" },
      { cmd: "source_bluetooth", icon: "ᛒ", label: "BT" },
    ]},
    { type: "row", btns: [
      { cmd: "sound_mode", icon: "🎚", label: "Mode" },
      { cmd: "surround_on", icon: "◎", label: "Surr On" },
      { cmd: "surround_off", icon: "○", label: "Surr Off" },
      { cmd: "night_mode", icon: "🌙", label: "Night" },
    ]},
    { type: "row", btns: [
      { cmd: "bass_down", icon: "－", label: "Bass −" },
      { cmd: "bass_up", icon: "＋", label: "Bass +" },
      { cmd: "treble_down", icon: "－", label: "Treble −" },
      { cmd: "treble_up", icon: "＋", label: "Treble +" },
    ]},
    { type: "row", btns: [
      { cmd: "previous", icon: "⏮", label: "Prev" },
      { cmd: "play", icon: "▶", label: "Play" },
      { cmd: "pause", icon: "⏸", label: "Pause" },
      { cmd: "next", icon: "⏭", label: "Next" },
    ]},
  ],
  decoder: [
    { type: "row", btns: [
      { cmd: "power", icon: "⏻", label: "Power", cls: "power" },
      { cmd: "mute", icon: "🔇", label: "Mute" },
      { cmd: "info", icon: "ℹ", label: "Info" },
    ]},
    { type: "row", btns: [
      { cmd: "num_1", icon: "1", label: "1" },
      { cmd: "num_2", icon: "2", label: "2" },
      { cmd: "num_3", icon: "3", label: "3" },
    ]},
    { type: "row", btns: [
      { cmd: "num_4", icon: "4", label: "4" },
      { cmd: "num_5", icon: "5", label: "5" },
      { cmd: "num_6", icon: "6", label: "6" },
    ]},
    { type: "row", btns: [
      { cmd: "num_7", icon: "7", label: "7" },
      { cmd: "num_8", icon: "8", label: "8" },
      { cmd: "num_9", icon: "9", label: "9" },
    ]},
    { type: "row", btns: [
      { cmd: "last_channel", icon: "↺", label: "Last" },
      { cmd: "num_0", icon: "0", label: "0" },
      { cmd: "exit", icon: "✕", label: "Exit" },
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
      { cmd: "guide", icon: "📋", label: "Guide" },
      { cmd: "menu", icon: "☰", label: "Menu" },
      { cmd: "back", icon: "↩", label: "Back" },
    ]},
    { type: "row", btns: [
      { cmd: "rewind", icon: "⏪", label: "Rew" },
      { cmd: "play", icon: "▶", label: "Play" },
      { cmd: "pause", icon: "⏸", label: "Pause" },
      { cmd: "forward", icon: "⏩", label: "Fwd" },
    ]},
    { type: "row", btns: [
      { cmd: "record", icon: "⏺", label: "Rec" },
      { cmd: "stop", icon: "⏹", label: "Stop" },
    ]},
    { type: "row", btns: [
      { cmd: "red", icon: "🔴", label: "Red" },
      { cmd: "green", icon: "🟢", label: "Green" },
      { cmd: "yellow", icon: "🟡", label: "Yellow" },
      { cmd: "blue", icon: "🔵", label: "Blue" },
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
  climate_relative: [
    { type: "row", btns: [
      { cmd: "power_toggle", icon: "⏻", label: "Power", cls: "power" },
      { cmd: "off", icon: "⏹", label: "Off" },
    ]},
    { type: "row", btns: [
      { cmd: "mode_toggle", icon: "⟳", label: "Mode" },
      { cmd: "fan_toggle", icon: "〰", label: "Fan speed" },
      { cmd: "swing_toggle", icon: "↕", label: "Swing" },
    ]},
    { type: "row", btns: [
      { cmd: "temp_down", icon: "－", label: "Temp −" },
      { cmd: "temp_up", icon: "＋", label: "Temp +" },
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
    this._learnMode = "ir";
    this._testFeedback = {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._rendered = true;
      this._loadMotionPref();
      this._render();
      this._attachEvents();
      this._applyMotionPref();
      this._typeHint();
      this._renderPresetSelect("generic");
      this._load();
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  /**
   * Install the @keyframes into the panel's OWN tree scope.
   *
   * THE fix for the "animations don't run" saga, and the correction to the
   * v1.10.2 near-miss.
   *
   * `@keyframes` are resolved per tree scope, and shadow DOM is a hard
   * boundary that keyframe lookups do not cross — in EITHER direction.
   * Depending on the HA build, this panel is mounted differently:
   *   - some builds put it in the light DOM (document scope),
   *   - current builds mount it inside <home-assistant-main>'s shadow root.
   * The diagnostic report confirmed the latter: the panel's tree scope was a
   * shadow root, the animation-name matched (ir-rise) and the play-state read
   * "running", yet getAnimations() returned 0 — because the keyframes had been
   * hoisted to document.head, which is OUTSIDE that shadow root, so the name
   * bound to nothing. Right idea, wrong side of the boundary.
   *
   * The keyframes now live directly inside the panel's own innerHTML (see
   * _render), as the first <style> block. This is the only placement immune to
   * how and when HA mounts the panel:
   *
   *   - Earlier builds appended a keyframes <style> to document.head or to
   *     this.getRootNode() at render time. Both broke, for different reasons.
   *     document.head is outside the panel's shadow root, so the shadow-DOM
   *     boundary blocked the binding (v1.10.2). getRootNode() at render time
   *     ran before HA reparented the panel into <home-assistant-main>'s shadow
   *     root, so the <style> was appended to the wrong (then-current) root and
   *     orphaned when the panel moved — the report showed it simply MISSING
   *     from the panel's final scope (v1.10.3).
   *
   *   - A <style> that is part of this.innerHTML is, by construction, always in
   *     the same tree scope as the elements it animates, whatever scope that
   *     turns out to be. Inside a shadow root, same-subtree @keyframes resolve
   *     normally — that's how every shadow-DOM component ships animation. No
   *     timing assumptions, nothing to orphan.
   *
   * (The v1.10.0 original also had the keyframes inline and they still didn't
   * run — but that was the prefers-reduced-motion media query flattening them,
   * which has since been removed. Inline placement itself was never the fault.)
   */

  _render() {
    this.innerHTML = `
<style>
  /* Keyframes live here, inside the panel's own <style>, so they share tree
     scope with the elements that reference them no matter where HA mounts the
     panel (light DOM or shadow root). See the long note above _render. */
${AR_KEYFRAMES}

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
  .ir-callout.warning { background: rgba(250,150,0,.09); border: 1px solid rgba(250,150,0,.35); }

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
    height: 8px; border-radius: 5px;
    background: rgba(127,127,127,.15); margin: 10px 0 6px; overflow: hidden;
  }
  .ir-cov-fill {
    height: 100%; border-radius: 5px;
    background: linear-gradient(90deg, #12805a, #1a9966 60%, #35c98d);
    transition: width .55s cubic-bezier(.34,1.4,.5,1);
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

  /* IR / RF mode toggle */
  .ir-mode-seg {
    display: inline-flex; border: 1px solid rgba(127,127,127,.25);
    border-radius: 999px; overflow: hidden;
  }
  .ir-mode-seg button {
    border: none; background: transparent; color: var(--secondary-text-color);
    font-size: 12px; font-weight: 700; padding: 7px 18px; cursor: pointer;
    transition: background .15s, color .15s; min-height: 32px;
  }
  .ir-mode-seg button + button { border-left: 1px solid rgba(127,127,127,.25); }
  .ir-mode-seg button.active { background: var(--primary-color); color: #fff; }
  .ir-mode-seg button:active { transform: scale(.97); }
  .ir-mode-hint { font-size: 12px; color: var(--secondary-text-color); margin: 6px 0 12px; line-height: 1.45; }

  /* ══════════════════════════════════════════════════════════════════════
     Animation pack — 10 keyframes. Each one is wired to a real UI moment;
     nothing here is decorative-only. Search a name to find its trigger.
     ══════════════════════════════════════════════════════════════════════ */

  /* 1 — ir-spin: in-button spinner while a request is in flight */
    /* 2 — ir-pulse: "we're waiting on you" breathing */
    /* 3 — ir-panel-in: step panel enter */
    /* 4 — ir-callout-in: callout drop-in */
    /* 5 — ir-shake: error callout */
    /* 6 — ir-wave: IR emission rings off the Learn button while capturing */
    /* 7 — ir-pop: a command was just captured */
    /* 8 — ir-shimmer: coverage bar sweep when the number moves */
    /* 9 — ir-flash: remote button confirm ripple */
    /* 10 — ir-rise: staggered list entry */
  
  /* ── Bindings ── */

  /* 1 */
  .ir-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
    border-radius: 50%; animation: ir-spin .6s linear infinite;
    vertical-align: middle; margin-right: 6px;
  }
  /* 2 — applied by _showLearnCallout() while type === "learning" */
  .ir-learning-pulse { animation: ir-pulse 1.2s ease-in-out infinite; }

  /* 3 — _setStep() toggles .active */
  .ir-panel.active { animation: ir-panel-in .26s ease-out both; }

  /* 4 + 5 — _showCallout() / _showLearnCallout() */
  .ir-anim-in { animation: ir-callout-in .22s ease-out both; }
  .ir-anim-shake { animation: ir-callout-in .22s ease-out both, ir-shake .4s ease-in-out .06s both; }

  /* 6 — _setLearning(true) adds .learning */
  #ir-learn-btn { position: relative; }
  #ir-learn-btn.learning:disabled { opacity: 1; }
  #ir-learn-btn.learning::before,
  #ir-learn-btn.learning::after {
    content: ""; position: absolute; inset: -1px;
    border-radius: 999px; border: 2px solid var(--primary-color);
    animation: ir-wave 1.5s ease-out infinite;
    pointer-events: none;
  }
  #ir-learn-btn.learning::after { animation-delay: .75s; }

  /* 7 — _renderPills() tags the command that just came back */
  .ir-pill.just-learned { animation: ir-pop .45s ease-out both; }

  /* Listening-for-IR radar (shown by _setLearning while capturing) */
  .ir-radar {
    display: flex; align-items: center; gap: 16px;
    margin: 4px 0 14px; padding: 14px 16px;
    border-radius: 14px;
    background: rgba(250,150,0,.08);
    border: 1px solid rgba(250,150,0,.28);
    animation: ir-callout-in .24s ease-out both;
  }
  .ir-radar-scope {
    position: relative; flex-shrink: 0;
    width: 60px; height: 60px; border-radius: 50%;
    background: radial-gradient(circle at center, rgba(250,150,0,.16), transparent 70%);
    overflow: hidden;
  }
  .ir-radar-ring {
    position: absolute; left: 50%; top: 50%;
    width: 60px; height: 60px; border-radius: 50%;
    border: 2px solid rgba(250,150,0,.6);
    transform: translate(-50%, -50%) scale(.25);
    animation: ir-radar-ping 2s ease-out infinite;
  }
  .ir-radar-ring:nth-child(2) { animation-delay: .66s; }
  .ir-radar-ring:nth-child(3) { animation-delay: 1.33s; }
  .ir-radar-core {
    position: absolute; left: 50%; top: 50%;
    width: 12px; height: 12px; border-radius: 50%;
    transform: translate(-50%, -50%);
    background: #fa9600;
    animation: ir-radar-core 1.4s ease-in-out infinite;
  }
  .ir-radar-sweep {
    position: absolute; left: 50%; top: 50%;
    width: 30px; height: 30px; transform-origin: 0 0;
    background: conic-gradient(from 0deg, rgba(250,150,0,.45), transparent 60deg);
    animation: ir-radar-sweep 1.8s linear infinite;
  }
  .ir-radar-title { font-size: 14px; font-weight: 700; color: #b5730a; margin-bottom: 2px; }
  .ir-radar-sub { font-size: 12px; color: var(--secondary-text-color); line-height: 1.4; }
  .ir-wrap[data-motion="reduced"] .ir-radar-sweep,
  .ir-wrap[data-motion="reduced"] .ir-radar-ring { animation-duration: 3s !important; }

  /* 8 — _updateStats() adds .filling when the percentage climbs */
  .ir-cov-fill { position: relative; overflow: hidden; }
  .ir-cov-fill.filling::after {
    content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 55%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
    animation: ir-shimmer 1s ease-out;
  }

  /* 9 — _renderTestRemote() adds .sent on a successful test send */
  .ir-rbtn.sent { animation: ir-flash .6s ease-out; }

  /* 10 — _renderProfileList() / _renderChecklist() stagger via --i */
  .ir-rise { animation: ir-rise .3s ease-out both; animation-delay: calc(var(--i, 0) * 35ms); }

  /* Reduced motion: degrade, don't disappear.
     The setting is about *movement* — slides, scales, sweeps. Those get
     opacity-only substitutes here rather than being switched off, so the
     feedback still lands and nothing travels across the screen.
     ir-pulse, ir-flash and ir-spin involve no movement (opacity, box-shadow,
     and a spinner that must spin to mean anything) and are left alone.

     ⚠ Gated on [data-motion="reduced"], NOT on @media (prefers-reduced-motion),
     because the media query is not overridable from inside the page and Android
     turns it on for the whole WebView whenever battery saver or "Remove
     animations" is active — which silently flattened the entire pack with no
     way for the user to say "no, I want them". _applyMotionPref() reads the
     media query, applies the user's Auto/Full/Reduced choice on top, and sets
     the attribute. Auto still honours the OS. */
    
  .ir-wrap[data-motion="reduced"] .ir-panel.active,
  .ir-wrap[data-motion="reduced"] .ir-anim-in,
  .ir-wrap[data-motion="reduced"] .ir-anim-shake,
  .ir-wrap[data-motion="reduced"] .ir-rise {
    animation: ir-fade-in .2s ease-out both !important;
  }
  .ir-wrap[data-motion="reduced"] .ir-rise { animation-delay: calc(var(--i, 0) * 25ms) !important; }
  .ir-wrap[data-motion="reduced"] .ir-pill.just-learned { animation: ir-fade-in .3s ease-out both !important; }
  .ir-wrap[data-motion="reduced"] #ir-learn-btn.learning::before { animation: ir-ring-fade 1.6s ease-in-out infinite !important; }
  .ir-wrap[data-motion="reduced"] #ir-learn-btn.learning::after { animation: none !important; }
  .ir-wrap[data-motion="reduced"] .ir-cov-fill.filling::after { animation: none !important; }
  .ir-wrap[data-motion="reduced"] .ir-cov-fill { transition: none !important; }

  /* Remote preview (step 2) */
  .ir-preview-card {
    margin-top: 18px; border-radius: 14px;
    border: 1px solid rgba(127,127,127,.2);
    background: rgba(127,127,127,.05);
    overflow: hidden;
  }
  .ir-preview-head {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border-bottom: 1px solid rgba(127,127,127,.16);
  }
  .ir-preview-head > div:first-child { flex: 1; min-width: 0; }
  .ir-preview-title { font-size: 13px; font-weight: 700; }
  .ir-preview-sub { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }
  .ir-preview-body {
    display: grid; grid-template-columns: minmax(0, 240px) 1fr;
    gap: 18px; padding: 16px 14px;
  }
  .ir-preview-card.collapsed .ir-preview-body { display: none; }
  .ir-preview-shell { margin: 0; }
  .ir-preview-shell .ir-rbtn { cursor: default; }
  .ir-preview-shell .ir-rbtn:hover { background: rgba(127,127,127,.09); border-color: rgba(127,127,127,.22); }
  .ir-preview-shell .ir-rbtn:active { transform: none; }
  .ir-preview-shell .ir-rbtn.todo { opacity: .55; border-style: dashed; }
  .ir-preview-shell .ir-rbtn.done { background: rgba(26,153,107,.13); border-color: rgba(26,153,107,.4); }
  .ir-preview-side { font-size: 12px; color: var(--secondary-text-color); }
  .ir-preview-count { font-size: 13px; font-weight: 700; color: var(--primary-text-color); margin-bottom: 8px; }
  .ir-preview-legend { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .ir-preview-legend span { display: flex; align-items: center; gap: 7px; }
  .ir-legend-dot {
    width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
    border: 1px solid rgba(127,127,127,.4); background: transparent;
  }
  .ir-legend-dot.done { background: rgba(26,153,107,.5); border-color: rgba(26,153,107,.6); }
  .ir-legend-dot.todo { border-style: dashed; }
  .ir-preview-note { line-height: 1.5; }
  @media (max-width: 700px) {
    .ir-preview-body { grid-template-columns: 1fr; }
  }

  /* Motion control (see the Animation pack above) */
  .ir-motion-bar {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    margin-top: 14px; padding-top: 12px;
    border-top: 1px solid rgba(127,127,127,.16);
    font-size: 11px; color: var(--secondary-text-color);
  }
  .ir-motion-bar label { font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .ir-motion-bar select {
    padding: 4px 8px; border-radius: 7px; font-size: 11px;
    border: 1px solid rgba(127,127,127,.3);
    background: var(--secondary-background-color, rgba(0,0,0,.04));
    color: var(--primary-text-color);
  }
  .ir-motion-state { font-family: monospace; }

  /* ── Motion self-test ──────────────────────────────────────────────────
     Every animation in the pack is 220-600ms and subtle by design, which is
     fine in use but useless as a test: "did you see a 220ms fade?" is not a
     question anyone can answer honestly on a phone. This one is 2.5s, moves
     across the whole panel, and changes colour. If this doesn't move, CSS
     animations are not running — full stop, no judgement call required. */
  .ir-selftest {
    position: relative; height: 16px; margin: 10px 0 0; flex-basis: 100%;
    border-radius: 999px; overflow: hidden;
    background: rgba(127,127,127,.16);
    display: none;
  }
  .ir-selftest.running { display: block; }
  .ir-selftest::after {
    content: ""; position: absolute; top: 0; bottom: 0; left: 0;
    width: 24%; border-radius: 999px;
    /* Resting state is visible on its own, so even if the animation never
       binds you see a static coloured block rather than nothing — that
       distinguishes "animation didn't run" from "element didn't render". */
    background: #1b7aff;
  }
  /* Loops while running so it can't be "already finished" by the time you look.
     _testMotion() removes .running after ~5s. */
  .ir-selftest.running::after { animation: ir-selftest 1.6s ease-in-out infinite; }

  /* Diagnostics */
  .ir-diag {
    display: none; margin-top: 12px; border-radius: 12px;
    border: 1px solid rgba(127,127,127,.25);
    background: rgba(127,127,127,.06); overflow: hidden;
  }
  .ir-diag.show { display: block; }
  .ir-diag-head {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; border-bottom: 1px solid rgba(127,127,127,.18);
    font-size: 13px;
  }
  .ir-diag-head strong { flex: 1; }
  .ir-diag-verdict {
    padding: 10px 12px; font-size: 13px; line-height: 1.5;
    border-bottom: 1px solid rgba(127,127,127,.14);
  }
  .ir-diag-verdict.bad { background: rgba(220,50,50,.09); color: #c83030; }
  .ir-diag-verdict.good { background: rgba(26,153,107,.1); }
  .ir-diag pre {
    margin: 0; padding: 12px; font-size: 11px; line-height: 1.6;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    white-space: pre-wrap; word-break: break-word;
    max-height: 340px; overflow: auto;
    color: var(--primary-text-color);
  }

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

  /* IR emitter — the "signal going off" when a command fires */
  .ir-remote-header {
    display: flex; flex-direction: column; align-items: center;
    gap: 10px; margin-bottom: 16px;
  }
  .ir-remote-header .ir-remote-top { margin-bottom: 0; }
  .ir-emitter {
    position: relative; width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
  }
  .ir-emitter-dot {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 10px; height: 10px; border-radius: 50%;
    background: #b03030;
    transition: background .2s;
  }
  .ir-emitter-wave {
    position: absolute; left: 50%; top: 50%;
    width: 14px; height: 14px; border-radius: 50%;
    border: 3px solid rgba(255,82,82,.8);
    transform: translate(-50%, -50%) scale(.3);
    opacity: 0;
  }
  /* When .firing is set, the dot pulses and the three waves radiate out,
     staggered, so it reads as an IR burst leaving the emitter. */
  .ir-emitter.firing .ir-emitter-dot { animation: ir-emit-dot .55s ease-out; }
  .ir-emitter.firing .ir-emitter-wave { animation: ir-emit-wave .7s ease-out; }
  .ir-emitter.firing .ir-emitter-wave:nth-child(3) { animation-delay: .12s; }
  .ir-emitter.firing .ir-emitter-wave:nth-child(4) { animation-delay: .24s; }

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
  /* Instant press reaction — fires on tap, before the network round-trip. */
  .ir-rbtn.pressing { animation: ir-btn-press .45s ease-out, ir-btn-glow .55s ease-out; }
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

<div class="ir-wrap" id="ir-wrap">

  <!-- Header -->
  <div class="ir-header">
    <div class="ir-header-icon">📡</div>
    <div>
      <h1>AR Smart IR Builder</h1>
      <div class="ir-version">v1.11.1</div>
    </div>
    <select id="ir-entry" class="ir-remote-select" title="Select remote"></select>
  </div>

  <!-- Motion control. Lives up top on purpose: when the animations look dead,
       this is the first thing to check, and it's the thing that fixes it. -->
  <div class="ir-motion-bar">
    <label for="ir-motion">Motion</label>
    <select id="ir-motion" title="Override the OS reduced-motion setting for this panel">
      <option value="auto">Auto — follow this device</option>
      <option value="full">Always animate</option>
      <option value="reduced">Minimal</option>
    </select>
    <span class="ir-motion-state" id="ir-motion-state">—</span>
    <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-motion-test" type="button">Test</button>
    <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-motion-diag" type="button">Diagnose</button>
    <div class="ir-selftest" id="ir-selftest"></div>
  </div>

  <!-- Diagnostic report. Deliberately a <pre> with a copy button: the answer to
       "why don't the animations run" is a set of facts about this specific
       browser, and those facts have to get back to a human to be useful. -->
  <div class="ir-diag" id="ir-diag">
    <div class="ir-diag-head">
      <strong>Animation diagnostics</strong>
      <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-diag-copy" type="button">Copy</button>
      <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-diag-close" type="button">Close</button>
    </div>
    <div class="ir-diag-verdict" id="ir-diag-verdict"></div>
    <pre id="ir-diag-out"></pre>
  </div>

  <!-- Setup guard -->
  <div id="ir-setup-guard" class="ir-setup-guard">
    <h2>Integration setup required</h2>
    <p id="ir-setup-msg">Go to Settings → Devices &amp; Services and add the AR Smart IR Builder integration with at least one IR controller (Broadlink remote or Tasmota IR device).</p>
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
      <div class="ir-card-desc" style="margin-bottom:12px">Permanently delete an IR controller entry and all its profiles. Cannot be undone.</div>
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
              <optgroup label="Climate">
                <option value="climate">Climate / air conditioner</option>
                <option value="fan">Fan</option>
              </optgroup>
              <optgroup label="Audio / video">
                <option value="tv">TV</option>
                <option value="projector">Projector</option>
                <option value="receiver">AV receiver / amplifier</option>
                <option value="soundbar">Soundbar</option>
                <option value="decoder">Decoder / set-top box</option>
                <option value="media_player">Media player (generic)</option>
              </optgroup>
              <optgroup label="Other">
                <option value="custom">Custom / other (blinds, screens, gates…)</option>
              </optgroup>
            </select>
            <div class="ir-hint" id="ir-type-hint"></div>
          </div>
          <div class="ir-field" id="ir-preset-field">
            <label>Remote preset <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>
            <select id="ir-preset"></select>
            <div class="ir-hint">Presets only shape the button list and the preview below — they contain no IR codes. You still learn every code off your own remote.</div>
            <div class="ir-callout warning" id="ir-preset-note" style="display:none"></div>
          </div>
          <div class="ir-field" id="ir-climate-style-field">
            <label>AC remote style</label>
            <select id="ir-climate-style">
              <option value="absolute">Discrete buttons — one button per mode / per temperature</option>
              <option value="relative">Mode + Temp ±  — one Mode button cycles modes, one Up/Down button steps temperature</option>
            </select>
            <div class="ir-hint">If your remote only has a single "Mode" button and Temp +/- buttons instead of separate Cool/Heat/Dry and 18°/20°/22° buttons, pick the second option.</div>
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

        <!-- Remote preview -->
        <div class="ir-preview-card" id="ir-preview-card">
          <div class="ir-preview-head">
            <div>
              <div class="ir-preview-title">Remote preview</div>
              <div class="ir-preview-sub" id="ir-preview-sub">—</div>
            </div>
            <button class="ir-btn ir-btn-ghost ir-btn-sm" id="ir-preview-toggle" type="button">Hide</button>
          </div>
          <div class="ir-preview-body" id="ir-preview-body">
            <div class="ir-remote-shell ir-preview-shell">
              <div class="ir-remote-body" id="ir-preview-remote"></div>
            </div>
            <div class="ir-preview-side">
              <div class="ir-preview-count" id="ir-preview-count">—</div>
              <div class="ir-preview-legend">
                <span><i class="ir-legend-dot done"></i> already learned</span>
                <span><i class="ir-legend-dot todo"></i> still to learn</span>
              </div>
              <p class="ir-preview-note">
                This is the button set you'll be asked for in step 3 — it's a
                template of what this kind of remote normally has, not a
                guarantee. Buttons your remote doesn't have can just be skipped.
              </p>
            </div>
          </div>
        </div>
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

      <!-- Listening-for-IR radar: shown only while a capture is in progress. -->
      <div class="ir-radar" id="ir-radar" style="display:none">
        <div class="ir-radar-scope">
          <span class="ir-radar-ring"></span>
          <span class="ir-radar-ring"></span>
          <span class="ir-radar-ring"></span>
          <span class="ir-radar-core"></span>
          <span class="ir-radar-sweep"></span>
        </div>
        <div class="ir-radar-text">
          <div class="ir-radar-title">Listening for IR…</div>
          <div class="ir-radar-sub" id="ir-radar-sub">Point your remote at the receiver and press the button once.</div>
        </div>
      </div>

      <div class="ir-field" style="margin-bottom:0">
        <label>Capture mode</label>
        <div class="ir-mode-seg" id="ir-mode-seg" role="group" aria-label="Capture mode">
          <button type="button" id="ir-mode-ir" class="active" data-mode="ir">IR</button>
          <button type="button" id="ir-mode-rf" data-mode="rf">RF</button>
        </div>
      </div>
      <div class="ir-mode-hint" id="ir-mode-hint">Infrared capture — press the button on your remote once when prompted.</div>

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
        <div style="font-size:12px;color:var(--secondary-text-color);margin-bottom:8px" id="ir-paste-hint">
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
          Paste a JSON object mapping command names to codes (Broadlink Base64 strings, or Tasmota IRSend JSON if this entry uses a Tasmota controller). Existing commands with the same name will be overwritten.
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
        <div class="ir-card-desc" style="margin-bottom:12px">Tap any button to fire the command through your IR controller — the button reacts and the emitter blasts IR waves.</div>
        <div class="ir-remote-wrap">
          <div class="ir-remote-shell">
            <div class="ir-remote-header">
              <div class="ir-emitter" id="ir-emitter" title="IR emitter">
                <span class="ir-emitter-dot"></span>
                <span class="ir-emitter-wave"></span>
                <span class="ir-emitter-wave"></span>
                <span class="ir-emitter-wave"></span>
              </div>
              <div class="ir-remote-top" id="ir-remote-name">Remote</div>
            </div>
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
          <h3>📦 ar_smart_ir codeset</h3>
          <p>Builds a typed codeset and saves it to <code>/config/ar_smart_ir_codes/&lt;platform&gt;/&lt;code&gt;.json</code> (auto-numbered from 9000, survives HACS updates). Then pick that code in the ar_smart_ir config flow.</p>
          <button class="ir-btn ir-btn-primary" id="ir-export-smartir-btn">Export to ar_smart_ir</button>
          <a id="ir-smartir-download" class="ir-btn ir-btn-ghost" style="display:none;margin-top:8px" download>⬇ Download a copy</a>
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
    this.qs("#ir-type").addEventListener("change", () => {
      this._toggleClimateStyleField();
      this._renderPresetSelect("generic");
      this._refreshDerivedUI();
    });
    this.qs("#ir-preset").addEventListener("change", () => {
      this._renderPresetNote();
      this._applyPresetManufacturer();
      this._refreshDerivedUI();
    });
    this.qs("#ir-preview-toggle").onclick = () => {
      const card = this.qs("#ir-preview-card");
      const collapsed = card.classList.toggle("collapsed");
      this.qs("#ir-preview-toggle").textContent = collapsed ? "Show" : "Hide";
    };
    this.qs("#ir-climate-style").addEventListener("change", () => this._refreshDerivedUI());

    // Motion
    this.qs("#ir-motion").addEventListener("change", (e) => this._setMotionPref(e.target.value));
    this.qs("#ir-motion-test").onclick = () => this._testMotion();
    this.qs("#ir-motion-diag").onclick = () => this._diagnose();
    this.qs("#ir-diag-copy").onclick = () => this._copyDiag();
    this.qs("#ir-diag-close").onclick = () => this.qs("#ir-diag").classList.remove("show");
    // Auto mode must react if the OS setting flips mid-session (battery saver
    // kicking in is exactly when this happens).
    window.matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", () => this._applyMotionPref());

    // Step 3
    this.qs("#ir-learn-btn").onclick = () => this._learnCommand();
    this.qs("#ir-mode-ir").onclick = () => this._setLearnMode("ir");
    this.qs("#ir-mode-rf").onclick = () => this._setLearnMode("rf");
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
    if (this._step === 2) this._renderPreviewRemote();
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

  _entryLabel(e) {
    const tag = e.controller_type === "tasmota_mqtt" ? "Tasmota" : "Broadlink";
    const detail = e.controller_type === "tasmota_mqtt" ? (e.mqtt_base_topic || "") : (e.remote_entity || "");
    return detail ? `${e.title} — ${tag} (${detail})` : `${e.title} — ${tag}`;
  }

  _currentEntry() {
    const entryId = this.qs("#ir-entry")?.value;
    return (this._data.entries || []).find(e => e.entry_id === entryId) || null;
  }

  _currentController() {
    return this._currentEntry()?.controller_type === "tasmota_mqtt" ? "tasmota_mqtt" : "broadlink";
  }

  _populateEntries() {
    const sel = this.qs("#ir-entry");
    const prev = sel.value;
    sel.innerHTML = "";
    (this._data.entries || []).forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.entry_id;
      opt.text = this._entryLabel(e);
      sel.add(opt);
    });
    if (prev && this._data.entries.some(e => e.entry_id === prev)) sel.value = prev;

    const delSel = this.qs("#ir-delete-entry-select");
    if (delSel) {
      delSel.innerHTML = "";
      (this._data.entries || []).forEach(e => {
        const opt = document.createElement("option");
        opt.value = e.entry_id;
        opt.text = this._entryLabel(e);
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

    keys.forEach((key, idx) => {
      const d = devices[key];
      const icon = TYPE_ICONS[d.device_type] || "📡";
      const cmdCount = Object.keys(d.commands || {}).length;
      const recType = this._effectiveType(d.device_type, d.climate_style);
      const rec = (RECOMMENDED[recType] || RECOMMENDED.climate).flatMap(([, c]) => c);
      const covered = rec.filter(c => d.commands?.[c]).length;
      const pct = rec.length ? Math.round(covered / rec.length * 100) : 0;

      const item = document.createElement("div");
      item.className = "ir-profile-item ir-rise" + (key === this._currentKey ? " selected" : "");
      item.style.setProperty("--i", idx);
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
    this.qs("#ir-climate-style").value = "absolute";
    this._toggleClimateStyleField();
    this._renderPresetSelect("generic");
    this._typeHint();
    this.qs("#ir-manufacturer").value = "";
    this.qs("#ir-model").value = "";
    this.qs("#ir-supported-models").value = "";
    this.qs("#ir-details-title").textContent = "New profile";
    this._renderPreviewRemote();
  }

  _loadProfile(key) {
    this._currentKey = key;
    const d = this._data.store?.devices?.[key] || {};
    this.qs("#ir-name").value = d.name || humanize(key);
    this.qs("#ir-key").value = key;
    this.qs("#ir-key").dataset.manualEdit = "1";
    this.qs("#ir-type").value = d.device_type || "climate";
    this.qs("#ir-climate-style").value = d.climate_style === "relative" ? "relative" : "absolute";
    this._toggleClimateStyleField();
    this._renderPresetSelect(d.preset || "generic");
    this._typeHint();
    this.qs("#ir-manufacturer").value = d.manufacturer || "";
    this.qs("#ir-model").value = d.model || "";
    this.qs("#ir-supported-models").value = (d.supported_models || []).join(", ");
    this.qs("#ir-details-title").textContent = d.name || humanize(key);
    if (d.entry_id) {
      const sel = this.qs("#ir-entry");
      if ([...sel.options].some(o => o.value === d.entry_id)) sel.value = d.entry_id;
    }
    this._renderPreviewRemote();
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
      preset: this._currentPresetId(),
      climate_style: this.qs("#ir-climate-style")?.value === "relative" ? "relative" : "absolute",
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
    const controller = this._currentController();
    const mode = controller === "tasmota_mqtt" ? "ir" : (this._learnMode === "rf" ? "rf" : "ir");
    if (!cmdName) { this._showLearnCallout("Enter a command name first.", "error"); return; }
    if (!key) { this._showCallout("Save a profile first.", "error"); this._setStep(2); return; }
    if (!entryId) { this._showCallout("Select a remote entry.", "error"); return; }
    await this._run(async () => {
      await this._hass.callService("ar_smart_ir_builder", "save_device", this._profilePayload());
      let prompt;
      if (controller === "tasmota_mqtt") {
        prompt = `⏳ Point the remote at the Tasmota IR receiver and press the button for "${cmdName}"… (waiting up to 25s)`;
      } else {
        prompt = mode === "rf"
          ? `📡 RF sweep — press and HOLD a button on the remote, then tap it once to capture "${cmdName}"…`
          : `⏳ Point remote at Broadlink and press the button for "${cmdName}"…`;
      }
      this._showLearnCallout(prompt, "learning");
      this._setLearning(true);
      // WebSocket service call (not REST callApi): on failure the real
      // HomeAssistantError text comes back in err.message instead of an
      // opaque "Response error: 500".
      const res = await this._hass.callService(
        "ar_smart_ir_builder", "learn_and_capture",
        { entry_id: entryId, device_key: key, command_name: cmdName, command_type: mode },
        undefined, false, true
      );
      this._setLearning(false);
      await this._load();
      this.qs("#ir-cmd").value = "";
      this._justLearned = cmdName;
      this._renderPills();
      const dup = res?.response?.duplicate_of;
      if (dup) {
        this._showLearnCallout(
          `⚠ "${cmdName}" learned (${mode.toUpperCase()}), but the signal is identical to "${dup}" — you may have pressed the same button twice.`,
          "warning"
        );
      } else {
        this._showLearnCallout(`✓ "${cmdName}" learned successfully (${mode.toUpperCase()}).`, "success");
      }
    }, () => {
      this._setLearning(false);
      this._showLearnCallout("", "");
    });
  }

  _setLearnMode(mode) {
    if (this._currentController() === "tasmota_mqtt") {
      // RF capture isn't supported through the Tasmota IRSend/IRRecv path,
      // so always pin to IR for this controller type.
      mode = "ir";
    }
    this._learnMode = mode === "rf" ? "rf" : "ir";
    const irBtn = this.qs("#ir-mode-ir");
    const rfBtn = this.qs("#ir-mode-rf");
    if (irBtn) irBtn.classList.toggle("active", this._learnMode === "ir");
    if (rfBtn) {
      rfBtn.classList.toggle("active", this._learnMode === "rf");
      const rfDisabled = this._currentController() === "tasmota_mqtt";
      rfBtn.disabled = rfDisabled;
      rfBtn.title = rfDisabled ? "RF capture is only available with a Broadlink controller" : "";
    }
    const hint = this.qs("#ir-mode-hint");
    if (hint) {
      if (this._currentController() === "tasmota_mqtt") {
        hint.textContent = "Infrared capture — press the button on your remote once when prompted. RF capture isn't supported on Tasmota IR controllers.";
      } else {
        hint.textContent = this._learnMode === "rf"
          ? "RF capture (e.g. 433 MHz gates, blinds). Two steps: press and hold a button so the Broadlink finds the frequency, then tap it once to capture. Needs RF-capable hardware (RM Pro / RM4 Pro)."
          : "Infrared capture — press the button on your remote once when prompted.";
      }
    }
  }

  _setLearning(on) {
    const btn = this.qs("#ir-learn-btn");
    btn.disabled = on;
    btn.classList.toggle("learning", on);
    btn.innerHTML = on ? `<span class="ir-spinner"></span>Learning…` : "Learn";

    // Listening-for-IR radar — visible only during an active capture.
    const radar = this.qs("#ir-radar");
    if (radar) {
      radar.style.display = on ? "flex" : "none";
      if (on) {
        // Restart the entrance animation each time capture begins.
        radar.style.animation = "none"; void radar.offsetWidth; radar.style.animation = "";
        const sub = this.qs("#ir-radar-sub");
        const isRf = this._learnMode === "rf";
        if (sub) {
          sub.textContent = isRf
            ? "Press and hold the RF button until capture completes."
            : "Point your remote at the receiver and press the button once.";
        }
        const title = radar.querySelector(".ir-radar-title");
        if (title) title.textContent = isRf ? "Listening for RF…" : "Listening for IR…";
      }
    }
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

  _isLikelyTasmotaIR(s) {
    if (typeof s !== "string") return false;
    let parsed;
    try { parsed = JSON.parse(s.trim()); } catch (e) { return false; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    // Decoded protocol form: {"Protocol":"NEC","Bits":32,"Data":"0x..."}
    if (typeof parsed.Protocol === "string" && ("Data" in parsed)) return true;
    return false;
  }

  _isValidCodeForCurrentController(s) {
    return this._currentController() === "tasmota_mqtt"
      ? this._isLikelyTasmotaIR(s)
      : this._isLikelyBase64(s);
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
    const hintEl = this.qs("#ir-paste-hint");
    const inputEl = this.qs("#ir-paste-input");
    if (this._currentController() === "tasmota_mqtt") {
      if (hintEl) hintEl.textContent = 'Paste Tasmota IRSend JSON, e.g. {"Protocol":"NEC","Bits":32,"Data":"0x20DF10EF"} — this is what Tasmota\'s console prints when it receives a signal.';
      if (inputEl) inputEl.placeholder = '{"Protocol":"NEC","Bits":32,"Data":"0x20DF10EF"}';
    } else {
      if (hintEl) hintEl.textContent = "Paste the Broadlink Base64 string (typically starts with JgB for IR or sgB for RF).";
      if (inputEl) inputEl.placeholder = "JgBQAAAB...";
    }
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
    if (!code) { this._showLearnCallout("Paste a code first.", "error"); return; }
    if (!this._isValidCodeForCurrentController(code)) {
      const msg = this._currentController() === "tasmota_mqtt"
        ? 'That doesn\'t look like valid Tasmota IRSend JSON, e.g. {"Protocol":"NEC","Bits":32,"Data":"0x20DF10EF"}.'
        : "That doesn't look like a valid Base64 code. Check for spaces, line breaks, or missing characters.";
      this._showLearnCallout(msg, "error");
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
      if (this._isValidCodeForCurrentController(code)) {
        valid[name] = code;
      } else {
        skipped.push(name);
      }
    }

    if (Object.keys(valid).length === 0) {
      feedback.style.color = "#c0392b";
      feedback.textContent = this._currentController() === "tasmota_mqtt"
        ? "No valid Tasmota IRSend JSON codes found in the input."
        : "No valid Base64 codes found in the input.";
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

  /**
   * Trigger the IR emitter burst on the virtual remote.
   *
   * Adds .firing to the emitter, which pulses the dot and sends three
   * staggered waves radiating outward. Self-clearing so it can retrigger on
   * rapid presses (each press restarts the burst rather than queueing).
   */
  _fireEmitter() {
    const emitter = this.qs("#ir-emitter");
    if (!emitter) return;
    emitter.classList.remove("firing");
    void emitter.offsetWidth; // reflow so the animation restarts every press
    emitter.classList.add("firing");
    clearTimeout(this._emitterTimer);
    this._emitterTimer = setTimeout(() => emitter.classList.remove("firing"), 800);
  }

  async _testCommandDirect(cmdName, btnEl) {
    const key = this._currentKey;
    const entryId = this.qs("#ir-entry").value;
    if (!key || !entryId || !cmdName) return;

    // Instant visual feedback — fire the moment the button is tapped, not after
    // the round-trip. This is the reaction the remote was missing: the button
    // reacts and the emitter blasts IR waves right away, so the remote feels
    // alive even while the actual send is still in flight.
    if (btnEl) this._anim(btnEl, "pressing");
    this._fireEmitter();

    const strip = this.qs("#ir-test-strip");
    try {
      if (btnEl) { btnEl.classList.add("testing"); btnEl.disabled = true; }
      if (strip) { strip.className = "ir-test-strip"; strip.textContent = `Sending "${cmdName}"…`; }

      const res = await this._hass.callService(
        "ar_smart_ir_builder", "test_command",
        { entry_id: entryId, device_key: key, command_name: cmdName },
        undefined, false, true
      );

      const r = res?.response || {};
      const isRf = typeof r.code_type === "string" && r.code_type.startsWith("rf");
      const repeats = r.repeats || 1;
      let okMsg = `✓ "${cmdName}" sent`;
      if (isRf) okMsg += ` (RF${repeats > 1 ? ` ×${repeats}` : ""})`;
      else if (repeats > 1) okMsg += ` (×${repeats})`;
      if (isRf && repeats === 1) {
        okMsg += ` — RF devices (blinds, screens, gates) often ignore a single burst. If nothing moved, set a repeat policy for "${cmdName}" in Repeat settings (e.g. ×3, 300ms) and test again.`;
      }

      if (btnEl) { btnEl.classList.remove("testing"); btnEl.classList.add("sent"); btnEl.disabled = false; setTimeout(() => btnEl?.classList.remove("sent"), 1200); }
      if (strip) { strip.className = "ir-test-strip ok"; strip.textContent = okMsg; }
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
      const res = await this._hass.callService(
        "ar_smart_ir_builder", "export_device", { device_key: key },
        undefined, true, true
      );
      const r = (res && res.response) || {};
      if (r.code) {
        const label = r.platform_label || r.platform;
        const man = r.manufacturer || "Unknown";
        this._showCallout(
          `✓ Exported. In ar_smart_ir: Add device → choose "${label}" → ` +
          `manufacturer "${man}" → code ${r.code}. ` +
          `Edit codes only at ${r.path} — the download is a copy, not the live file.`,
          "success"
        );
        const notes = r.report && r.report.notes;
        if (notes && notes.length) {
          this._showCallout(notes.join(" "), "warning");
        }
        // Download the copy only when the user asks for it — auto-opening it is
        // what led people to edit the wrong (copy) file.
        this._offerDownload(r.download_url || `/local/ar_smart_ir_exports/${key}.json`);
      } else {
        this._showCallout(`SmartIR JSON exported → /local/ar_smart_ir_exports/${key}.json`, "success");
        this._offerDownload(`/local/ar_smart_ir_exports/${key}.json`);
      }
    });
  }

  _offerDownload(url) {
    const a = this.qs("#ir-smartir-download");
    if (!a) return;
    a.href = url;
    a.style.display = "inline-flex";
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
    const rawType = device?.device_type || this.qs("#ir-type")?.value || "climate";
    const type = this._effectiveType(rawType, device?.climate_style);
    const commands = device?.commands || {};
    const presetId = device?.preset || this._currentPresetId();
    const layout = this._layoutFor(type, presetId) || this._layoutFor(rawType, presetId) || REMOTE_LAYOUTS.tv;
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
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "ir-btn ir-btn-ghost ir-btn-sm";
      delBtn.textContent = "\u2715";
      delBtn.title = `Delete "${cmd}" so it can be re-learned`;
      delBtn.style.flexShrink = "0";
      let armed = false, disarmTimer = null;
      const disarm = () => {
        armed = false;
        delBtn.className = "ir-btn ir-btn-ghost ir-btn-sm";
        delBtn.textContent = "\u2715";
      };
      delBtn.onclick = async () => {
        if (!armed) {
          // Two-tap confirm: first tap arms, second tap within 3s deletes.
          armed = true;
          delBtn.className = "ir-btn ir-btn-danger ir-btn-sm";
          delBtn.textContent = "Delete?";
          disarmTimer = setTimeout(disarm, 3000);
          return;
        }
        clearTimeout(disarmTimer);
        delBtn.disabled = true;
        delBtn.textContent = "Deleting\u2026";
        const strip = this.qs("#ir-test-strip");
        try {
          await this._hass.callService("ar_smart_ir_builder", "delete_command", {
            device_key: this._currentKey,
            command_name: cmd,
            entry_id: this.qs("#ir-entry").value || undefined,
          });
          await this._load();
          this._refreshDerivedUI();
          if (strip) { strip.className = "ir-test-strip ok"; strip.textContent = `\u2713 "${cmd}" deleted \u2014 re-learn it under the same name in step 3.`; }
        } catch (err) {
          const msg = err?.body?.message || err?.message || (typeof err === "string" ? err : "Delete failed");
          delBtn.disabled = false;
          disarm();
          if (strip) { strip.className = "ir-test-strip err"; strip.textContent = `\u2717 ${msg}`; }
        }
      };
      row.appendChild(info);
      row.appendChild(testBtn);
      row.appendChild(delBtn);
      container.appendChild(row);
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  _refreshDerivedUI() {
    this._setLearnMode(this._learnMode || "ir");
    this._typeHint();
    if (this._step === 2) this._renderPreviewRemote();
    if (this._step === 3) { this._renderPills(); this._renderRepeatEditor(); }
    if (this._step === 4) this._renderTestRemote();
    if (this._step === 5) { this._renderChecklist(); this._renderRaw(); }
  }

  _currentCommands() {
    return Object.keys(this._data.store?.devices?.[this._currentKey]?.commands || {});
  }

  // ── Motion ────────────────────────────────────────────────────────────────

  /**
   * Resolve the motion preference and stamp it on the wrap as [data-motion].
   *
   * This exists because `@media (prefers-reduced-motion: reduce)` is a
   * one-way door: the page can read it but can't opt out of it. Android turns
   * it on for the entire WebView whenever battery saver or Settings →
   * Accessibility → "Remove animations" is active, and the HA companion app
   * inherits that. The result was the whole animation pack quietly collapsing
   * into 200ms fades on every HA instance the user opened — which reads as
   * "the animations don't work" rather than "your phone asked for less
   * motion", and there was no way to argue with it. Now Auto still honours
   * the OS, but Full overrides it.
   */
  _applyMotionPref() {
    const wrap = this.qs("#ir-wrap");
    if (!wrap) return;
    const osReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pref = this._motionPref || "auto";
    const effective =
      pref === "full" ? "full" :
      pref === "reduced" ? "reduced" :
      (osReduced ? "reduced" : "full");
    wrap.dataset.motion = effective;

    const state = this.qs("#ir-motion-state");
    if (state) {
      state.textContent =
        `build ${PANEL_BUILD} · device asks for ${osReduced ? "reduced" : "full"} motion · using ${effective}`;
    }
    const sel = this.qs("#ir-motion");
    if (sel && sel.value !== pref) sel.value = pref;
  }

  _setMotionPref(pref) {
    this._motionPref = ["auto", "full", "reduced"].includes(pref) ? pref : "auto";
    try { localStorage.setItem(MOTION_PREF_KEY, this._motionPref); } catch (e) { /* private mode */ }
    this._applyMotionPref();
  }

  _loadMotionPref() {
    let stored = "auto";
    try { stored = localStorage.getItem(MOTION_PREF_KEY) || "auto"; } catch (e) { /* private mode */ }
    this._motionPref = ["auto", "full", "reduced"].includes(stored) ? stored : "auto";
  }

  /**
   * Fire an unmissable looping bar plus the real pack.
   *
   * The bar exists because the pack itself is a bad test instrument — every
   * animation in it is 220-600ms and deliberately subtle, so "no animations"
   * and "animations I didn't notice" look identical. The bar loops for 5s,
   * travels the width, and cycles colours — and even at rest it shows a static
   * coloured block, so "no bar at all" vs "bar present but not moving" are
   * themselves distinguishable.
   */
  _testMotion() {
    const bar = this.qs("#ir-selftest");
    if (bar) {
      bar.classList.remove("running");
      void bar.offsetWidth;
      bar.classList.add("running");
      setTimeout(() => bar.classList.remove("running"), 5200);
    }

    const panel = this.qs(".ir-panel.active");
    if (panel) this._anim(panel, "active");
    this._showCallout("Motion test running for 5s. Watch the bar just below this row: a coloured block should slide left↔right and change colour. If you see a static coloured block that never moves, animations are disabled somewhere; if you see no block at all, tell me that specifically.", "info");
    const fill = this.qs("#ir-cov-fill");
    if (fill) { this._anim(fill, "filling"); setTimeout(() => fill.classList.remove("filling"), 900); }
    this.querySelectorAll(".ir-rise").forEach(el => this._anim(el, "ir-rise"));
    this.querySelectorAll(".ir-pill").forEach((el, i) => {
      if (i < 6) setTimeout(() => this._anim(el, "just-learned"), i * 60);
    });
    const learn = this.qs("#ir-learn-btn");
    if (learn) {
      learn.classList.add("learning");
      setTimeout(() => learn.classList.remove("learning"), 3000);
    }
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  /**
   * Probe what is actually happening, rather than guessing.
   *
   * Each probe isolates one link in the chain, and they're ordered so the
   * first failure is the cause:
   *
   *   build       — is this even the new panel.js, or a cached old one?
   *   style/sheet — did the <style> in innerHTML get parsed at all?
   *   keyframes   — are the @keyframes rules reachable from that sheet?
   *   scope       — can the animated element see them (shadow tree scope)?
   *   match       — does the selector win? (animation-name !== "none")
   *   object      — did the browser create an Animation? (getAnimations())
   *   progress    — does currentTime actually advance? (frozen vs running)
   *
   * animation-name "none" means CSS lost — a theme, card-mod, or a browser
   * extension is overriding it. A live Animation whose currentTime never
   * moves means the browser is running it at zero speed, which is what
   * Android's animator scale / WebView throttling does.
   */
  async _diagnose() {
    const box = this.qs("#ir-diag");
    const out = this.qs("#ir-diag-out");
    const verdict = this.qs("#ir-diag-verdict");
    if (!box || !out) return;
    box.classList.add("show");
    out.textContent = "Running probes…";

    const L = [];
    const add = (k, v) => L.push(`${String(k).padEnd(26)} ${v}`);
    const problems = [];

    // ── build identity
    const headerVer = this.qs(".ir-version")?.textContent || "?";
    add("panel build", PANEL_BUILD);
    add("header version", headerVer);
    const scripts = [...document.querySelectorAll("script")]
      .map(x => x.src).filter(x => x && x.includes("ar_smart_ir_builder"));
    add("script url", scripts.join(", ") || "(not a document-level <script>)");
    if (PANEL_BUILD !== "2.4.0") problems.push("Stale panel.js is loaded.");

    // ── motion preference
    const osReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    add("prefers-reduced-motion", osReduced ? "REDUCE" : "no-preference");
    add("motion pref", this._motionPref || "auto");
    add("data-motion", this.qs("#ir-wrap")?.dataset.motion || "(unset)");

    // ── did the stylesheet parse?
    const styleEl = this.querySelector("style");
    add("<style> element", styleEl ? "present" : "MISSING");
    let sheet = null;
    try { sheet = styleEl && styleEl.sheet; } catch (e) { /* noop */ }
    add("style.sheet", sheet ? "attached" : "NULL");
    if (styleEl && !sheet) problems.push("The panel's <style> never became a stylesheet.");

    if (sheet) {
      try { add("panel css rules", [...sheet.cssRules].length); }
      catch (e) { add("panel css rules", "threw: " + e.message); }
    }

    // Keyframes now live inside the panel's own <style> (see the note above
    // _render), so they're guaranteed same-scope. Verify they're actually in
    // a stylesheet the panel can read — scan every <style> the panel owns.
    let kfNames = [];
    let kfFound = false;
    this.querySelectorAll("style").forEach(st => {
      if (!st.sheet) return;
      try {
        [...st.sheet.cssRules].forEach(r => {
          if (r.type === 7 /* KEYFRAMES_RULE */) { kfNames.push(r.name); kfFound = true; }
        });
      } catch (e) { /* read guard */ }
    });
    add("keyframes location", kfFound ? "inside panel <style> (same scope)" : "NOT FOUND in panel");
    add("@keyframes reachable", kfNames.length ? `${kfNames.length} (${kfNames.join(", ")})` : "0");
    if (!kfFound) {
      problems.push("No @keyframes found in the panel's own stylesheets — the inline keyframes block didn't parse.");
    }

    // ── tree scope: can the element see its own keyframes?
    const root = this.getRootNode();
    const scope = root === document
      ? "document"
      : (root.host ? `shadow root of <${root.host.localName}>` : "detached");
    add("panel tree scope", scope);
    add("style same scope", styleEl && styleEl.getRootNode() === root ? "yes" : "NO");
    if (styleEl && styleEl.getRootNode() !== root) {
      problems.push("The <style> and the panel are in different tree scopes — keyframes can't resolve.");
    }

    // ── does the CSS actually match, and does an Animation get created?
    const probe = document.createElement("div");
    probe.className = "ir-rise";
    probe.style.cssText = "position:absolute;left:-9999px;top:0;width:10px;height:10px";
    this.appendChild(probe);
    await new Promise(r => requestAnimationFrame(r));

    const cs = getComputedStyle(probe);
    add("probe animation-name", cs.animationName);
    add("probe animation-duration", cs.animationDuration);
    add("probe animation-play-state", cs.animationPlayState);
    if (cs.animationName === "none") {
      problems.push("CSS matched nothing: animation-name resolves to \"none\". Something is overriding it (theme, card-mod, or an extension).");
    }
    if (cs.animationDuration === "0s") {
      problems.push("animation-duration is 0s — animations are being zeroed out.");
    }

    const anims = probe.getAnimations ? probe.getAnimations() : [];
    add("probe getAnimations()", anims.length);
    if (cs.animationName !== "none" && anims.length === 0) {
      problems.push("CSS resolved but the browser created no Animation object.");
    }

    if (anims.length) {
      add("probe playState", anims[0].playState);
      const t0 = Number(anims[0].currentTime) || 0;
      await new Promise(r => setTimeout(r, 150));
      const t1 = Number(anims[0].currentTime) || 0;
      add("probe currentTime t0", Math.round(t0) + "ms");
      add("probe currentTime +150ms", Math.round(t1) + "ms");
      if (t1 <= t0) {
        problems.push("The animation exists but its clock is frozen — the browser is running animations at zero speed.");
      }
    }
    probe.remove();

    // ── Rendered-pixel probe ─────────────────────────────────────────────
    // getAnimations() says the animation runs, but "I see nothing" means the
    // question is whether it changes visible pixels. ir-rise animates opacity
    // 0→1 and translateY 10px→0. Sample the *computed* opacity/transform of a
    // fresh, on-screen probe at the start and after a beat. If these numbers
    // don't move, the browser is compositing past the animation (a paint /
    // will-change / accelerated-layer issue), which is a different failure
    // from "no animation object" and needs a different fix.
    const vprobe = document.createElement("div");
    vprobe.className = "ir-rise";
    // On-screen but harmless: 1px, pinned top-left under everything.
    vprobe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;z-index:-1;pointer-events:none";
    this.appendChild(vprobe);
    // Restart the animation cleanly.
    vprobe.style.animation = "none"; void vprobe.offsetWidth; vprobe.style.animation = "";
    await new Promise(r => requestAnimationFrame(r));
    const s0 = getComputedStyle(vprobe);
    const op0 = s0.opacity, tf0 = s0.transform;
    await new Promise(r => setTimeout(r, 120));
    const s1 = getComputedStyle(vprobe);
    const op1 = s1.opacity, tf1 = s1.transform;
    add("probe opacity start→120ms", `${op0} → ${op1}`);
    add("probe transform start→120ms", `${tf0} → ${tf1}`);
    const opacityMoved = op0 !== op1;
    const transformMoved = tf0 !== tf1;
    add("rendered values changing", (opacityMoved || transformMoved) ? "YES" : "NO");
    vprobe.remove();
    if (anims.length && !opacityMoved && !transformMoved) {
      problems.push("The animation object runs and its clock advances, but the element's computed opacity and transform never change. The browser is painting the final frame directly and skipping the interpolation — this is a rendering/compositing issue (GPU layer, will-change, or a forced-final-frame), not a CSS-scope or keyframe issue.");
    }

    // ── environment
    add("document.getAnimations()", document.getAnimations ? document.getAnimations().length : "unsupported");
    add("devicePixelRatio", window.devicePixelRatio);
    add("viewport", `${window.innerWidth}x${window.innerHeight}`);
    add("userAgent", navigator.userAgent);

    out.textContent = L.join("\n");
    this._diagReport = L.join("\n") + "\n\nVERDICT:\n" +
      (problems.length ? problems.map(x => "- " + x).join("\n") : "- No fault found in the CSS chain.");

    if (problems.length) {
      verdict.className = "ir-diag-verdict bad";
      verdict.textContent = problems.join(" ");
    } else {
      verdict.className = "ir-diag-verdict good";
      verdict.textContent =
        "Every link in the chain checks out: the stylesheet parsed, the keyframes are reachable, the selector matched, and the animation clock is advancing. If you still can't see anything, the animations are running but too subtle to notice — hit Test and watch the coloured bar.";
    }
  }

  async _copyDiag() {
    const text = this._diagReport || this.qs("#ir-diag-out")?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      this._showCallout("Diagnostics copied to clipboard.", "success");
    } catch (e) {
      // Clipboard API needs a secure context; plain-http HA instances don't
      // have one. Select the text instead so a long-press copy works.
      const pre = this.qs("#ir-diag-out");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      this._showCallout("Clipboard blocked (needs HTTPS) — the report is selected, copy it manually.", "warning");
    }
  }

  // ── Presets ───────────────────────────────────────────────────────────────

  _currentPresetId() { return this.qs("#ir-preset")?.value || "generic"; }

  _currentPreset() {
    const type = this.qs("#ir-type")?.value || "climate";
    return findPreset(type, this._currentPresetId());
  }

  /** Rebuild the preset dropdown for the selected type. Hides itself when the type has none. */
  _renderPresetSelect(selectedId) {
    const type = this.qs("#ir-type")?.value || "climate";
    const field = this.qs("#ir-preset-field");
    const sel = this.qs("#ir-preset");
    if (!field || !sel) return;
    const list = presetsFor(type);
    if (!list) { field.style.display = "none"; sel.innerHTML = ""; return; }
    field.style.display = "";
    sel.innerHTML = "";
    list.forEach(pr => {
      const o = document.createElement("option");
      o.value = pr.id;
      o.textContent = pr.label;
      sel.appendChild(o);
    });
    sel.value = list.some(pr => pr.id === selectedId) ? selectedId : "generic";
    this._renderPresetNote();
  }

  _renderPresetNote() {
    const el = this.qs("#ir-preset-note");
    if (!el) return;
    const preset = this._currentPreset();
    if (!preset || !preset.note) { el.style.display = "none"; el.textContent = ""; return; }
    el.textContent = preset.note;
    el.style.display = "block";
    this._anim(el, "ir-anim-in");
  }

  /** Auto-fill Manufacturer from the preset, but never clobber something typed. */
  _applyPresetManufacturer() {
    const preset = this._currentPreset();
    const field = this.qs("#ir-manufacturer");
    if (!preset || !field || !preset.manufacturer) return;
    const current = field.value.trim();
    const known = (presetsFor(this.qs("#ir-type")?.value) || []).map(pr => pr.manufacturer).filter(Boolean);
    if (!current || known.includes(current)) field.value = preset.manufacturer;
  }

  _typeHint() {
    const type = this.qs("#ir-type")?.value || "climate";
    const el = this.qs("#ir-type-hint");
    if (!el) return;
    const hints = {
      projector: "Creates a media_player entity. Exports to codes/media_player.",
      receiver: "Creates a media_player entity. Exports to codes/media_player.",
      soundbar: "Creates a media_player entity. Exports to codes/media_player.",
      decoder: "Creates a media_player entity. Exports to codes/media_player.",
      tv: "Creates a media_player entity. Exports to codes/media_player.",
      media_player: "Creates a media_player entity. Exports to codes/media_player.",
      climate: "Creates a climate entity. Exports to codes/climate.",
      fan: "Creates a fan entity. Exports to codes/fan.",
      custom: "Creates no entity and can't be exported as a codeset — use \"Export HA scripts\" and wrap them yourself.",
    };
    el.textContent = hints[type] || "";
  }

  // ── Remote preview ────────────────────────────────────────────────────────

  /** Layout for a type, honouring a preset override. */
  _layoutFor(type, presetId) {
    const preset = presetId ? findPreset(type, presetId) : null;
    if (preset && preset.layout) return preset.layout;
    return REMOTE_LAYOUTS[type] || null;
  }

  /**
   * Render the step-2 preview: what this remote is expected to look like, and
   * which of those buttons are already captured. Non-interactive by design —
   * nothing here can fire IR, because at this point the profile may not even
   * be saved yet.
   */
  _renderPreviewRemote() {
    const card = this.qs("#ir-preview-card");
    const body = this.qs("#ir-preview-remote");
    if (!card || !body) return;

    const rawType = this.qs("#ir-type")?.value || "climate";
    const type = this._effectiveType(rawType);
    const presetId = this._currentPresetId();
    const preset = this._currentPreset();
    const layout = this._layoutFor(type, presetId) || this._layoutFor(rawType, presetId);
    const learned = new Set(this._currentCommands());

    const sub = this.qs("#ir-preview-sub");
    if (sub) {
      const bits = [TYPE_LABELS[rawType] || rawType];
      if (preset && preset.id !== "generic") bits.push(preset.label);
      sub.textContent = bits.join(" · ");
    }

    body.innerHTML = "";
    if (!layout) {
      body.innerHTML = `<p style="font-size:12px;color:var(--secondary-text-color);text-align:center">No preview layout for this type — the checklist in step 3 is still your guide.</p>`;
    } else {
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
          ].forEach(d => dpad.appendChild(this._makePreviewBtn(d, learned, d.cls)));
          body.appendChild(dpad);
        } else {
          const row = document.createElement("div");
          row.className = "ir-remote-row";
          section.btns.forEach(b => row.appendChild(this._makePreviewBtn(b, learned)));
          body.appendChild(row);
        }
      });
    }

    // Counts are against the *checklist*, not the layout — the layout is a
    // subset chosen for legibility, the checklist is what you're asked for.
    const rec = this._allRecommended();
    const done = rec.filter(c => learned.has(c)).length;
    const count = this.qs("#ir-preview-count");
    if (count) {
      count.textContent = this._currentKey
        ? `${done} of ${rec.length} commands learned`
        : `${rec.length} commands in this template`;
    }
  }

  _makePreviewBtn(def, learnedSet, extraCls = "") {
    const { cmd, icon, label, cls: defCls = "" } = def;
    const has = learnedSet.has(cmd);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.disabled = true;
    btn.className = `ir-rbtn ${defCls} ${extraCls} ${has ? "done" : "todo"}`.trim();
    btn.title = `${cmd} — ${COMMAND_HINTS[cmd] || "custom command"}${has ? " (learned)" : ""}`;
    btn.innerHTML = `<span>${icon}</span><span class="ir-rbtn-label">${label || cmd}</span>`;
    return btn;
  }

  _effectiveType(type, style) {
    const t = type ?? this.qs("#ir-type")?.value ?? "climate";
    const s = style ?? this.qs("#ir-climate-style")?.value ?? "absolute";
    return (t === "climate" && s === "relative") ? "climate_relative" : t;
  }

  _recommendedGroups() {
    const rawType = this.qs("#ir-type")?.value || "climate";
    const preset = this._currentPreset();
    // A preset's groups win over the type default — that's the whole point of
    // picking "Optoma" over "Generic projector".
    if (preset && preset.groups) return preset.groups;
    const type = this._effectiveType();
    return RECOMMENDED[type] || RECOMMENDED[rawType] || RECOMMENDED.climate;
  }

  _toggleClimateStyleField() {
    const field = this.qs("#ir-climate-style-field");
    if (field) field.style.display = this.qs("#ir-type")?.value === "climate" ? "" : "none";
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
        pill.className = "ir-pill" + (learned.has(cmd) ? " learned" : "")
          + (cmd === this._justLearned ? " just-learned" : "");
        pill.textContent = cmd;
        pill.title = COMMAND_HINTS[cmd] || cmd;
        pill.onclick = () => { this.qs("#ir-cmd").value = cmd; this.qs("#ir-cmd").focus(); };
        row.appendChild(pill);
      });
      container.appendChild(section);
    });
    this._justLearned = null;
    this._updateStats(learned);

    const dl = this.qs("#ir-cmd-list");
    dl.innerHTML = "";
    new Set([...this._allRecommended(), ...Object.keys(COMMAND_HINTS), ...this._currentCommands()])
      .forEach(v => { const o = document.createElement("option"); o.value = v; dl.appendChild(o); });

    // Keep the Repeat / Retry editor in sync with the current command list.
    this._renderRepeatEditor();
  }

  /**
   * Tween a number in an element from its current value to `to`.
   *
   * Used for the coverage stats so the count climbs as commands are learned
   * rather than snapping. Cheap: rAF-driven, ~450ms, eases out. Cancels any
   * in-flight tween on the same element so rapid learns don't stack.
   */
  _countUp(node, to, opts = {}) {
    if (!node) return;
    const dur = opts.dur || 450;
    const suffix = opts.suffix || "";
    const from = parseInt(node.dataset.countVal || node.textContent, 10);
    const start = Number.isFinite(from) ? from : to;
    if (start === to) { node.textContent = to + suffix; node.dataset.countVal = to; return; }
    if (node._countRAF) cancelAnimationFrame(node._countRAF);
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = Math.round(start + (to - start) * eased);
      node.textContent = val + suffix;
      if (p < 1) { node._countRAF = requestAnimationFrame(tick); }
      else { node.dataset.countVal = to; node._countRAF = null; }
    };
    node._countRAF = requestAnimationFrame(tick);
  }

  _updateStats(learnedSet) {
    const learned = learnedSet || new Set(this._currentCommands());
    const rec = this._allRecommended();
    const covered = rec.filter(c => learned.has(c)).length;
    const pct = rec.length ? Math.round(covered / rec.length * 100) : 0;
    const el = n => this.qs(n);
    // Count-up instead of snap, so the numbers climb as you learn.
    if (el("#ir-stat-learned")) this._countUp(el("#ir-stat-learned"), learned.size);
    if (el("#ir-stat-cov")) {
      // "covered / total" — tween only the covered part; total is fixed.
      const node = el("#ir-stat-cov");
      const total = rec.length;
      const from = parseInt(node.dataset.countVal || covered, 10);
      const start = Number.isFinite(from) ? from : covered;
      if (node._countRAF) cancelAnimationFrame(node._countRAF);
      if (start === covered) {
        node.textContent = `${covered} / ${total}`;
        node.dataset.countVal = covered;
      } else {
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / 450);
          const eased = 1 - Math.pow(1 - p, 3);
          const v = Math.round(start + (covered - start) * eased);
          node.textContent = `${v} / ${total}`;
          if (p < 1) node._countRAF = requestAnimationFrame(tick);
          else { node.dataset.countVal = covered; node._countRAF = null; }
        };
        node._countRAF = requestAnimationFrame(tick);
      }
    }
    if (el("#ir-stat-name")) el("#ir-stat-name").textContent =
      this.qs("#ir-name")?.value || humanize(this._currentKey) || "—";
    const fill = el("#ir-cov-fill");
    if (fill) {
      if (fill.dataset.pct !== String(pct)) {
        const prev = parseInt(fill.dataset.pct || "0", 10);
        fill.dataset.pct = String(pct);
        // Bump = coverage went up: celebrate with the shimmer sweep.
        // Drop (deleted a command) = just glide, no sweep.
        if (pct > prev) {
          this._anim(fill, "filling");
          setTimeout(() => fill.classList.remove("filling"), 900);
        }
      }
      fill.style.width = pct + "%";
    }
  }

  _renderChecklist() {
    const container = this.qs("#ir-checklist");
    if (!container) return;
    const learned = new Set(this._currentCommands());
    container.innerHTML = "";
    this._allRecommended().forEach((cmd, idx) => {
      const done = learned.has(cmd);
      const item = document.createElement("div");
      item.className = "ir-cl-item ir-rise" + (done ? " learned" : "");
      item.style.setProperty("--i", idx);
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
    this._anim(el, type === "error" ? "ir-anim-shake" : "ir-anim-in");
  }
  _hideCallout() {
    const el = this.qs("#ir-callout");
    if (el) el.className = "ir-callout";
  }
  _showLearnCallout(msg, type) {
    const el = this.qs("#ir-learn-callout");
    if (!el) return;
    if (!msg) { el.style.display = "none"; el.className = "ir-callout"; return; }
    el.textContent = msg;
    el.className = `ir-callout ${type}` + (type === "learning" ? " ir-learning-pulse" : "");
    el.style.display = "block";
    this._anim(el, type === "error" ? "ir-anim-shake" : "ir-anim-in");
  }

  // ── Run wrapper ───────────────────────────────────────────────────────────

  _errText(err) {
    if (err == null) return "Unknown error";
    if (typeof err === "string") return err;
    const cands = [
      err.body && err.body.message,
      err.message,
      err.body && err.body.error,
      typeof err.error === "string" ? err.error : null,
      typeof err.body === "string" ? err.body : null,
      err.status_code ? `Request failed (HTTP ${err.status_code})` : null,
    ];
    for (const c of cands) {
      if (typeof c === "string" && c && c !== "[object Object]") return c;
    }
    try {
      const s = JSON.stringify(err);
      if (s && s !== "{}") return s;
    } catch (_) {}
    return String(err);
  }

  async _run(fn, onError) {
    if (this._busy) return;
    this._busy = true;
    this._setBusy(true);
    try {
      await fn();
    } catch (err) {
      this._showCallout(`Error: ${this._errText(err)}`, "error");
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
    this.qs("#ir-delete-entry-name").textContent = entry ? this._entryLabel(entry) : entryId;
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

  /**
   * Re-trigger a CSS animation class on an element that may already carry it.
   * Removing the class, forcing a reflow, then re-adding is the only reliable
   * way to restart a keyframe animation on an element that never left the DOM.
   */
  _anim(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
}

if (!customElements.get("ar-smart-ir-panel")) {
  customElements.define("ar-smart-ir-panel", ARSmartIRPanel);

  // Diagnostic. If the animations ever look absent, this answers both questions
  // at once: which panel build is actually loaded (stale JS?), and whether the
  // OS has asked us to cut the motion.
  console.info(
    "[ar_smart_ir_builder] panel build %s | reduced-motion: %s",
    document.querySelector(".ir-version")?.textContent || "unknown",
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "ON (animations degraded to fades)" : "off"
  );
}
