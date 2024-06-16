const BaseMod = require("./base");

class SwearWordsMod extends BaseMod {
  static Version = 1;

  static Name = "swearw";
  Description = "Unfilter swear words in chat messages";

  constructor(mod, config) {
    super(mod, config);

    const unfilter = (e) => {
      if (this.Config.enabled) {
        e.message = e.message.replace(
          /<FONT>(.*?)<\/FONT>/g,
          "<FONT></FONT>$1"
        );
      }
      return true;
    };

    this.Hooks = {
      S_CHAT: {
        order: 100,
        handler: unfilter,
      },
      S_WHISPER: {
        order: 100,
        handler: unfilter,
      },
      S_PRIVATE_CHAT: {
        order: 100,
        handler: unfilter,
      },
      C_CHAT: {
        order: 100,
        handler: unfilter,
      },
      C_WHISPER: {
        order: 100,
        handler: unfilter,
      },
    };

    this.Commands = async (key, value) => {
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
    const helpMessage = `<font color="#56B4E9">SwearWordsMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle Swear Words Filter.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = SwearWordsMod;
