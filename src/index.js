const { loadConfig, updateGeneralSettings } = require("./config");
const { getHookOptions, extractMods } = require("./utils");

const fs = require("fs");
const path = require("path");

class PVEMod {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.mods = {};
    this.eventListeners = {};
    this.Config = loadConfig();

    this.dispatch.game.initialize("me");
    this.dispatch.game.initialize("me.abnormalities");
    this.dispatch.game.initialize("party");

    this.loadDefinitions();

    this.loadMods();
    this.registerCommands();
  }

  loadMods() {
    this.mods = extractMods(this.dispatch, this.Config);

    Object.keys(this.mods).forEach((modName) => {
      try {
        const mod = this.mods[modName];

        this.initializeEventListeners(mod);
        this.initializeCommands(mod);
        this.initializeHooks(mod);

        if (this.Config.generalSettings?.debug)
          console.log(`Installed mod ${modName}`);
      } catch (error) {
        console.error(`Error initializing mod: ${modName}`, error);
      }
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

    this.dispatch.command.remove("uninstall");
    this.dispatch.command.add("uninstall", this.uninstallMod.bind(this));

    this.dispatch.command.remove("install");
    this.dispatch.command.add("install", this.installMod.bind(this));
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

  uninstallMod(modName) {
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

    this.Config.generalSettings.uninstalledMods =
      this.Config.generalSettings.uninstalledMods || [];
    if (!this.Config.generalSettings.uninstalledMods.includes(modName)) {
      this.Config.generalSettings.uninstalledMods.push(modName);
      updateGeneralSettings(this.Config.generalSettings);
      this.dispatch.command.message(
        `Mod ${modName} has been added to the uninstalled list. Reload pve-mod or the toolbox to see changes.`
      );
    } else {
      this.dispatch.command.message(
        `Mod ${modName} is already in the uninstalled list.`
      );
    }
  }

  installMod(modName) {
    if (!modName) {
      this.dispatch.command.message("Please specify a mod name to install.");
      return;
    }

    const installedMods = Object.keys(this.mods).map((modName) => modName);
    const uninstalledMods = this.Config.generalSettings.uninstalledMods || [];
    const indexOfModToInstall = uninstalledMods.indexOf(modName);

    if (installedMods.includes(modName)) {
      this.dispatch.command.message(`Mod ${modName} is already installed.`);
      return;
    }

    if (indexOfModToInstall == -1) {
      this.dispatch.command.message(`Mod ${modName} does not exist.`);
      return;
    }

    this.Config.generalSettings.uninstalledMods.splice(indexOfModToInstall, 1);

    updateGeneralSettings(this.Config.generalSettings);

    this.dispatch.command.message(
      `Mod ${modName} is going to be installed with next restart.`
    );
  }

  loadDefinitions() {
    const defsDir = path.join(__dirname, ".", "defs");

    fs.readdir(defsDir, (err, files) => {
      if (err) {
        console.error("Error reading definitions directory", err);
        return;
      }

      files.forEach((fileName) => {
        if (fileName.endsWith(".def")) {
          const [hName, version] = parseFileName(fileName);
          this.dispatch.dispatch.addDefinition(
            hName,
            version,
            path.join(defsDir, fileName)
          );
        }
      });
    });

    // Helper function to parse the file name
    function parseFileName(fileName) {
      const parts = fileName.split(".");
      const hName = parts[0];
      const version = parseInt(parts[1], 10);
      return [hName, version];
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
