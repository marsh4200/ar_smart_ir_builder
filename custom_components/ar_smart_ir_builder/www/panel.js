class ARSmartIRPanel extends HTMLElement {
  constructor() {
    super();
    this._data = { entries: [], store: { devices: {} } };
    this._loadedDeviceKey = "";
    this._busy = false;
    this._setupPromptShown = false;
    this._commandSuggestions = [
      "on",
      "off",
      "cool",
      "heat",
      "dry",
      "auto",
      "fan_only",
      "fan_low",
      "fan_medium",
      "fan_high",
      "swing_on",
      "swing_off",
      "temp_16",
      "temp_18",
      "temp_20",
      "temp_22",
      "temp_24",
      "power",
      "power_on",
      "power_off",
      "volume_up",
      "volume_down",
      "mute",
      "channel_up",
      "channel_down",
      "play",
      "pause",
      "stop",
      "next",
      "previous",
      "home",
      "back",
      "menu",
      "ok",
      "source_hdmi1",
      "source_hdmi2",
      "source_tv",
      "netflix",
      "youtube",
    ];
    this._recommendedByType = {
      climate: [
        "off",
        "cool",
        "heat",
        "dry",
        "auto",
        "fan_only",
        "temp_20",
        "temp_22",
        "temp_24",
        "fan_low",
        "fan_medium",
        "fan_high",
        "swing_on",
        "swing_off",
      ],
      fan: ["off", "fan_low", "fan_medium", "fan_high"],
      media_player: [
        "power",
        "power_on",
        "power_off",
        "volume_up",
        "volume_down",
        "mute",
        "play",
        "pause",
        "home",
        "back",
        "menu",
        "ok",
        "source_hdmi1",
        "source_hdmi2",
        "netflix",
        "youtube",
      ],
      tv: [
        "power",
        "power_on",
        "power_off",
        "volume_up",
        "volume_down",
        "mute",
        "channel_up",
        "channel_down",
        "home",
        "back",
        "menu",
        "ok",
        "source_hdmi1",
        "source_hdmi2",
        "source_tv",
        "netflix",
        "youtube",
      ],
    };
  }

  set hass(hass) {
    this._hass = hass;

    if (!this.innerHTML) {
      this.render();
      this.attachEvents();
      this.load();
    }
  }

  render() {
    this.innerHTML = `
      <style>
        .panel {
          padding: 24px;
          max-width: 1080px;
          margin: 0 auto;
          color: var(--primary-text-color);
        }
        .hero {
          padding: 20px 22px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(24, 108, 255, 0.12), rgba(10, 160, 120, 0.12));
          border: 1px solid rgba(127, 127, 127, 0.2);
          margin-bottom: 18px;
        }
        .hero h1 {
          margin: 0 0 8px;
          font-size: 30px;
        }
        .hero p {
          margin: 0;
          line-height: 1.5;
          color: var(--secondary-text-color);
        }
        .setup-guard {
          display: none;
          margin-bottom: 18px;
          padding: 18px 20px;
          border-radius: 18px;
          border: 1px solid rgba(214, 122, 0, 0.35);
          background: linear-gradient(135deg, rgba(214, 122, 0, 0.14), rgba(255, 196, 85, 0.1));
        }
        .setup-guard.active {
          display: block;
        }
        .setup-guard h2 {
          margin: 0 0 8px;
          font-size: 22px;
        }
        .setup-guard p {
          margin: 0;
          line-height: 1.5;
          color: var(--primary-text-color);
        }
        .setup-guard .actions {
          margin-top: 14px;
        }
        .workspace.disabled {
          opacity: 0.45;
          pointer-events: none;
          user-select: none;
          filter: grayscale(0.2);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }
        .card {
          background: var(--card-background-color, rgba(255, 255, 255, 0.03));
          border: 1px solid rgba(127, 127, 127, 0.18);
          border-radius: 18px;
          padding: 18px;
          box-shadow: var(--ha-card-box-shadow, none);
        }
        .card h2 {
          margin: 0 0 8px;
          font-size: 18px;
        }
        .card p {
          margin: 0 0 14px;
          color: var(--secondary-text-color);
          line-height: 1.45;
        }
        .field {
          margin-bottom: 12px;
        }
        .field label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
        }
        .field .hint {
          margin-top: 5px;
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .field input,
        .field select {
          width: 100%;
          box-sizing: border-box;
          min-height: 42px;
          border-radius: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(127, 127, 127, 0.35);
          background: var(--secondary-background-color);
          color: inherit;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }
        button {
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          font-weight: 600;
        }
        button.secondary {
          background: rgba(127, 127, 127, 0.16);
          color: var(--primary-text-color);
        }
        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .pill {
          border-radius: 999px;
          border: 1px solid rgba(127, 127, 127, 0.25);
          background: rgba(127, 127, 127, 0.1);
          color: inherit;
          padding: 8px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .status-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }
        .status-chip {
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          background: rgba(127, 127, 127, 0.12);
        }
        .status-chip.good {
          background: rgba(35, 167, 97, 0.15);
          color: #1d8b52;
        }
        .checklist {
          display: grid;
          gap: 8px;
          margin-top: 12px;
        }
        .checklist-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(127, 127, 127, 0.08);
        }
        .checklist-item.learned {
          background: rgba(35, 167, 97, 0.13);
        }
        .checklist-item .label {
          font-weight: 600;
        }
        .checklist-item .meta {
          color: var(--secondary-text-color);
          font-size: 13px;
        }
        .mono-block {
          margin: 0;
          padding: 14px;
          border-radius: 14px;
          background: #111;
          color: #f5f5f5;
          overflow: auto;
          min-height: 120px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .split {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 14px;
          margin-top: 14px;
        }
        .subtle {
          color: var(--secondary-text-color);
          font-size: 13px;
        }
        @media (max-width: 860px) {
          .split {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="panel">
        <div class="hero">
          <h1>AR Smart IR Builder</h1>
          <p>Build a profile one step at a time: choose the Broadlink remote, describe the device, learn the commands you need, then export when you are happy with it.</p>
        </div>

        <section id="setup_guard" class="setup-guard">
          <h2>Integration Setup Required</h2>
          <p id="setup_guard_message"></p>
          <div class="actions">
            <button id="open_integrations" type="button">Open Integrations</button>
            <button id="retry_load" class="secondary" type="button">Try Again</button>
          </div>
        </section>

        <div id="workspace" class="workspace">
          <div class="grid">
            <section class="card">
              <h2>1. Choose a Remote</h2>
              <p>Select the Home Assistant entry that points at the Broadlink remote you want to use for learning and sending commands.</p>
              <div class="field">
                <label for="entry">Remote Entry</label>
                <select id="entry"></select>
              </div>
              <div class="field">
                <label for="saved_profiles">Saved Profiles</label>
                <select id="saved_profiles">
                  <option value="">Start a new profile</option>
                </select>
                <div class="hint">Load an existing device before editing it so you do not accidentally overwrite another profile.</div>
              </div>
            </section>

            <section class="card">
              <h2>2. Describe the Device</h2>
              <p>Use a simple device key and friendly name. Most users only need the main fields here.</p>
              <div class="field">
                <label for="device">Device Key</label>
                <input id="device" placeholder="living_room_tv">
                <div class="hint">Use lowercase letters, numbers, and underscores if possible.</div>
              </div>
              <div class="field">
                <label for="name">Profile Name</label>
                <input id="name" placeholder="Living Room TV">
              </div>
              <div class="field">
                <label for="device_type">Device Type</label>
                <select id="device_type">
                  <option value="climate">Air conditioner / climate</option>
                  <option value="fan">Fan</option>
                  <option value="media_player">Media player</option>
                  <option value="tv">TV</option>
                </select>
              </div>
              <div class="field">
                <label for="manufacturer">Manufacturer</label>
                <input id="manufacturer" placeholder="Samsung">
              </div>
              <div class="field">
                <label for="model">Model</label>
                <input id="model" placeholder="UA55AU7000">
              </div>
              <div class="field">
                <label for="supported_models">Supported Models</label>
                <input id="supported_models" placeholder="UA55AU7000, UA65AU7000">
                <div class="hint">Optional. Leave blank if this profile is only for one model.</div>
              </div>
              <div class="actions">
                <button id="new_profile" class="secondary" type="button">New Profile</button>
                <button id="save" type="button">Save Profile</button>
                <button id="refresh" class="secondary" type="button">Refresh</button>
              </div>
            </section>
          </div>

          <div class="split">
            <section class="card">
              <h2>3. Learn Commands</h2>
              <p>Pick a recommended command below or type your own command name if you need something custom.</p>
              <div class="field">
                <label for="cmd">Command Name</label>
                <input id="cmd" list="command_suggestions" placeholder="power_on">
                <datalist id="command_suggestions"></datalist>
                <div class="hint">Tip: common names like <code>power_on</code>, <code>temp_24</code>, or <code>source_hdmi1</code> make exported profiles easier to reuse.</div>
              </div>
              <div class="actions">
                <button id="learn" type="button">Learn Command</button>
                <button id="export" class="secondary" type="button">Export SmartIR JSON</button>
              </div>
              <div id="recommended_commands" class="pill-row"></div>
              <div id="status_summary" class="status-row"></div>
            </section>

            <section class="card">
              <h2>Quick Guide</h2>
              <p>The easiest release-ready flow is:</p>
              <div class="subtle">
                1. First add AR Smart IR Builder in Settings, Devices &amp; Services, Integrations, then select your remote there before using this page.
                <br>
                2. Create a profile and save it.
                <br>
                3. Learn your commands and make sure the saved profile is selected while you do it.
                <br>
                4. After learning all your commands, click Save Profile again.
                <br>
                5. Go to Settings, Devices &amp; Services, then Entities to find and control the new entity.
              </div>
            </section>
          </div>

          <div class="split">
            <section class="card">
              <h2>Recommended Coverage</h2>
              <p>This list updates with the selected device type and shows what has already been learned.</p>
              <div id="coverage" class="checklist"></div>
            </section>

            <section class="card">
              <h2>Stored Commands</h2>
              <p>A simple view of what is already inside this profile.</p>
              <pre id="commands" class="mono-block"></pre>
            </section>
          </div>

          <section class="card" style="margin-top:14px">
            <h2>Activity</h2>
            <p>Errors and successful actions will appear here.</p>
            <pre id="out" class="mono-block"></pre>
          </section>
        </div>
      </div>
    `;
  }

  attachEvents() {
    this.querySelector("#device").addEventListener("change", () => this.handleDeviceKeyChange());
    this.querySelector("#device").addEventListener("input", () => this.handleDeviceKeyChange(false));
    this.querySelector("#device_type").addEventListener("change", () => this.refreshDerivedUI());
    this.querySelector("#saved_profiles").addEventListener("change", (event) => {
      const deviceKey = event.target.value;
      if (!deviceKey) {
        this.resetForm();
        this.out("Ready for a new profile.");
        return;
      }
      this.querySelector("#device").value = deviceKey;
      this.fillDevice();
      this.out(`Loaded saved profile: ${deviceKey}`);
    });
    this.querySelector("#new_profile").onclick = () => {
      this.resetForm();
      this.out("Ready for a new profile.");
    };
    this.querySelector("#refresh").onclick = () =>
      this.runAction("Refreshing profiles...", async () => {
        await this.load(this.querySelector("#device").value.trim() || null);
        this.out("Refreshed saved profiles.");
      });

    this.querySelector("#save").onclick = () =>
      this.runAction("Saving profile...", async () => {
        const payload = this.profilePayload();
        if (!payload.entry_id || !payload.device_key) {
          throw new Error("Remote entry and device key are required before saving.");
        }
        if (this.isOverwriteWithoutExplicitLoad(payload.device_key)) {
          throw new Error(
            `Device key "${payload.device_key}" already exists. Load it from Saved Profiles before editing it, or use a different device key.`
          );
        }

        await this._hass.callService("ar_smart_ir_builder", "save_device", payload);
        await this.load(payload.device_key);
        this.out(
          `Saved profile "${payload.name || payload.device_key}". The matching Home Assistant entity should now be created or refreshed.`
        );
      });

    this.querySelector("#learn").onclick = () =>
      this.runAction("Starting learn mode...", async () => {
        const entryId = this.querySelector("#entry").value;
        const deviceKey = this.querySelector("#device").value.trim();
        const commandName = this.querySelector("#cmd").value.trim();

        if (!entryId || !deviceKey || !commandName) {
          throw new Error("Remote entry, device key, and command name are required.");
        }
        if (this.isOverwriteWithoutExplicitLoad(deviceKey)) {
          throw new Error(
            `Device key "${deviceKey}" already exists. Load it from Saved Profiles before learning more commands into it, or use a new device key.`
          );
        }

        await this._hass.callService("ar_smart_ir_builder", "save_device", this.profilePayload());
        const result = await this._hass.callApi(
          "POST",
          "services/ar_smart_ir_builder/learn_and_capture?return_response",
          {
            entry_id: entryId,
            device_key: deviceKey,
            command_name: commandName,
          }
        );

        await this.load(deviceKey);
        this.querySelector("#cmd").value = "";
        this.out(
          `Learned "${commandName}" for "${deviceKey}".\n\n${JSON.stringify(result, null, 2)}`
        );
      });

    this.querySelector("#export").onclick = () =>
      this.runAction("Exporting profile...", async () => {
        const deviceKey = this.querySelector("#device").value.trim();
        if (!deviceKey) {
          throw new Error("Device key is required before export.");
        }

        await this._hass.callService("ar_smart_ir_builder", "save_device", this.profilePayload());
        await this._hass.callService("ar_smart_ir_builder", "export_device", {
          device_key: deviceKey,
        });

        this.out(`Exported ${deviceKey} to /local/ar_smart_ir_exports/${deviceKey}.json`);
        window.open(`/local/ar_smart_ir_exports/${deviceKey}.json`, "_blank");
      });

    this.querySelector("#open_integrations").onclick = () => {
      window.location.assign("/config/integrations/dashboard");
    };
    this.querySelector("#retry_load").onclick = () => {
      this.load(this.querySelector("#device").value.trim() || null);
    };
  }

  async runAction(message, fn) {
    if (this._busy || this.isSetupRequired()) {
      if (this.isSetupRequired()) {
        this.showSetupRequired();
      }
      return;
    }

    this.setBusy(true);
    this.out(message);
    try {
      await fn();
    } catch (error) {
      const messageText = error?.body?.message || error?.message || String(error);
      this.out(`Error: ${messageText}`);
    } finally {
      this.setBusy(false);
    }
  }

  setBusy(isBusy) {
    this._busy = isBusy;
    this.querySelectorAll("button").forEach((button) => {
      if (button.id === "open_integrations" || button.id === "retry_load") {
        button.disabled = false;
        return;
      }
      button.disabled = isBusy || this.isSetupRequired();
    });
  }

  isSetupRequired() {
    return !Array.isArray(this._data.entries) || this._data.entries.length === 0;
  }

  setupRequiredMessage() {
    return "Please go to Settings > Devices & Services and add the integration first. Be sure to select the correct IR remote.";
  }

  showSetupRequired(detail = "") {
    const message = detail ? `${this.setupRequiredMessage()}\n\n${detail}` : this.setupRequiredMessage();
    this.querySelector("#setup_guard_message").innerText = message;
    this.querySelector("#setup_guard").classList.add("active");
    this.querySelector("#workspace").classList.add("disabled");
    this.out(message);
    this.setBusy(false);
    if (!this._setupPromptShown) {
      window.alert(this.setupRequiredMessage());
      this._setupPromptShown = true;
    }
  }

  hideSetupRequired() {
    this.querySelector("#setup_guard").classList.remove("active");
    this.querySelector("#workspace").classList.remove("disabled");
    this._setupPromptShown = false;
  }

  profilePayload() {
    const deviceKey = this.querySelector("#device").value.trim();
    const current = this._data.store.devices?.[deviceKey] || {};
    const profileName = this.querySelector("#name").value.trim() || this.humanizeDeviceKey(deviceKey);
    const model = this.querySelector("#model").value.trim() || profileName;
    const supportedModels = this.querySelector("#supported_models").value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      device_key: deviceKey,
      entry_id: this.querySelector("#entry").value,
      name: profileName,
      manufacturer: this.querySelector("#manufacturer").value.trim(),
      model,
      device_type: this.querySelector("#device_type").value.trim() || "climate",
      supported_models: supportedModels.length ? supportedModels : [model],
      commands: current.commands || {},
    };
  }

  async load(selectedDevice = null) {
    try {
      const res = await this._hass.callApi("GET", "ar_smart_ir_builder/data");
      this._data = res;
    } catch (error) {
      this._data = { entries: [], store: { devices: {} } };
      const messageText = error?.body?.message || error?.message || "The panel could not talk to the integration backend.";
      this.showSetupRequired(messageText);
      return;
    }

    if (!Array.isArray(this._data.entries) || this._data.entries.length === 0) {
      this.showSetupRequired();
      return;
    }

    this.hideSetupRequired();

    const entrySelect = this.querySelector("#entry");
    const currentEntry = entrySelect.value;
    entrySelect.innerHTML = "";
    this._data.entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.entry_id;
      option.text = entry.remote_entity || entry.title;
      entrySelect.add(option);
    });

    if (currentEntry && this._data.entries.some((entry) => entry.entry_id === currentEntry)) {
      entrySelect.value = currentEntry;
    } else if (this._data.entries[0]) {
      entrySelect.value = this._data.entries[0].entry_id;
    }

    const savedProfiles = this.querySelector("#saved_profiles");
    savedProfiles.innerHTML = '<option value="">Start a new profile</option>';
    Object.keys(this._data.store.devices || {})
      .sort()
      .forEach((deviceKey) => {
        const profile = this._data.store.devices[deviceKey] || {};
        const option = document.createElement("option");
        option.value = deviceKey;
        option.text = `${profile.name || deviceKey} (${this.deviceTypeLabel(profile.device_type || "climate")})`;
        savedProfiles.add(option);
      });

    if (selectedDevice) {
      this.querySelector("#device").value = selectedDevice;
      savedProfiles.value = selectedDevice;
      this.fillDevice();
    } else if (this.querySelector("#device").value.trim()) {
      this.fillDevice();
    } else {
      this.resetForm(false);
    }

    this.out(
      `Loaded ${Object.keys(this._data.store.devices || {}).length} saved profile(s).\nExport folder: ${this._data.export_path}`
    );
    this.setBusy(false);
  }

  fillDevice() {
    const deviceKey = this.querySelector("#device").value.trim();
    const device = this._data.store.devices?.[deviceKey] || {};
    const entries = this._data.entries || [];
    const isKnownDevice = Boolean(deviceKey && this._data.store.devices?.[deviceKey]);

    this._loadedDeviceKey = isKnownDevice ? deviceKey : "";
    this.querySelector("#saved_profiles").value = isKnownDevice ? deviceKey : "";
    this.querySelector("#name").value = device.name || "";
    this.querySelector("#manufacturer").value = device.manufacturer || "";
    this.querySelector("#model").value = device.model || "";
    this.querySelector("#device_type").value = device.device_type || "climate";
    this.querySelector("#supported_models").value = (device.supported_models || []).join(", ");

    if (device.entry_id) {
      const matchingEntry = entries.find((entry) => entry.entry_id === device.entry_id);
      if (matchingEntry) {
        this.querySelector("#entry").value = matchingEntry.entry_id;
      }
    }

    this.prefillNameFromDeviceKey();
    this.refreshDerivedUI();
    this.showCommands(device.commands || {});
  }

  handleDeviceKeyChange(shouldLoadExisting = true) {
    const deviceKey = this.querySelector("#device").value.trim();
    if (shouldLoadExisting && deviceKey && this._data.store.devices?.[deviceKey]) {
      this.fillDevice();
      return;
    }

    if (!deviceKey) {
      this.resetForm(false);
      return;
    }

    const preservedEntry = this.querySelector("#entry").value;
    const preservedType = this.querySelector("#device_type").value || "climate";
    this._loadedDeviceKey = "";
    this.querySelector("#saved_profiles").value = "";
    this.querySelector("#name").value = "";
    this.querySelector("#manufacturer").value = "";
    this.querySelector("#model").value = "";
    this.querySelector("#supported_models").value = "";
    this.querySelector("#cmd").value = "";
    this.querySelector("#entry").value = preservedEntry;
    this.querySelector("#device_type").value = preservedType;
    this.prefillNameFromDeviceKey();
    this.refreshDerivedUI();
    this.showCommands({});
  }

  prefillNameFromDeviceKey() {
    const nameField = this.querySelector("#name");
    const deviceKey = this.querySelector("#device").value.trim();
    if (!nameField.value.trim() && deviceKey) {
      nameField.value = this.humanizeDeviceKey(deviceKey);
    }
  }

  humanizeDeviceKey(deviceKey) {
    return String(deviceKey || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  resetForm(clearEntry = true) {
    const defaultEntry = this._data.entries?.[0]?.entry_id || "";
    this._loadedDeviceKey = "";
    this.querySelector("#saved_profiles").value = "";
    this.querySelector("#device").value = "";
    this.querySelector("#name").value = "";
    this.querySelector("#manufacturer").value = "";
    this.querySelector("#model").value = "";
    this.querySelector("#device_type").value = "climate";
    this.querySelector("#supported_models").value = "";
    this.querySelector("#cmd").value = "";
    if (clearEntry) {
      this.querySelector("#entry").value = defaultEntry;
    }
    this.refreshDerivedUI();
    this.showCommands({});
  }

  isOverwriteWithoutExplicitLoad(deviceKey) {
    return Boolean(
      deviceKey &&
      this._data.store.devices?.[deviceKey] &&
      this._loadedDeviceKey !== deviceKey
    );
  }

  recommendedCommands() {
    const deviceType = this.querySelector("#device_type").value || "climate";
    return this._recommendedByType[deviceType] || this._recommendedByType.climate;
  }

  allSuggestions() {
    const deviceKey = this.querySelector("#device").value.trim();
    const existingCommands = Object.keys(this._data.store.devices?.[deviceKey]?.commands || {});
    return [...new Set([...this._commandSuggestions, ...this.recommendedCommands(), ...existingCommands])];
  }

  refreshDerivedUI() {
    this.populateSuggestions();
    this.renderRecommendedCommands();
    this.renderCoverage();
    this.renderStatusSummary();
  }

  populateSuggestions() {
    const datalist = this.querySelector("#command_suggestions");
    if (!datalist) {
      return;
    }

    datalist.innerHTML = "";
    this.allSuggestions().forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      datalist.appendChild(option);
    });
  }

  renderRecommendedCommands() {
    const container = this.querySelector("#recommended_commands");
    const learned = this.currentCommandNames();
    container.innerHTML = "";
    this.recommendedCommands().forEach((commandName) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.textContent = learned.includes(commandName) ? `${commandName} learned` : commandName;
      button.onclick = () => {
        this.querySelector("#cmd").value = commandName;
      };
      container.appendChild(button);
    });
  }

  renderStatusSummary() {
    const container = this.querySelector("#status_summary");
    const learned = this.currentCommandNames();
    const recommended = this.recommendedCommands();
    const learnedRecommendedCount = recommended.filter((name) => learned.includes(name)).length;
    const chips = [
      `${learned.length} command${learned.length === 1 ? "" : "s"} learned`,
      `${learnedRecommendedCount}/${recommended.length} recommended covered`,
      `Type: ${this.deviceTypeLabel(this.querySelector("#device_type").value || "climate")}`,
    ];

    container.innerHTML = "";
    chips.forEach((text, index) => {
      const div = document.createElement("div");
      div.className = `status-chip${index === 1 && learnedRecommendedCount ? " good" : ""}`;
      div.textContent = text;
      container.appendChild(div);
    });
  }

  renderCoverage() {
    const container = this.querySelector("#coverage");
    const learned = this.currentCommandNames();
    container.innerHTML = "";

    this.recommendedCommands().forEach((commandName) => {
      const item = document.createElement("div");
      item.className = `checklist-item${learned.includes(commandName) ? " learned" : ""}`;
      item.innerHTML = `
        <div>
          <div class="label">${commandName}</div>
          <div class="meta">${this.commandHint(commandName)}</div>
        </div>
        <div>${learned.includes(commandName) ? "Learned" : "Missing"}</div>
      `;
      item.onclick = () => {
        this.querySelector("#cmd").value = commandName;
      };
      container.appendChild(item);
    });
  }

  commandHint(commandName) {
    if (commandName.startsWith("temp_")) {
      return "Suggested temperature preset.";
    }
    if (commandName.startsWith("fan_")) {
      return "Fan speed or preset.";
    }
    if (commandName.startsWith("source_")) {
      return "Switch to an input source.";
    }
    const hints = {
      power: "A single toggle command if your remote uses one button.",
      power_on: "Separate power-on command.",
      power_off: "Separate power-off command.",
      cool: "Main cooling mode.",
      heat: "Main heating mode.",
      dry: "Dry or dehumidify mode.",
      auto: "Automatic mode.",
      fan_only: "Fan-only mode.",
      mute: "Mute audio.",
      channel_up: "Next channel.",
      channel_down: "Previous channel.",
      play: "Play media.",
      pause: "Pause media.",
      home: "Go to home screen.",
      back: "Navigate back.",
      menu: "Open the menu.",
      ok: "Confirm or select.",
      netflix: "App shortcut.",
      youtube: "App shortcut.",
    };
    return hints[commandName] || "Custom command.";
  }

  currentCommandNames() {
    const deviceKey = this.querySelector("#device").value.trim();
    return Object.keys(this._data.store.devices?.[deviceKey]?.commands || {}).sort();
  }

  showCommands(commands) {
    const names = Object.keys(commands).sort();
    if (!names.length) {
      this.querySelector("#commands").innerText = "No commands stored yet.";
      this.refreshDerivedUI();
      return;
    }

    this.querySelector("#commands").innerText = names.join("\n");
    this.refreshDerivedUI();
  }

  deviceTypeLabel(deviceType) {
    const labels = {
      climate: "Climate",
      fan: "Fan",
      media_player: "Media Player",
      tv: "TV",
    };
    return labels[deviceType] || deviceType;
  }

  out(msg) {
    this.querySelector("#out").innerText = msg;
  }
}

customElements.define("ar-smart-ir-panel", ARSmartIRPanel);
