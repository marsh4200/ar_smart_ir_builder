# 🚀 AR Smart IR Builder

[![GitHub release](https://img.shields.io/github/v/release/marsh4200/ar_smart_ir_builder.svg)](https://github.com/marsh4200/ar_smart_ir_builder/releases)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Integration-blue.svg)](https://www.home-assistant.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Java](https://img.shields.io/badge/Java-17-007396?logo=openjdk&logoColor=white)](https://www.java.com/)

---

## 📲 Quick Install (HACS)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=marsh4200&repository=ar_smart_ir_builder&category=integration)

---

## ✨ Overview

**AR Smart IR Builder** is a powerful Home Assistant integration that allows you to:

- Learn IR / RF commands directly from Broadlink devices
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

### 📡 IR Learning Engine
- Learn IR commands in real time
- Broadlink supported capture
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

---

## 👨‍💻 Credits

Built by **AR Smart Home**

---

## ⚠️ Notes

This project is actively developed. Features may evolve as new hardware is tested.
