const BaseMod = require("./base");

class SmolDmgMod extends BaseMod {
  static Version = 1;

  static Name = "smoldmg";
  Description = "Reduce damage numbers for readability";

  Hooks = {};
  Commands = null;
  EventListeners = {};
  players = {};

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_SPAWN_USER: {
        raw: true,
        handler: (event) => (this.players[event.gameId] = true),
      },
      S_DESPAWN_USER: {
        raw: true,
        handler: (event) => delete this.players[event.gameId],
      },
      S_EACH_SKILL_RESULT: {
        position: 100,
        handler: (event) => this.handleSkillResult(event),
      },
    };

    this.EventListeners = {
      leave_loading_screen: () => (this.players = {}),
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleSkillResult(event) {
    if (!this.Config.enabled) return;
    if (this.mod.game.me.level < 65) return;
    if (
      this.mod.game.me.gameId === event.source ||
      this.mod.game.me.gameId === event.owner
    ) {
      let smolDmg = 0;
      if (this.players[event.target] !== undefined)
        smolDmg = Number(event.value) / 1;
      else smolDmg = Number(event.value) / 1000000;
      if (smolDmg < 1) smolDmg = 1;
      event.value = BigInt(Math.floor(smolDmg));
      return true;
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
    this.cmdMsg(`<font color="#56B4E9">SmolDmgMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle Smol Damage Mod.`);
  }
}

module.exports = SmolDmgMod;
