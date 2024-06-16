const BaseMod = require("./base");

class HideMotesMod extends BaseMod {
  static Version = 1;

  static Name = "hidemotes";
  Description = "Toggle the visibility of motes";

  Hooks = {};
  Commands = null;
  motes = {};
  gameId = null;

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_LOGIN: {
        handler: (event) => {
          ({ gameId: this.gameId } = event);
        },
      },
      S_LOAD_TOPO: {
        raw: true,
        handler: () => {
          this.motes = {};
        },
      },
      S_SPAWN_DROPITEM: {
        handler: (event) => this.handleSpawnDropItem(event),
      },
      S_DESPAWN_DROPITEM: {
        handler: (event) => this.handleDespawnDropItem(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleSpawnDropItem(event) {
    if (event.item >= 8008 && event.item <= 8023) {
      this.motes[event.gameId] = { ...event, explode: false };

      if (this.Config.settings.hideMotesMod && event.source !== this.gameId) {
        return false;
      }
    }
  }

  handleDespawnDropItem(event) {
    if (this.motes[event.gameId]) {
      if (
        this.Config.settings.hideMotesMod &&
        this.motes[event.gameId].source !== this.gameId
      ) {
        delete this.motes[event.gameId];
        return false;
      }
      delete this.motes[event.gameId];
    }
  }

  hideMotes() {
    Object.keys(this.motes).forEach((mote) => {
      if (this.motes[mote].source === this.gameId) return;
      this.mod.send("S_DESPAWN_DROPITEM", "*", {
        gameId: this.motes[mote].gameId,
      });
    });
  }

  showMotes() {
    Object.keys(this.motes).forEach((mote) => {
      if (this.motes[mote].source === this.gameId) return;
      this.mod.send("S_SPAWN_DROPITEM", "*", this.motes[mote]);
    });
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      default:
        if (!this.Config.settings.hideMotesMod) this.hideMotes();
        else this.showMotes();
        this.toggleEnabledSettings("hideMotesMod");
        this.cmdMsg(
          `All motes are now ${
            this.Config.settings.hideMotesMod ? "hidden" : "visible"
          }.`
        );
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">HideMotesMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle Hide Motes Mod.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = HideMotesMod;
