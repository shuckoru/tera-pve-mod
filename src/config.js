const fs = require("fs");
const path = require("path");
const merge = require("lodash.merge");

const migrations = require("../config/migrations.json");

function applyMigrationMapping(oldConfig, mapping) {
  const newConfig = { ...oldConfig };

  function setValue(obj, path, value) {
    const keys = path.split(".");
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  for (const [oldKey, newPath] of Object.entries(mapping)) {
    if (oldConfig.hasOwnProperty(oldKey)) {
      setValue(newConfig, newPath, oldConfig[oldKey]);
      delete newConfig[oldKey];
    }
  }

  return newConfig;
}

function applyMigrations(config) {
  let currentVersion = config.version || 0;
  const latestVersion = Math.max(...Object.keys(migrations).map(Number));

  while (currentVersion < latestVersion) {
    const mapping = migrations[currentVersion + 1];
    config = applyMigrationMapping(config, mapping);
    config.version = currentVersion + 1;
    currentVersion = config.version;
  }

  return config;
}

const loadConfig = () => {
  let userConfig = {};
  let defaultConfig = {};

  const oldConfigFilePath = path.join(
    __dirname,
    "../config/featureSwitches.json"
  );
  const configFilePath = path.join(__dirname, "../config/config.json");
  const defaultFilePath = path.join(
    __dirname,
    "../config/defaults/config.json"
  );

  try {
    try {
      userConfig = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    } catch {}

    try {
      if (!Object.keys(userConfig).length)
        userConfig = JSON.parse(fs.readFileSync(oldConfigFilePath, "utf8"));
    } catch {}

    userConfig = applyMigrations(userConfig);
  } catch (error) {
    console.error("Error reading user config.", error);
  }

  try {
    defaultConfig = JSON.parse(fs.readFileSync(defaultFilePath, "utf8"));
  } catch (error) {
    console.error("Error reading default config.", error);
  }

  return merge({}, defaultConfig, userConfig);
};

const updateModConfig = (modName, updatedModConfig) => {
  const filePath = path.join(__dirname, "../config/config.json");

  try {
    const config = loadConfig();
    config.mods[modName] = updatedModConfig;
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    console.error(`Failed to update config:`, error);
  }
};

const updateGeneralSettings = (updatedGeneralSettings) => {
  const filePath = path.join(__dirname, "../config/config.json");
  try {
    const config = loadConfig();
    config.generalSettings = updatedGeneralSettings;
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    console.error(`Failed to update config:`, error);
  }
};

module.exports = {
  loadConfig,
  updateModConfig,
  updateGeneralSettings,
};
