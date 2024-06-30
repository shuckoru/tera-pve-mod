const path = require("path");
const BaseMod = require("./base");
const { updateModConfig } = require("../config");

class Servant {
  constructor(info) {
    this.ID = Number(info.id);
    this.UniqueID = Number(info.dbid);
    this.Name = info.name;
  }
  stringify() {
    return {
      name: this.Name,
      id: this.ID.toString(),
      dbid: this.UniqueID.toString(),
    };
  }
}

class AutoPetMod extends BaseMod {
  static Version = 1;
  static Name = "pet";
  Description =
    "Automatically manage your pet, including summoning and feeding.";

  constructor(mod, config) {
    super(mod, config);

    mod.game.initialize("inventory");

    mod.command.remove("pet");
    mod.command.add("pet", {
      save: () => {
        if (this.newServant) {
          this.saveServant();
        } else {
          this.cmdMsg("You must summon a pet first before you can save it.");
        }
      },
      feed: (arg) => {
        const n = Number(arg);
        if (isNaN(n) || n >= 100 || n < 0) {
          this.cmdMsg("Pet Stamina % must be set between 1 and 99.");
        } else {
          this.Config.settings.feedWhenBelow = n;
          updateModConfig(this.constructor.Name, this.Config);
          this.cmdMsg(
            `Auto feed is now set to <font color="#5da8ce">${n}%</font>`
          );
        }
      },
      $none: () => {
        this.toggleEnableMod();
      },
    });

    this.Hooks = {
      C_PLAYER_LOCATION: {
        handler: (event) => {
          this.playerLoc = event.loc;
          this.playerW = event.w;
        },
      },
      S_REQUEST_DESPAWN_SERVANT: {
        handler: (event) => {
          if (event.gameId === this.petGameId) {
            this.petSummoned = false;
            this.petGameId = null;
            this.newServant = null;
          }
        },
      },
      S_REQUEST_SPAWN_SERVANT: {
        handler: (event) => {
          if (mod.game.me.is(event.ownerId)) {
            this.newServant = new Servant(event);
            this.petSummoned = true;
            this.petGameId = event.gameId;
            if (
              this.mainServant == null ||
              this.newServant.ID != this.mainServant.ID
            ) {
              this.cmdMsg(
                `Use 'pet save' to save <font color="#30e785">"${event.name}"</font> as your default pet`
              );
            }
          }
        },
      },
      S_UPDATE_SERVANT_INFO: {
        handler: (event) => {
          if (this.mainServant && event.dbid == this.mainServant.UniqueID) {
            const energy = (event.energy / 300) * 100;
            if (
              this.Config.enabled &&
              this.petSummoned &&
              !mod.game.me.inCombat &&
              energy <= this.Config.settings.feedWhenBelow
            ) {
              this.feedPet();
            }
          }
        },
      },
      S_VISIT_NEW_SECTION: {
        handler: () => {
          const key = `${mod.game.me.serverId}_${mod.game.me.playerId}`;
          const playerPet = this.Config.settings.pets[key];
          if (playerPet != undefined) {
            this.mainServant = new Servant(playerPet);
          }
          if (this.mainServant && !this.petSummoned && this.Config.enabled) {
            this.summonPet();
          }
        },
      },
    };

    mod.game.me.on("resurrect", () => {
      if (this.Config.enabled && this.mainServant && !this.petSummoned) {
        this.summonPet();
      }
    });
  }

  summonPet() {
    this.mod.send("C_REQUEST_SPAWN_SERVANT", "*", {
      servantId: this.mainServant.ID,
      uniqueId: this.mainServant.UniqueID,
      unk: 0,
    });
  }

  saveServant() {
    const key = `${this.mod.game.me.serverId}_${this.mod.game.me.playerId}`;
    this.Config.settings.pets[key] = this.newServant.stringify();
    updateModConfig(this.constructor.Name, this.Config);
    this.cmdMsg(
      `Saved <font color="#30e785">"${this.newServant.Name}"</font> as your default pet.`
    );
    this.mainServant = this.newServant;
  }

  feedPet() {
    const foods = this.Config.settings.petFood;
    let foodFound = false;
    foods.forEach((item) => {
      const foodItem = this.mod.game.inventory.findInBagOrPockets(item.id);
      if (foodItem) {
        foodFound = true;
        this.mod.send("C_USE_ITEM", "*", {
          gameId: this.mod.game.me.gameId,
          id: foodItem.id,
          dbid: foodItem.dbid,
          target: 0,
          amount: 1,
          dest: 0,
          loc: this.playerLoc,
          w: this.playerW,
          unk1: 0,
          unk2: 0,
          unk3: 0,
          unk4: true,
        });
        return;
      }
    });
    if (!foodFound) {
      this.cmdMsg("You don't have any pet food in inventory!");
    }
  }
}

module.exports = AutoPetMod;
