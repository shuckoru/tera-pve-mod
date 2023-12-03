const { loadCommands, loadModule, unloadModule } = require("./mod.js");

class PVEMod {
  constructor(mod) {
    loadCommands(mod);
    loadModule(mod);
  }

  destructor() {
    unloadModule();
  }
}

module.exports = PVEMod;
