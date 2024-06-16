const { updateModConfig } = require("../config");

class BaseMod {
  Name;
  Description;

  Hooks = {};
  Commands = null;
  EventListeners = {};

  constructor(mod, config) {
    this.Config = config.mods[this.constructor.Name];
    this.mod = mod;
    this.cmdMsg = (msg) => mod.command.message(msg);
  }

  sendEnabledMsg(setting, enabled) {
    this.cmdMsg(
      `${setting}: ${
        enabled
          ? '<font color="#56B4E9">enabled</font>'
          : '<font color="#E69F00">disabled</font>'
      }.`
    );
  }

  toggleEnabledSettings(configKey) {
    this.Config.settings[configKey] = !this.Config.settings[configKey];
    updateModConfig(this.constructor.Name, this.Config);
    this.sendEnabledMsg(configKey, this.Config.settings[configKey]);
  }

  toggleEnableMod() {
    this.Config.enabled = !this.Config.enabled;
    if (this.Config.enabled)
      this.cmdMsg(
        "This feature is currently unstable and in BETA. Use is not adviced yet."
      );
    updateModConfig(this.constructor.Name, this.Config);
    this.sendEnabledMsg(`${this.constructor.Name} mod`, this.Config.enabled);
  }

  updateSettingsValue(settingsKey, value) {
    if (!value) {
      this.cmdMsg(
        `To update ${settingsKey} a value is required. For more info check the 'help' section of the mod.`
      );
      return;
    }
    if (!isNaN(value)) value = Number(value);

    this.Config.settings[settingsKey] = value;
    updateModConfig(this.constructor.Name, this.Config);
    this.cmdMsg(`${settingsKey} updated with value: ${value}`);
  }
}

module.exports = BaseMod;
