const { loadConfig, updateGeneralSettings } = require("./config");
const { getHookOptions, extractMods } = require("./utils");

class PVEMod {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.mods = {};
    this.eventListeners = {};
    this.Config = loadConfig();

    this.dispatch.game.initialize("me");
    this.dispatch.game.initialize("me.abnormalities");
    this.dispatch.game.initialize("party");

    this.loadMods();
    this.registerCommands();
  }

  loadMods() {
    this.mods = extractMods(this.dispatch, this.Config);

    Object.keys(this.mods).forEach((modName) => {
      const mod = this.mods[modName];

      this.initializeHooks(mod);
      this.initializeCommands(mod);
      this.initializeEventListeners(mod);

      if (this.Config.generalSettings?.debug)
        console.log(`Installed mod ${modName}`);
    });
  }

  initializeHooks(mod) {
    Object.keys(mod.Hooks).forEach((hookName) => {
      const hook = mod.Hooks[hookName];
      const options = hook.position ? getHookOptions(hook.position) : null;
      if (this.Config.generalSettings?.debug) {
        console.log(
          `Registering hook: ${hookName} with version: ${hook.version || "*"}`
        );
      }
      if (hook.raw) {
        this.dispatch.hook(hookName, "raw", hook.handler);
      } else {
        if (options)
          this.dispatch.hook(
            hookName,
            hook.version || "*",
            options,
            hook.handler
          );
        else this.dispatch.hook(hookName, hook.version || "*", hook.handler);
      }
    });
  }

  initializeCommands(mod) {
    if (mod.Commands) {
      this.dispatch.command.remove(mod.constructor.Name);
      this.dispatch.command.add(mod.constructor.Name, mod.Commands);
    }
  }

  initializeEventListeners(mod) {
    if (mod.EventListeners) {
      this.eventListeners[mod.Name] = [];
      Object.keys(mod.EventListeners).forEach((event) => {
        const listener = mod.EventListeners[event];
        this.dispatch.game.me.on(event, listener);
        this.eventListeners[mod.Name].push({ event, listener });
      });
    }
  }

  registerCommands() {
    this.dispatch.command.remove("help");
    this.dispatch.command.add("help", () => {
      const modsList = Object.keys(this.mods)
        .map(
          (modName) =>
            `<font color="#56B4E9">${modName}</font>: ${
              this.mods[modName].Description || "No description"
            }`
        )
        .join("\n");
      this.dispatch.command.message(`Installed Mods:\n${modsList}`);
    });

    this.dispatch.command.remove("disable");
    this.dispatch.command.add("disable", this.disabledMod.bind(this));
  }

  unloadMods() {
    Object.keys(this.eventListeners).forEach((modName) => {
      const listeners = this.eventListeners[modName];
      const mod = this.mods[modName];
      listeners.forEach(({ event, listener }) => {
        this.dispatch.game.me.removeListener(event, listener);
      });
    });

    Object.keys(this.mods).forEach((modName) => {
      this.dispatch.command.remove(modName);
    });

    this.eventListeners = {};
    this.mods = {};
  }

  disabledMod(modName) {
    if (!modName) {
      this.dispatch.command.message("Please specify a mod name to disable.");
      return;
    }

    if (!this.mods[modName]) {
      this.dispatch.command.message(
        `Mod ${modName} is not loaded or does not exist.`
      );
      return;
    }

    this.Config.generalSettings.disabledMods =
      this.Config.generalSettings.disabledMods || [];
    if (!this.Config.generalSettings.disabledMods.includes(modName)) {
      this.Config.generalSettings.disabledMods.push(modName);
      updateGeneralSettings(this.Config.generalSettings);
      this.dispatch.command.message(
        `Mod ${modName} has been disabled. Reload pve-mod or the toolbox to see changes.`
      );
    } else {
      this.dispatch.command.message(`Mod ${modName} is already disabled.`);
    }
  }

  reloadMods() {
    this.unloadMods();
    this.loadMods();
  }

  destructor() {
    this.unloadMods();
  }
}

module.exports = PVEMod;
