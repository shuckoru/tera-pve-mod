const BaseMod = require("./base");

const Messages = {
  CannotYarmWhileDead: `<font color="#ff8080">You cannot YARM while dead.</font>`,
  CannotYarmWhileInCombat: `<font color="#ff8080">You cannot YARM while in combat.</font>`,
  NotEnoughCharacters: (info) =>
    `<font color="#ff8080">Not enough characters to populate your argument ${info}.</font>`,
  CharacterDoesNotExist: (info) =>
    `<font color="#ff8080">The character you provided (<font color="#ffbf80">${info}</font>) does not exist.</font>`,
  UnknownError: `<font color="#ff8080">Unknown error.</font>`,
  CharacterListMessage: (i, hue, basevalue, name, className) =>
    `<font color="${hue}"><ChatLinkAction param="1#####${basevalue}@-1@Hail">[Relog]</ChatLinkAction></font> <font color="#9f80ff">${i}</font><font color="#999999"> : </font><font color="#bf80ff">${name}</font> <font color="#df80ff"><font color="#999999">(</font>${className}<font color="#999999">)</font></font>`,
  HelpMessage: `<font color="#999999">{</font> <font color="#9f80ff">Yet Another Relog Mod <font color="#999999">==></font> Command Pane</font> <font color="#999999">}</font>
  <font color="#9f80ff">relog</font> <font color="#bf80ff">(name)</font> <font color="#999999">:</font> <font color="#ffffff">Relogs to the character with your given name.</font>
  <font color="#9f80ff">relog</font> <font color="#bf80ff">[nx <font color="#999999">||</font> + <font color="#999999">||</font> f] </font><font color="#999999">:</font> <font color="#ffffff">Relogs you to the next character in your list.</font>
  <font color="#9f80ff">relog</font> <font color="#bf80ff">[pv <font color="#999999">||</font> - <font color="#999999">||</font> b] </font><font color="#999999">:</font> <font color="#ffffff">Relogs you to the previous character in your list.</font>`,
};

class YARMMod extends BaseMod {
  static Version = 1;

  static Name = "relog";
  Description = "Yet Another Relog Mod";

  Hooks = {};
  Commands = null;
  EventListeners = {};
  modbase = 541;
  modsub = 70000;
  modsig = this.modbase.toString() + this.modsub.toString();
  hueArray = [
    "#ffb3b3",
    "#ffc6b3",
    "#ffd9b3",
    "#ffecb3",
    "#ffffb3",
    "#ecffb3",
    "#d9ffb3",
    "#c6ffb3",
    "#b3ffb3",
    "#b3ffc6",
    "#b3ffd9",
    "#b3ffec",
    "#b3ffff",
    "#b3ecff",
    "#b3d9ff",
    "#b3c6ff",
    "#b3b3ff",
    "#c6b3ff",
    "#d9b3ff",
    "#ecb3ff",
    "#ffb3ff",
    "#ffb3ec",
    "#ffb3d9",
    "#ffb3c6",
  ];
  classes = [
    "Warrior",
    "Lancer",
    "Slayer",
    "Berserker",
    "Sorcerer",
    "Archer",
    "Priest",
    "Mystic",
    "Reaper",
    "Gunner",
    "Brawler",
    "Ninja",
    "Valkyrie",
  ];
  basevalue = this.modsig - 1;
  cindex = -1;
  characters = [];

  constructor(mod, config) {
    super(mod, config);
    this.mod.command.remove(["relog", "yarm"]);
    this.mod.command.add(["relog", "yarm"], this.handleCommand.bind(this));
    this.initializeHooks();
  }

  initializeHooks() {
    this.Hooks = {
      C_REQUEST_NONDB_ITEM_INFO: {
        version: "*",
        handler: this.handleRequestNonDBItemInfo.bind(this),
      },
      S_GET_USER_LIST: {
        version: this.mod.majorPatchVersion >= 95 ? 18 : 17,
        handler: this.handleGetUserList.bind(this),
      },
      C_SELECT_USER: {
        version: "*",
        order: 100,
        filter: { fake: null },
        handler: this.handleSelectUser.bind(this),
      },
    };
  }

  handleCommand(arg) {
    if (!this.mod.game.me.alive)
      return this.cmdMsg(Messages.CannotYarmWhileDead);
    if (this.mod.game.me.inCombat)
      return this.cmdMsg(Messages.CannotYarmWhileInCombat);

    if (arg) {
      if (["nx", "+", "++"].includes(arg)) return this.relog("+");
      if (["pv", "-", "--"].includes(arg)) return this.relog("-");
      const index = parseInt(arg);
      if (!isNaN(index)) {
        if (index > this.characters.length) {
          return this.cmdMsg(Messages.NotEnoughCharacters(index));
        }
        this.cindex = index - 1;
        return this.relog();
      }
      if (this.charindex(arg)) return this.relog();
      this.showHelp();
      return this.cmdMsg(Messages.CharacterDoesNotExist(arg));
    } else {
      this.printCharacters();
    }
  }

  handleRequestNonDBItemInfo(e) {
    if (e.item <= this.modsig + 99 && e.item >= this.modsig) {
      this.basevalue = this.modsig - 1;
      process.nextTick(() => {
        if (e.item > 0) {
          this.mod.command.exec(`relog ${e.item - this.basevalue}`);
        }
      });
      return false;
    }
  }

  handleGetUserList(e) {
    e.characters.forEach((ch) => {
      this.characters[--ch.position] = {
        id: ch.id,
        name: ch.name,
        class: ch.class,
      };
    });
  }

  handleSelectUser(e) {
    this.cindex = this.characters.findIndex((ch) => ch.id === e.id);
  }

  charindex(name) {
    const res = this.characters.findIndex(
      (ch) => ch.name.toLowerCase() === name.toLowerCase()
    );
    if (res >= 0) {
      this.cindex = res;
      return true;
    }
    return false;
  }

  relog(arg) {
    if (arg) {
      if (arg === "+") {
        if (!this.characters[++this.cindex]) this.cindex = 0;
      }
      if (arg === "-") {
        if (!this.characters[--this.cindex]) this.cindex = 0;
      }
      return this.relog();
    }
    const id = this.characters[this.cindex].id;
    let prepareLobbyHook, lobbyHook;
    this.mod.send("C_RETURN_TO_LOBBY", "*", {});
    prepareLobbyHook = this.mod.hookOnce(
      "S_PREPARE_RETURN_TO_LOBBY",
      "*",
      () => {
        this.mod.send("S_RETURN_TO_LOBBY", "*", {});
        lobbyHook = this.mod.hookOnce("S_RETURN_TO_LOBBY", "*", () => {
          setImmediate(() => {
            this.mod.send("C_SELECT_USER", "*", { id: id, unk: 0 });
          });
        });
      }
    );
    setTimeout(() => {
      for (const hook of [prepareLobbyHook, lobbyHook]) {
        if (hook) this.mod.unhook(hook);
      }
    }, 16000);
  }

  printCharacters() {
    this.basevalue = this.modsig - 1;
    this.characters.forEach((ch, i) => {
      this.basevalue += 1;
      this.cmdMsg(
        Messages.CharacterListMessage(
          i + 1,
          this.hueArray[i],
          this.basevalue,
          ch.name,
          this.classes[ch.class]
        )
      );
    });
  }

  showHelp() {
    this.cmdMsg(Messages.HelpMessage);
  }
}

module.exports = YARMMod;
