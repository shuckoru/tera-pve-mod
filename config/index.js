const fs = require("fs");

const loadJsonConfigurationFile = (filePath, configName, modConfigs) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }
    modConfigs[configName].data = JSON.parse(data);
  });
};

const setGlobalConfigVariables = (modConfigs) => {
  for (let configName in modConfigs) {
    const filePath = modConfigs[configName].filePath;
    fs.watchFile(filePath, (_, __) => {
      loadJsonConfigurationFile(filePath, configName, modConfigs);
    });
    loadJsonConfigurationFile(filePath, configName, modConfigs);
  }
};

const unwatchConfigFilesChanges = (modConfigs) => {
  for (let configName in modConfigs) {
    fs.unwatchFile(modConfigs[configName].filePath);
  }
};

module.exports = { setGlobalConfigVariables, unwatchConfigFilesChanges };
