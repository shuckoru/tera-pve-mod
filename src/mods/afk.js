const BaseMod = require("./base");

class AfkMod extends BaseMod {
  static Version = 1;

  static Name = "afk";
  Description = "Prevent server from kicking you out";

  Hooks = {};
  Commands = null;
  EventListeners = {};

  constructor(mod, config) {
    super(mod, config);

    this.lastTimeMoved = Date.now();

    this.Hooks = {
      C_PLAYER_LOCATION: {
        handler: (event) => {
          if ([0, 1, 5, 6].includes(event.type))
            this.lastTimeMoved = Date.now();
        },
      },
      C_RETURN_TO_LOBBY: {
        raw: true,
        handler: () => {
          if (this.Config.enabled && Date.now() - this.lastTimeMoved >= 3600000)
            return false;
        },
      },
    };

    this.EventListeners = {};

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      default:
        this.toggleEnableMod();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">AfkMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle AFK mod.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = AfkMod;
