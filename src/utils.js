const path = require("path");
const fs = require("fs");

const getHookOptions = (position) => ({
  order: position,
  filter: { fake: null, silenced: false, modified: null },
});

const getSafeMods = (mods, debug) => {
  const modsHooks = {};
  const hookUsage = {};
  const disabledMods = new Set();
  const safeMods = {};

  for (const modName in mods) {
    const mod = mods[modName];
    let isSafe = true;

    for (const hookName in mod.Hooks) {
      const hook = mod.Hooks[hookName];

      if (!modsHooks[hookName]) {
        modsHooks[hookName] = { position: new Set() };
      }

      if (!hookUsage[hookName]) {
        hookUsage[hookName] = new Set();
      }

      if (
        hook.position &&
        modsHooks[hookName].position.has(hook.position) &&
        debug
      ) {
        console.error(
          `Hook position conflict for Mod: [${modName}] hook: [${hookName}] position: [${hook.position}].`
        );
        disabledMods.add(modName);
        isSafe = false;
        break;
      } else {
        modsHooks[hookName].position.add(hook.position);
      }

      hookUsage[hookName].add(modName);
    }

    if (isSafe) {
      safeMods[modName] = mod;
    }
  }

  for (const hookName in hookUsage) {
    if (hookUsage[hookName].size > 1 && debug) {
      console.warn(
        `Warning: Hook [${hookName}] is used by multiple mods: ${Array.from(
          hookUsage[hookName]
        ).join(", ")}`
      );
    }
  }

  if (disabledMods.size > 0 && debug) {
    console.error(`Following mods were disabled: ${Array.from(disabledMods)}`);
  }

  return safeMods;
};

const extractMods = (dispatch, config) => {
  const debug = config.generalSettings?.debug || false;
  const modsDirectory = path.join(__dirname, "mods");

  const modFiles = fs.readdirSync(modsDirectory);

  const mods = {};
  modFiles.forEach((file) => {
    if (file == "base.js") return;
    const filePath = path.join(modsDirectory, file);
    try {
      const Mod = require(filePath);
      const modInstance = new Mod(dispatch, config);
      mods[Mod.Name] = modInstance;
    } catch (error) {
      if (debug) console.log(`Error importing: ${filePath}`);
      console.error(error);
    }
  });

  return getSafeMods(mods, debug);
};

const exportHookUsage = (mods) => {
  const hookUsageData = {};

  for (const modName in mods) {
    const mod = mods[modName];
    for (const hookName in mod.Hooks) {
      const hook = mod.Hooks[hookName];
      if (!hookUsageData[hookName]) {
        hookUsageData[hookName] = [];
      }
      hookUsageData[hookName].push({
        mod: modName,
        position: hook.position || null,
      });
    }
  }

  const filePath = path.join(__dirname, "..", "hookUsageData.json");
  fs.writeFileSync(filePath, JSON.stringify(hookUsageData, null, 2), "utf8");

  console.log(`Hook usage data exported to ${filePath}`);
};

module.exports = { getHookOptions, extractMods, exportHookUsage };
