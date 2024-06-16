const BaseMod = require("./base");

class AutoLootMod extends BaseMod {
  static Version = 1;

  static Name = "loot";
  Description = "Automatically loot items within a certain radius";

  Hooks = {};
  Commands = null;
  EventListeners = {};
  interval = 30;
  throttleMax = 45;
  scanInterval = 60;
  radius = 180;
  location = null;
  items = new Map();
  lootTimeout = null;

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_RETURN_TO_LOBBY: {
        version: "*",
        handler: () => this.items.clear(),
      },
      S_SPAWN_ME: {
        version: "*",
        handler: (event) => {
          this.location = event.loc;
        },
      },
      C_PLAYER_LOCATION: {
        version: "*",
        handler: (event) => {
          this.location = event.loc;
        },
      },
      S_SYSTEM_MESSAGE: {
        version: "*",
        handler: (event) => {
          if (event.message === "@41") return false;
        },
      },
      C_TRY_LOOT_DROPITEM: {
        version: "*",
        handler: () => {
          if (this.Config.settings.autoLootEnabled && !this.lootTimeout) {
            this.lootTimeout = this.mod.setTimeout(
              this.tryLoot.bind(this),
              this.interval
            );
          }
        },
      },
      S_DESPAWN_DROPITEM: {
        version: "*",
        handler: (event) => {
          this.items.delete(event.gameId);
        },
      },
      S_SPAWN_DROPITEM: {
        version: "*",
        handler: (event) => {
          if (
            (event.item < 8000 || event.item > 8024) &&
            event.owners.some((owner) => owner === this.mod.game.me.playerId)
          ) {
            this.items.set(event.gameId, { ...event, priority: 0 });
            if (this.Config.settings.autoLootEnabled && !this.lootTimeout) {
              this.tryLoot();
            }
          }
        },
      },
    };

    this.EventListeners = {
      change_zone: () => this.items.clear(),
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
      case "auto":
        this.toggleEnabledSettings("autoLootEnabled");
        break;
      default:
        this.toggleEnabledSettings("quickLootEnabled");
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">AutoLootMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">auto</font>: Toggle Auto Loot.
<font color="#56B4E9">[any other key]</font>: Toggle Quick Loot.`;
    this.cmdMsg(helpMessage);
  }

  tryLoot() {
    this.mod.clearTimeout(this.lootTimeout);
    this.lootTimeout = null;
    if (!this.items.size || !this.mod.game.me || this.mod.game.me.mounted)
      return;
    for (let item of [...this.items.values()].sort(
      (a, b) => a.priority - b.priority
    )) {
      if (this.location.dist3D(item.loc) <= this.radius) {
        this.mod.send("C_TRY_LOOT_DROPITEM", "*", { gameId: item.gameId });
        this.lootTimeout = this.mod.setTimeout(
          this.tryLoot.bind(this),
          Math.min(this.interval * ++item.priority, this.throttleMax)
        );
        return;
      }
    }
    if (this.Config.settings.autoLootEnabled) {
      this.mod.setTimeout(this.tryLoot.bind(this), this.scanInterval);
    }
  }
}

module.exports = AutoLootMod;
