const BaseMod = require("./base");

class AutoCutSceneMod extends BaseMod {
  static Version = 1;

  static Name = "csskip";
  Description = "Toggle automatic skipping of cutscenes";

  Hooks = {};
  Commands = null;

  constructor(mod, config) {
    super(mod, config);

    if (mod.majorPatchVersion >= 105) {
      mod.warn(
        "Deprecated. please refer to the in-game option to toggle cutscene."
      );
      return;
    }

    this.Hooks = {
      S_PLAY_MOVIE: {
        handler: (event) => this.handlePlayMovie(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handlePlayMovie(event) {
    if (this.Config.settings.skipCutSceneEnabled) {
      this.mod.send("C_END_MOVIE", "*", { ...event, unk: 1 });
      return false;
    }
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
    const helpMessage = `<font color="#56B4E9">AutoCutSceneMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle Skip Cut Scene.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = AutoCutSceneMod;
