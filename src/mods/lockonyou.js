const BaseMod = require("./base");

class NoLockOnYouMod extends BaseMod {
  static Version = 1;

  static Name = "lockonyou";
  Description = "Toggle lock-on effects from other players";

  Hooks = {};
  Commands = null;

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_LOCKON_YOU: {
        handler: () => this.Config.enabled,
      },
    };

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
    const helpMessage = `<font color="#56B4E9">NoLockOnYouMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle LockOnYou.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = NoLockOnYouMod;
