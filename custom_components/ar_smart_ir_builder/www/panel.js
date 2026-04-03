class ARSmartIRPanel extends HTMLElement {
  constructor() {
    super();
    this._data = { entries: [], store: { devices: {} } };
    this._loadedDeviceKey = "";
    this._busy = false;
    this._setupPromptShown = false;
    this._step = 1;
    this._commandSuggestions = [
      "on", "off", "cool", "heat", "dry", "auto", "fan_only", "fan_low", "fan_medium", "fan_high",
      "swing_on", "swing_off", "temp_16", "temp_18", "temp_20", "temp_22", "temp_24", "power",
      "power_on", "power_off", "volume_up", "volume_down", "mute", "channel_up", "channel_down",
      "play", "pause", "stop", "next", "previous", "home", "back", "menu", "ok", "source_hdmi1",
      "source_hdmi2", "source_tv", "netflix", "youtube",
    ];
    this._recommendedByType = {
      climate: ["off", "cool", "heat", "dry", "auto", "fan_only", "temp_20", "temp_22", "temp_24", "fan_low", "fan_medium", "fan_high", "swing_on", "swing_off"],
      fan: ["off", "fan_low", "fan_medium", "fan_high"],
      media_player: ["power", "power_on", "power_off", "volume_up", "volume_down", "mute", "play", "pause", "home", "back", "menu", "ok", "source_hdmi1", "source_hdmi2", "netflix", "youtube"],
      tv: ["power", "power_on", "power_off", "volume_up", "volume_down", "mute", "channel_up", "channel_down", "home", "back", "menu", "ok", "source_hdmi1", "source_hdmi2", "source_tv", "netflix", "youtube"],
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
        .panel { padding: 24px; max-width: 960px; margin: 0 auto; color: var(--primary-text-color); }
        .hero { padding: 24px; border-radius: 24px; margin-bottom: 18px; border: 1px solid rgba(127,127,127,.2); background: linear-gradient(145deg, rgba(27,122,255,.14), rgba(26,153,107,.08)); }
        .hero h1, .card h2 { margin: 0 0 8px; }
        .hero p, .card p, .subtle { margin: 0; line-height: 1.5; color: var(--secondary-text-color); }
        .steps, .summary-strip, .details-grid { display: grid; gap: 10px; }
        .steps { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 18px; }
        .summary-strip { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 14px; }
        .details-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-top: 14px; }
        .step-btn, .summary-card, .card, details { border: 1px solid rgba(127,127,127,.18); border-radius: 18px; }
        .step-btn, .summary-card, .card, details { background: var(--card-background-color, rgba(255,255,255,.03)); }
        .step-btn { padding: 14px 16px; text-align: left; cursor: pointer; }
        .step-btn.active { background: rgba(27,122,255,.14); border-color: rgba(27,122,255,.3); }
        .step-btn .k { display: block; font-size: 12px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
        .step-btn .t, .summary-card .v { font-weight: 700; }
        .summary-card { padding: 14px; }
        .summary-card .k { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text-color); margin-bottom: 4px; }
        .card { padding: 22px; margin-bottom: 14px; }
        .step-card { display: none; }
        .step-card.active { display: block; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
        .field { margin-bottom: 12px; }
        .field label { display: block; margin-bottom: 6px; font-weight: 600; }
        .field .hint { margin-top: 5px; font-size: 12px; color: var(--secondary-text-color); }
        .field input, .field select { width: 100%; box-sizing: border-box; min-height: 42px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(127,127,127,.35); background: var(--secondary-background-color); color: inherit; }
        .actions, .pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .actions { margin-top: 10px; }
        button { min-height: 40px; padding: 0 14px; border-radius: 999px; border: none; cursor: pointer; background: var(--primary-color); color: var(--text-primary-color, #fff); font-weight: 600; }
        button.secondary, button.ghost, .pill { color: var(--primary-text-color); }
        button.secondary { background: rgba(127,127,127,.16); }
        button.ghost { background: transparent; border: 1px solid rgba(127,127,127,.22); }
        button:disabled { opacity: .6; cursor: wait; }
        .callout { padding: 14px 16px; border-radius: 16px; margin-bottom: 14px; line-height: 1.5; background: rgba(35,167,97,.09); border: 1px solid rgba(35,167,97,.18); }
        .callout.muted { background: rgba(127,127,127,.08); border-color: rgba(127,127,127,.14); }
        .pill-group { margin-top: 16px; }
        .pill-group h3 { margin: 0 0 8px; font-size: 15px; }
        .pill { border-radius: 999px; border: 1px solid rgba(127,127,127,.25); background: rgba(127,127,127,.1); padding: 8px 12px; font-size: 13px; cursor: pointer; }
        .pill.learned { background: rgba(35,167,97,.14); border-color: rgba(35,167,97,.2); }
        details { padding: 14px 16px; }
        details summary { cursor: pointer; font-weight: 700; }
        .checklist { display: grid; gap: 8px; margin-top: 12px; }
        .checklist-item { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(127,127,127,.08); }
        .checklist-item.learned { background: rgba(35,167,97,.13); }
        .checklist-item .label { font-weight: 600; }
        .checklist-item .meta { color: var(--secondary-text-color); font-size: 13px; }
        .mono-block { margin: 12px 0 0; padding: 14px; border-radius: 14px; background: #111; color: #f5f5f5; overflow: auto; min-height: 120px; white-space: pre-wrap; word-break: break-word; }
        .setup-guard { display: none; margin-bottom: 18px; padding: 18px 20px; border-radius: 18px; border: 1px solid rgba(214,122,0,.35); background: linear-gradient(135deg, rgba(214,122,0,.14), rgba(255,196,85,.1)); }
        .setup-guard.active { display: block; }
        .workspace.disabled { opacity: .45; pointer-events: none; user-select: none; filter: grayscale(.2); }
        @media (max-width: 860px) { .panel { padding: 16px; } .steps { grid-template-columns: 1fr 1fr; } }
      </style>

      <div class="panel">
        <div class="hero">
          <h1>AR Smart IR Builder</h1>
          <p>Build one clean profile at a time. Choose the remote, save the basics, learn the commands you actually need, then export when it looks right.</p>
          <div class="steps">
            <button class="step-btn" type="button" data-step="1"><span class="k">Step 1</span><span class="t">Choose Remote</span></button>
            <button class="step-btn" type="button" data-step="2"><span class="k">Step 2</span><span class="t">Profile Details</span></button>
            <button class="step-btn" type="button" data-step="3"><span class="k">Step 3</span><span class="t">Learn Commands</span></button>
            <button class="step-btn" type="button" data-step="4"><span class="k">Step 4</span><span class="t">Review & Export</span></button>
          </div>
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
          <div class="summary-strip">
            <div class="summary-card"><span class="k">Selected Remote</span><span id="summary_remote" class="v">Not selected</span></div>
            <div class="summary-card"><span class="k">Current Profile</span><span id="summary_profile" class="v">New profile</span></div>
            <div class="summary-card"><span class="k">Commands Learned</span><span id="summary_commands" class="v">0</span></div>
            <div class="summary-card"><span class="k">Recommended Coverage</span><span id="summary_coverage" class="v">0/0</span></div>
          </div>

          <section class="card step-card" data-step-card="1">
            <h2>Choose a Remote and Profile</h2>
            <p>Pick the Broadlink entry you want to use, then load an existing profile or start fresh.</p>
            <div class="grid">
              <div>
                <div class="field">
                  <label for="entry">Remote Entry</label>
                  <select id="entry"></select>
                </div>
                <div class="field">
                  <label for="saved_profiles">Saved Profiles</label>
                  <select id="saved_profiles"><option value="">Start a new profile</option></select>
                  <div class="hint">Load an existing profile before editing it so you do not overwrite it by accident.</div>
                </div>
              </div>
              <div class="callout muted">Keep this first step simple.<br>1. Choose the correct remote.<br>2. Load an existing profile or start a new one.<br>3. Continue when you are ready.</div>
            </div>
            <div class="actions"><button id="go_step_2" type="button">Continue to Profile Details</button></div>
          </section>

          <section class="card step-card" data-step-card="2">
            <h2>Profile Details</h2>
            <p>Only the essentials are visible by default. Open advanced details if you want richer export metadata.</p>
            <div class="grid">
              <div>
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
              </div>
              <details>
                <summary>Advanced details</summary>
                <div class="field" style="margin-top:12px"><label for="manufacturer">Manufacturer</label><input id="manufacturer" placeholder="Samsung"></div>
                <div class="field"><label for="model">Model</label><input id="model" placeholder="UA55AU7000"></div>
                <div class="field">
                  <label for="supported_models">Supported Models</label>
                  <input id="supported_models" placeholder="UA55AU7000, UA65AU7000">
                  <div class="hint">Optional. Leave blank if this profile is only for one model.</div>
                </div>
              </details>
            </div>
            <div class="actions">
              <button id="new_profile" class="secondary" type="button">New Profile</button>
              <button id="save" type="button">Save Profile</button>
              <button id="refresh" class="secondary" type="button">Refresh</button>
              <button id="go_step_3" class="ghost" type="button">Go to Learn Commands</button>
            </div>
          </section>
          <section class="card step-card" data-step-card="3">
            <h2>Learn Commands</h2>
            <p>Pick one command at a time. Recommended commands are grouped so the screen stays easier to scan.</p>
            <div id="status_message" class="callout muted">Start by entering or choosing a command name.</div>
            <div class="field">
              <label for="cmd">Command Name</label>
              <input id="cmd" list="command_suggestions" placeholder="power_on">
              <datalist id="command_suggestions"></datalist>
              <div class="hint">Names like <code>power_on</code>, <code>temp_24</code>, and <code>source_hdmi1</code> keep exports easier to reuse.</div>
            </div>
            <div id="recommended_commands"></div>
            <div class="actions">
              <button id="learn" type="button">Learn Command</button>
              <button id="go_step_4" class="ghost" type="button">Review Learned Commands</button>
            </div>
          </section>

          <section class="card step-card" data-step-card="4">
            <h2>Review and Export</h2>
            <p>Use this area for final checks, then export a SmartIR JSON file when you are happy with the profile.</p>
            <div id="status_summary" class="summary-strip"></div>
            <div class="actions">
              <button id="save_review" class="secondary" type="button">Save Profile</button>
              <button id="export" type="button">Export SmartIR JSON</button>
              <button id="go_step_3_back" class="secondary" type="button">Back to Learning</button>
            </div>
            <div class="details-grid">
              <details open><summary>Recommended coverage</summary><div id="coverage" class="checklist"></div></details>
              <details><summary>Stored commands</summary><pre id="commands" class="mono-block"></pre></details>
            </div>
            <details style="margin-top:14px"><summary>Activity log</summary><pre id="out" class="mono-block"></pre></details>
          </section>
        </div>
      </div>
    `;
  }

  attachEvents() {
    this.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => this.setStep(Number(button.dataset.step))));
    this.querySelector("#go_step_2").onclick = () => this.setStep(2);
    this.querySelector("#go_step_3").onclick = () => this.setStep(3);
    this.querySelector("#go_step_4").onclick = () => this.setStep(4);
    this.querySelector("#go_step_3_back").onclick = () => this.setStep(3);
    this.querySelector("#device").addEventListener("change", () => this.handleDeviceKeyChange());
    this.querySelector("#device").addEventListener("input", () => this.handleDeviceKeyChange(false));
    this.querySelector("#device_type").addEventListener("change", () => this.refreshDerivedUI());
    this.querySelector("#saved_profiles").addEventListener("change", (event) => {
      const deviceKey = event.target.value;
      if (!deviceKey) {
        this.resetForm();
        this.out("Ready for a new profile.");
        this.setStep(2);
        return;
      }
      this.querySelector("#device").value = deviceKey;
      this.fillDevice();
      this.out(`Loaded saved profile: ${deviceKey}`);
      this.setStep(2);
    });
    this.querySelector("#new_profile").onclick = () => {
      this.resetForm();
      this.out("Ready for a new profile.");
      this.setStep(2);
    };
    this.querySelector("#refresh").onclick = () => this.runAction("Refreshing profiles...", async () => {
      await this.load(this.querySelector("#device").value.trim() || null);
      this.out("Refreshed saved profiles.");
    });
    this.querySelector("#save").onclick = () => this.saveProfile();
    this.querySelector("#save_review").onclick = () => this.saveProfile();
    this.querySelector("#learn").onclick = () => this.learnCommand();
    this.querySelector("#export").onclick = () => this.exportProfile();
    this.querySelector("#open_integrations").onclick = () => window.location.assign("/config/integrations/dashboard");
    this.querySelector("#retry_load").onclick = () => this.load(this.querySelector("#device").value.trim() || null);
    this.setStep(this._step);
  }

  async saveProfile() {
    await this.runAction("Saving profile...", async () => {
      const payload = this.profilePayload();
      if (!payload.entry_id || !payload.device_key) throw new Error("Remote entry and device key are required before saving.");
      if (this.isOverwriteWithoutExplicitLoad(payload.device_key)) throw new Error(`Device key "${payload.device_key}" already exists. Load it from Saved Profiles before editing it, or use a different device key.`);
      await this._hass.callService("ar_smart_ir_builder", "save_device", payload);
      await this.load(payload.device_key);
      this.out(`Saved profile "${payload.name || payload.device_key}". The matching Home Assistant entity should now be created or refreshed.`);
      this.setStep(3);
    });
  }

  async learnCommand() {
    await this.runAction("Starting learn mode...", async () => {
      const entryId = this.querySelector("#entry").value;
      const deviceKey = this.querySelector("#device").value.trim();
      const commandName = this.querySelector("#cmd").value.trim();
      if (!entryId || !deviceKey || !commandName) throw new Error("Remote entry, device key, and command name are required.");
      if (this.isOverwriteWithoutExplicitLoad(deviceKey)) throw new Error(`Device key "${deviceKey}" already exists. Load it from Saved Profiles before learning more commands into it, or use a new device key.`);
      await this._hass.callService("ar_smart_ir_builder", "save_device", this.profilePayload());
      const result = await this._hass.callApi("POST", "services/ar_smart_ir_builder/learn_and_capture?return_response", {
        entry_id: entryId,
        device_key: deviceKey,
        command_name: commandName,
      });
      await this.load(deviceKey);
      this.querySelector("#cmd").value = "";
      this.out(`Learned "${commandName}" for "${deviceKey}".\n\n${JSON.stringify(result, null, 2)}`);
      this.setStep(3);
    });
  }

  async exportProfile() {
    await this.runAction("Exporting profile...", async () => {
      const deviceKey = this.querySelector("#device").value.trim();
      if (!deviceKey) throw new Error("Device key is required before export.");
      await this._hass.callService("ar_smart_ir_builder", "save_device", this.profilePayload());
      await this._hass.callService("ar_smart_ir_builder", "export_device", { device_key: deviceKey });
      this.out(`Exported ${deviceKey} to /local/ar_smart_ir_exports/${deviceKey}.json`);
      window.open(`/local/ar_smart_ir_exports/${deviceKey}.json`, "_blank");
    });
  }

  async runAction(message, fn) {
    if (this._busy || this.isSetupRequired()) {
      if (this.isSetupRequired()) this.showSetupRequired();
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

  setStep(step) {
    this._step = Math.min(4, Math.max(1, Number(step) || 1));
    this.querySelectorAll("[data-step]").forEach((button) => button.classList.toggle("active", Number(button.dataset.step) === this._step));
    this.querySelectorAll("[data-step-card]").forEach((card) => card.classList.toggle("active", Number(card.dataset.stepCard) === this._step));
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
    const supportedModels = this.querySelector("#supported_models").value.split(",").map((value) => value.trim()).filter(Boolean);
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
      this._data = await this._hass.callApi("GET", "ar_smart_ir_builder/data");
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
    Object.keys(this._data.store.devices || {}).sort().forEach((deviceKey) => {
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

    this.out(`Loaded ${Object.keys(this._data.store.devices || {}).length} saved profile(s).\nExport folder: ${this._data.export_path}`);
    this.setBusy(false);
    this.refreshDerivedUI();
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
      if (matchingEntry) this.querySelector("#entry").value = matchingEntry.entry_id;
    }
    this.prefillNameFromDeviceKey();
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
    this.showCommands({});
  }

  prefillNameFromDeviceKey() {
    const nameField = this.querySelector("#name");
    const deviceKey = this.querySelector("#device").value.trim();
    if (!nameField.value.trim() && deviceKey) nameField.value = this.humanizeDeviceKey(deviceKey);
  }

  humanizeDeviceKey(deviceKey) {
    return String(deviceKey || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (char) => char.toUpperCase());
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
    if (clearEntry) this.querySelector("#entry").value = defaultEntry;
    this.showCommands({});
  }

  isOverwriteWithoutExplicitLoad(deviceKey) {
    return Boolean(deviceKey && this._data.store.devices?.[deviceKey] && this._loadedDeviceKey !== deviceKey);
  }

  recommendedCommands() {
    const deviceType = this.querySelector("#device_type").value || "climate";
    return this._recommendedByType[deviceType] || this._recommendedByType.climate;
  }

  groupedRecommendedCommands() {
    const deviceType = this.querySelector("#device_type").value || "climate";
    if (deviceType === "climate") return [["Modes", ["off", "cool", "heat", "dry", "auto", "fan_only"]], ["Temperature", ["temp_20", "temp_22", "temp_24"]], ["Airflow", ["fan_low", "fan_medium", "fan_high", "swing_on", "swing_off"]]];
    if (deviceType === "fan") return [["Fan controls", ["off", "fan_low", "fan_medium", "fan_high"]]];
    if (deviceType === "tv") return [["Power and volume", ["power", "power_on", "power_off", "volume_up", "volume_down", "mute"]], ["Navigation", ["channel_up", "channel_down", "home", "back", "menu", "ok"]], ["Sources and apps", ["source_hdmi1", "source_hdmi2", "source_tv", "netflix", "youtube"]]];
    return [["Power and volume", ["power", "power_on", "power_off", "volume_up", "volume_down", "mute"]], ["Playback", ["play", "pause"]], ["Navigation", ["home", "back", "menu", "ok"]], ["Sources and apps", ["source_hdmi1", "source_hdmi2", "netflix", "youtube"]]];
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
    this.renderTopSummary();
  }

  populateSuggestions() {
    const datalist = this.querySelector("#command_suggestions");
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
    this.groupedRecommendedCommands().forEach(([title, commands]) => {
      const section = document.createElement("div");
      section.className = "pill-group";
      const heading = document.createElement("h3");
      heading.textContent = title;
      section.appendChild(heading);
      const row = document.createElement("div");
      row.className = "pill-row";
      commands.forEach((commandName) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `pill${learned.includes(commandName) ? " learned" : ""}`;
        button.textContent = commandName;
        button.onclick = () => { this.querySelector("#cmd").value = commandName; };
        row.appendChild(button);
      });
      section.appendChild(row);
      container.appendChild(section);
    });
  }

  renderStatusSummary() {
    const container = this.querySelector("#status_summary");
    const learned = this.currentCommandNames();
    const recommended = this.recommendedCommands();
    const learnedRecommendedCount = recommended.filter((name) => learned.includes(name)).length;
    const cards = [
      ["Profile type", this.deviceTypeLabel(this.querySelector("#device_type").value || "climate")],
      ["Commands learned", `${learned.length}`],
      ["Recommended coverage", `${learnedRecommendedCount}/${recommended.length}`],
    ];
    container.innerHTML = "";
    cards.forEach(([label, value]) => {
      const div = document.createElement("div");
      div.className = "summary-card";
      div.innerHTML = `<span class="k">${label}</span><span class="v">${value}</span>`;
      container.appendChild(div);
    });
    const statusMessage = this.querySelector("#status_message");
    statusMessage.className = `callout${learned.length ? "" : " muted"}`;
    statusMessage.innerText = learned.length
      ? `${learned.length} command${learned.length === 1 ? "" : "s"} learned. ${learnedRecommendedCount} of ${recommended.length} recommended commands are covered.`
      : "Start by entering or choosing a command name.";
  }

  renderTopSummary() {
    const entryId = this.querySelector("#entry").value;
    const deviceKey = this.querySelector("#device").value.trim();
    const learned = this.currentCommandNames();
    const recommended = this.recommendedCommands();
    const learnedRecommendedCount = recommended.filter((name) => learned.includes(name)).length;
    const selectedEntry = (this._data.entries || []).find((entry) => entry.entry_id === entryId);
    this.querySelector("#summary_remote").innerText = selectedEntry ? selectedEntry.remote_entity || selectedEntry.title : "Not selected";
    this.querySelector("#summary_profile").innerText = deviceKey ? this.querySelector("#name").value.trim() || this.humanizeDeviceKey(deviceKey) : "New profile";
    this.querySelector("#summary_commands").innerText = String(learned.length);
    this.querySelector("#summary_coverage").innerText = `${learnedRecommendedCount}/${recommended.length}`;
  }

  renderCoverage() {
    const container = this.querySelector("#coverage");
    const learned = this.currentCommandNames();
    container.innerHTML = "";
    this.recommendedCommands().forEach((commandName) => {
      const item = document.createElement("div");
      item.className = `checklist-item${learned.includes(commandName) ? " learned" : ""}`;
      item.innerHTML = `<div><div class="label">${commandName}</div><div class="meta">${this.commandHint(commandName)}</div></div><div>${learned.includes(commandName) ? "Learned" : "Missing"}</div>`;
      item.onclick = () => {
        this.querySelector("#cmd").value = commandName;
        this.setStep(3);
      };
      container.appendChild(item);
    });
  }

  commandHint(commandName) {
    if (commandName.startsWith("temp_")) return "Suggested temperature preset.";
    if (commandName.startsWith("fan_")) return "Fan speed or preset.";
    if (commandName.startsWith("source_")) return "Switch to an input source.";
    const hints = {
      power: "A single toggle command if your remote uses one button.", power_on: "Separate power-on command.", power_off: "Separate power-off command.",
      cool: "Main cooling mode.", heat: "Main heating mode.", dry: "Dry or dehumidify mode.", auto: "Automatic mode.", fan_only: "Fan-only mode.",
      mute: "Mute audio.", channel_up: "Next channel.", channel_down: "Previous channel.", play: "Play media.", pause: "Pause media.",
      home: "Go to home screen.", back: "Navigate back.", menu: "Open the menu.", ok: "Confirm or select.", netflix: "App shortcut.", youtube: "App shortcut.",
    };
    return hints[commandName] || "Custom command.";
  }

  currentCommandNames() {
    const deviceKey = this.querySelector("#device").value.trim();
    return Object.keys(this._data.store.devices?.[deviceKey]?.commands || {}).sort();
  }

  showCommands(commands) {
    const names = Object.keys(commands).sort();
    this.querySelector("#commands").innerText = names.length ? names.join("\n") : "No commands stored yet.";
    this.refreshDerivedUI();
  }

  deviceTypeLabel(deviceType) {
    const labels = { climate: "Climate", fan: "Fan", media_player: "Media Player", tv: "TV" };
    return labels[deviceType] || deviceType;
  }

  out(msg) {
    const text = String(msg || "");
    this.querySelector("#out").innerText = text;
    const statusMessage = this.querySelector("#status_message");
    if (statusMessage && text) {
      statusMessage.className = text.startsWith("Error:") ? "callout muted" : "callout";
      statusMessage.innerText = text;
    }
  }
}

if (!customElements.get("ar-smart-ir-panel")) {
  customElements.define("ar-smart-ir-panel", ARSmartIRPanel);
}
