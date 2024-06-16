const BaseMod = require("./base");

class NpcAnywhereMod extends BaseMod {
  static Version = 1;

  static Name = "npc";
  Description = "Access various NPC functionalities from anywhere";

  Hooks = {};
  Commands = null;
  CONTRACTS = {
    bank: {
      type: 26,
      unk2: 0,
      unk3: 0,
      unk4: 1,
      name: "",
      data: Buffer.from([1, 0, 0, 0]),
    },
    gbank: {
      type: 26,
      unk2: 0,
      unk3: 0,
      unk4: 3,
      name: "",
      data: Buffer.from([3, 0, 0, 0]),
    },
    petbank: {
      type: 26,
      unk2: 0,
      unk3: 0,
      unk4: 9,
      name: "",
      data: Buffer.from([9, 0, 0, 0]),
    },
    wardrobe: {
      type: 26,
      unk2: 0,
      unk3: 0,
      unk4: 12,
      name: "",
      data: Buffer.from([12, 0, 0, 0]),
    },
  };

  constructor(mod, config) {
    super(mod, config);

    Object.keys(this.CONTRACTS).forEach((key) => {
      this.addCommand(key, this.CONTRACTS[key]);
    });

    this.addCommand("broker", null, () => {
      this.mod.toClient("S_NPC_MENU_SELECT", "*", { type: 28 });
    });

    this.addCommand("contact", null, (gameId) => {
      try {
        gameId = BigInt(gameId);
      } catch (e) {
        gameId = 0n;
      }
      if (gameId) {
        this.cmdMsg(`Trying to contact NPC with ID: ${gameId}`);
        this.mod.toServer("C_NPC_CONTACT", "*", { gameId });
      } else {
        this.mod.hookOnce("C_NPC_CONTACT", "*", (event) => {
          this.cmdMsg(`Contacted NPC with ID: ${event.gameId}`);
        });
      }
    });

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  addCommand(name, contract, callback) {
    this.mod.command.remove(name);
    this.mod.command.add(
      name,
      callback ||
        (() => {
          this.mod.toServer("C_REQUEST_CONTRACT", "*", contract);
        })
    );
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      default:
        this.cmdMsg("Unknown command");
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">NpcAnywhereMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle NPC functionalities.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = NpcAnywhereMod;
