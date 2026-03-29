🚀 AR Smart IR Builder




✨ Overview

AR Smart IR Builder is a modern Home Assistant integration that allows you to:

Learn IR/RF commands directly from Broadlink
Build device profiles from scratch (UI only)
Automatically create working entities (Climate, Fan, Media Player)
Export devices to SmartIR-compatible JSON

No YAML. No manual file editing. Everything is done inside Home Assistant.

🔥 Key Features
🎯 Full UI-Based Setup
Uses Config Flow
No YAML required
Easy setup directly from Devices & Services

📡 Built-in IR Learning (Broadlink)
Starts learn mode
Captures the IR/RF code automatically
Stores it inside your device profile

Service:

action: ar_smart_ir_builder.learn_and_capture

🧠 Smart Device Builder

Create and manage devices with:

Manufacturer
Model
Device type (climate / fan / media_player)
Command mappings

Devices are stored internally and dynamically updated.

⚡ Auto Entity Creation

Entities are created automatically based on your commands:

Device Type	Entity Created
Climate	climate.*
Fan	fan.*
Media	media_player.*

Detection is automatic based on commands.





🎮 Media Player Support

Supports:

Power ON/OFF
Play / Pause / Stop
Volume up / down / mute
Source selection
App launching (Netflix, YouTube, etc.)

🌡️ Climate Support

Supports:

HVAC modes (cool, heat, dry, fan, auto)
Temperature control (auto-detected from commands)
Fan modes
Swing modes

🌀 Fan Support

Supports:

On / Off
Speed presets
Auto detection from fan_* commands

💾 SmartIR Export

Export your built device into SmartIR format:

action: ar_smart_ir_builder.export_device

Exports to:

/config/www/ar_smart_ir_exports/

⚙️ How It Works
1. Add Integration
Go to Devices & Services
Add AR Smart IR Builder
Select your Broadlink remote entity
2. Learn Commands

Example:

action: ar_smart_ir_builder.learn_and_capture
data:
  entry_id: YOUR_ENTRY_ID
  device_key: tv_lounge
  command_name: power
3. Build Device

Save your device:

action: ar_smart_ir_builder.save_device
data:
  device_key: tv_lounge
  name: Lounge TV
  manufacturer: Samsung
  device_type: media_player
4. Done ✅

Entities will appear automatically in Home Assistant.

🧠 Command Naming (VERY IMPORTANT)

Your commands determine functionality.

🎮 Media Player
power
power_on
power_off
volume_up
volume_down
mute
play
pause
source_hdmi1
netflix
youtube
🌡️ Climate
cool_16
cool_24
heat_22
fan_auto
swing_on
off
🌀 Fan
fan_low
fan_medium
fan_high
off
🧩 Services
🔹 Learn & Capture

Learns IR code from Broadlink

ar_smart_ir_builder.learn_and_capture
🔹 Save Device

Creates or updates device

ar_smart_ir_builder.save_device
🔹 Export Device

Exports SmartIR JSON

ar_smart_ir_builder.export_device
📦 Storage
Devices are stored inside Home Assistant config entries
Automatically synced and updated
No manual JSON editing required

🖥️ Built-in UI Panel

Includes a custom sidebar panel:

Device builder
Live device data
Export access

Accessible from sidebar:

AR Smart IR

⚠️ Requirements
Home Assistant (modern version)
Broadlink remote integrated
remote.learn_command support
🚀 Future Plans
Full UI learning workflow (no service calls needed)
Device templates
IR database sharing
Multi-controller support (Tuya, ESPHome, MQTT)
💬 Credits

Developed by AR Smart Home (Pty) Ltd

Built for real-world smart home installs where:

Flexibility matters
UI matters
YAML must die 😄
