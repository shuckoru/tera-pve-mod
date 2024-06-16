const BaseMod = require("./base");

class JustSpamFMod extends BaseMod {
  static Version = 1;

  static Name = "jsf";
  Description = "Modify dialog options to allow spamming the F key";

  Hooks = {};
  Commands = null;

  constructor(mod, config) {
    super(mod, config);

    if (mod.majorPatchVersion == 92) {
      mod.dispatch.addDefinition(
        "S_DIALOG",
        99,
        __dirname + "/S_DIALOG.def",
        true
      );
    }

    this.Hooks = {
      S_DIALOG: {
        handler: (event) => this.handleDialog(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleDialog(event) {
    if (!event.buttons.length || !this.Config.enabled) return;
    for (let i = 0; i < event.buttons.length; i++) {
      if (
        [1, 2, 3, 4, 5, 51, 53, 54, 55, 56, 63].includes(event.buttons[i].type)
      )
        event.buttons[i].type = 43;
    }
    event.type = 1;
    return true;
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
    const helpMessage = `<font color="#56B4E9">JustSpamFMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle JustSpamF.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = JustSpamFMod;
