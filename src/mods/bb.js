const BaseMod = require("./base");

class AntiBodyBlockMod extends BaseMod {
  static Version = 1;

  static Name = "bb";
  Description =
    "Toggle anti-bodyblock to prevent party members from blocking each other";

  Hooks = {};
  Commands = null;
  EventListeners = {};
  Interval = null;

  constructor(mod, config) {
    super(mod, config);

    this.partyMembers = new Set();
    this.cache = Object.create(null);
    this.partyObj = Object.create(null);
    this.partyObj.unk4 = 1;

    if (this.Config.enabled) {
      this.Interval = this.mod.setInterval(() => this.removeBodyBlock(), 5000);
    }

    this.Hooks = {
      S_PARTY_INFO: {
        handler: (evt) => this.handlePartyInfo(evt),
      },
      S_PARTY_MEMBER_LIST: {
        handler: (evt) => this.handlePartyMemberList(evt),
      },
    };

    this.EventListeners = {
      enter_game: () => {
        if (this.Config.enabled) {
          this.Interval = this.mod.setInterval(
            () => this.removeBodyBlock(),
            5000
          );
        }
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  removeBodyBlock() {
    for (let i = this.partyMembers.values(), step; !(step = i.next()).done; ) {
      this.partyObj.leader = step.value;
      this.partyObj.unk1 = this.cache.unk1;
      this.partyObj.unk2 = this.cache.unk2;
      this.partyObj.unk3 = this.cache.unk3;
      this.mod.send("S_PARTY_INFO", "*", this.partyObj);
    }
  }

  handlePartyInfo(evt) {
    Object.assign(this.cache, evt);
  }

  handlePartyMemberList(evt) {
    this.partyMembers.clear();
    for (const member of evt.members) {
      if (member.online) {
        this.partyMembers.add(member.gameId);
      }
    }
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      default:
        this.toggleEnableMod();
        if (this.Config.enabled) {
          this.Interval = this.mod.setInterval(
            () => this.removeBodyBlock(),
            5000
          );
        } else {
          this.mod.clearInterval(this.Interval);
        }
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">AntiBodyBlockMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle Anti-BodyBlock Mod.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = AntiBodyBlockMod;
