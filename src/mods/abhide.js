const BaseMod = require("./base");

class AbnormsHideMod extends BaseMod {
  static Version = 1;

  static Name = "abhide";
  Description = "Hide certain abnormalities based on configuration";

  Hooks = {};
  Commands = null;
  EventListeners = {};

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_ABNORMALITY_BEGIN: {
        position: 999,
        handler: (event) => this.handleAbnormality(event),
      },
      S_ABNORMALITY_REFRESH: {
        position: 999,
        handler: (event) => this.handleAbnormality(event),
      },
    };

    this.Commands = async (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleAbnormality(event) {
    if (!this.Config.enabled) return;
    if (event.id in this.Config.settings.blacklistedAbnormalities) return false;
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
    const helpMessage = `<font color="#56B4E9">AbnormsHideMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle Abnormalities Hide Mod.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = AbnormsHideMod;
