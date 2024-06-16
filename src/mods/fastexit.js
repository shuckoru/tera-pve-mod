const BaseMod = require("./base");

class ExitInstantlyMod extends BaseMod {
  static Version = 1;

  static Name = "fastexit";
  Description = "Exit the game instantly.";

  Hooks = {};
  Commands = null;

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_PREPARE_EXIT: {
        handler: (event) => this.handlePrepareExit(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handlePrepareExit(event) {
    this.mod.send("S_EXIT", 3, {
      category: 0,
      code: 0,
    });
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      default:
        this.cmdMsg("Unknown command");
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">ExitInstantlyMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = ExitInstantlyMod;
