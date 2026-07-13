# 🚀 AR Smart IR Builder

[![GitHub release](https://img.shields.io/github/v/release/marsh4200/ar_smart_ir_builder.svg)](https://github.com/marsh4200/ar_smart_ir_builder/releases)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-blue.svg)](https://www.home-assistant.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Top Language](https://img.shields.io/github/languages/top/marsh4200/ar_smart_ir_builder)](https://github.com/marsh4200/ar_smart_ir_builder)
[![Languages Count](https://img.shields.io/github/languages/count/marsh4200/ar_smart_ir_builder)](https://github.com/marsh4200/ar_smart_ir_builder)

---

## 📲 Quick Install (HACS)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=marsh4200&repository=ar_smart_ir_builder&category=integration)

---

## ✨ Overview

**AR Smart IR Builder** is a powerful Home Assistant integration that allows you to:

- Learn IR / RF commands from Broadlink devices, or IR commands from Tasmota IR blasters over MQTT
- Build full device profiles (TV, Aircon, Fan, Media, Custom)
- Automatically generate Home Assistant entities
- Export to SmartIR-compatible format
- Manage everything 100% from the UI (no YAML)

---

## 🔥 Features

### 🎯 UI First Setup
- Fully Config Flow based
- No YAML required
- Easy integration via Devices & Services
- Pick your controller type during setup: **Broadlink** (remote entity) or **Tasmota IR** (MQTT)

### 📡 IR Learning Engine
- Learn IR commands in real time
- Broadlink supported capture
- Tasmota IR supported capture (over MQTT, no Broadlink hardware required)
- Test commands instantly

### 🧠 Smart Device Builder
Create structured device profiles:
- ❄️ Aircons (Climate)
- 📺 TVs (Media Player)
- 🌬️ Fans
- 🔊 Audio / Custom IR devices

### ⚡ Auto Entity Creation
Automatically generates:
- `climate.*`
- `media_player.*`
- `fan.*`

### 💾 SmartIR Export Support
Export working IR configs to:
```
/config/www/ar_smart_ir_exports/
```

---

## 🖼️ Screenshots

### 📌 Integration Setup
![Setup](https://github.com/marsh4200/ar_smart_ir_builder/blob/main/images/arbuilder1.png)

### 📌 Sidebar Tool
![Sidebar](https://github.com/marsh4200/ar_smart_ir_builder/blob/main/images/arbuilder2.png)

### 📌 Device Builder
![Builder](https://github.com/marsh4200/ar_smart_ir_builder/blob/main/images/arbuilder3.png)

### 📌 IR Learning
![Learning](https://github.com/marsh4200/ar_smart_ir_builder/blob/main/images/arbuilder4.png)

![Learning](https://github.com/marsh4200/ar_smart_ir_builder/blob/main/images/arbuilder5.png)

---

## ⚙️ Installation

### 1. Install via HACS
- Open **HACS**
- Go to **Integrations**
- Add repository:
```
https://github.com/marsh4200/ar_smart_ir_builder
```
- Install **AR Smart IR Builder**

---

### 2. Restart Home Assistant

---

### 3. Add Integration
Go to:
```
Settings → Devices & Services → Add Integration
```

Search:
```
AR Smart IR Builder
```

During setup you'll be asked to pick a **Controller type**:

---

## 📶 Controller Types

### Broadlink
The original mode. Pick a `remote.*` entity from the Broadlink integration. Sending uses `remote.send_command` with a base64 code; learning uses `remote.learn_command`.

### Tasmota IR (MQTT) — for areas where Broadlink hardware is hard to source
Talks straight to a Tasmota IR blaster over MQTT, no `remote.*` entity needed.

**Requirements:**
- A Tasmota device flashed with IR support (most ESP8266/ESP32-based IR blasters), with its **Topic** set under *Configuration → MQTT*
- HA's built-in **MQTT integration** configured and pointed at the same broker your Tasmota device uses
- For learning: IR receive enabled on the device (`SetOption58 1` on the Tasmota console if it's an unusual/AC protocol Tasmota can't natively decode, so it still returns raw timing data instead of nothing)

**How it works:**
- *Send*: publishes Tasmota's `IRSend` JSON (e.g. `{"Protocol":"NEC","Bits":32,"Data":"0x20DF10EF"}`) to `cmnd/<topic>/irsend`
- *Learn*: subscribes to `tele/<topic>/RESULT`, waits up to 25s (configurable) for the next IR signal the device receives, and stores it ready to replay
- *Paste code*: paste Tasmota IRSend JSON directly (e.g. copied straight out of the Tasmota console log) instead of capturing
- RF capture, available on Broadlink, isn't supported through this path — Tasmota IR is IR-only here

**Known limitation:** protocols Tasmota can't decode (common on some AC remotes) fall back to raw timing arrays, the same rough edge Broadlink has with exotic remotes — you may need to re-learn a couple of times to get a clean capture.

---

## 🧭 How to Use

### Step 1 — Open Sidebar
After installation, open:

👉 **AR Smart IR Builder (Sidebar Menu)**

---

### Step 2 — Create Profile
- Click **New Profile**
- Enter:
  - Name
  - Manufacturer
  - Model
  - Type:
    - Aircon
    - TV
    - Fan
    - Media Player

---

### Step 3 — Learn Commands
- Click **Learn Command**
- Point remote at Broadlink
- Capture commands like:
  - Power
  - Volume
  - Input / HDMI
  - Temperature
  - Fan speed

---

### Step 4 — Save Device
- Click **Save Device**
- Entities are created automatically

---

### Step 5 — View in Home Assistant
Check:
- Developer Tools → States
- Devices & Services

---

## 🧠 Command Naming

### Media
```
power
volume_up
volume_down
play
pause
source_hdmi1
```

### Aircon
```
cool_24
heat_22
fan_auto
off
```

### Fan
```
fan_low
fan_medium
fan_high
```

---

## 💾 Export

Export location:
```
/config/www/ar_smart_ir_exports/
```

---

## 🗑️ Delete Profile

To remove a profile:

1. Open sidebar
2. Select profile
3. Scroll to Export section
4. Click **Delete Profile**
5. Confirm

✔ Removes from integration completely

---

## 🔌 Services

- learn_and_capture
- save_device
- export_device
- export_ha_scripts
- test_command
- delete_device

---

## 👨‍💻 Credits

Built by **AR Smart Home**

---

## ⚠️ Notes

This project is actively developed. Features may evolve as new hardware is tested.

Tasmota IR (MQTT) controller support was added without access to physical Tasmota hardware to test against — the MQTT topics and IRSend/IrReceived payload shapes follow Tasmota's documented behaviour, but if your device's topic naming or firmware version diverges, you may need to adjust `mqtt_controller.py`. Report back what breaks.
