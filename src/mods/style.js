const BaseMod = require("./base");

class AutoRefreshStyleMod extends BaseMod {
  static Version = 1;

  static Name = "style";
  Description = "Automatically refreshes character style.";
  playerAppearanceEvent = null;
  trollCostumeSwapInterval = null;

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_USER_EXTERNAL_CHANGE: {
        version: "*",
        handler: (e) => {
          if (e.gameId === mod.game.me.gameId) this.playerAppearanceEvent = e;
        },
      },
      S_USER_STATUS: {
        version: "*",
        handler: (e) => {
          if (e.gameId !== mod.game.me.gameId) return;
          this.resetStyle();
        },
      },
      S_LOAD_TOPO: {
        version: "*",
        handler: this.resetStyle.bind(this),
      },
      S_SPAWN_ME: {
        version: "*",
        handler: this.resetStyle.bind(this),
      },
    };

    this.EventListeners = {
      resurrect: this.resetStyle.bind(this),
    };

    this.Commands = async (key, value) => {
      this.handleCommand(key, value);
    };

    mod.game.me.on("resurrect", this.resetStyle.bind(this));
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      case "re":
        this.resetStyle();
        this.cmdMsg("Character style refreshed.");
        break;
      default:
        this.toggleEnableMod();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">AutoRefreshStyleMod Commands:</font>
    <font color="#56B4E9">help</font>: Show this help message.
    <font color="#56B4E9">re</font>: Refresh character style.
    <font color="#56B4E9">[any other key]</font>: Toggle enable mod.`;
    this.cmdMsg(helpMessage);
  }

  resetStyle() {
    if (!this.Config.enabled) return;
    if (!this.playerAppearanceEvent) return;

    this.mod.setTimeout(() => {
      this.mod.toClient(
        "S_USER_EXTERNAL_CHANGE",
        "*",
        this.playerAppearanceEvent
      );
    }, 2000);
  }
}

module.exports = AutoRefreshStyleMod;
