# 🚀 AR Smart IR Builder

[![GitHub release](https://img.shields.io/github/v/release/marsh4200/ar_smart_ir_builder.svg)](https://github.com/marsh4200/ar_smart_ir_builder/releases)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=marsh4200&repository=ar_smart_ir_builder&category=integration)
---

## ✨ Overview

**AR Smart IR Builder** is a modern Home Assistant integration that allows you to:

- Learn IR/RF commands directly from Broadlink
- Build device profiles from scratch (UI only)
- Automatically create working entities (Climate, Fan, Media Player)
- Export devices to SmartIR-compatible JSON

No YAML. Everything is done inside Home Assistant.

---

## 🔥 Key Features

### 🎯 Full UI-Based Setup
- Uses Config Flow
- No YAML required
- Easy setup via Devices & Services

---

### 📡 Built-in IR Learning (Broadlink)

Service:
ar_smart_ir_builder.learn_and_capture

---

### 🧠 Smart Device Builder

Create devices with:
- Manufacturer
- Model
- Device type
- Command mappings

---

### ⚡ Auto Entity Creation

- climate.*
- fan.*
- media_player.*

---

### 💾 SmartIR Export

Exports to:
/config/www/ar_smart_ir_exports/

---

## ⚙️ How It Works

1. Add integration
2. Learn commands
3. Save device
4. Entities appear automatically

---

## 🧠 Command Naming

Media:
power, volume_up, play, source_hdmi1

Climate:
cool_24, heat_22, off

Fan:
fan_low, fan_high

---

## 🧩 Services

- learn_and_capture
- save_device
- export_device

---

## 💬 Credits

Developed by AR Smart Home 
