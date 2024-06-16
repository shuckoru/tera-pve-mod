const BaseMod = require("./base");

class SkillResetsMod extends BaseMod {
  static Version = 1;

  static Name = "sresets";
  Description = "Toggle skill resets and related settings";

  Hooks = {};
  Commands = null;
  warnTimeout = 15000;
  lastReset = { time: null, icon: null };
  iconsData = new Map();

  constructor(mod, config) {
    super(mod, config);

    this.mod.game.on("enter_game", () => {
      this.iconsData.clear();
      this.loadIconData();
    });

    this.Hooks = {
      S_CREST_MESSAGE: {
        version: "*",
        position: -9999999,
        handler: (event) => this.handleCrestMessage(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  async loadIconData() {
    const res = await this.mod.queryData(
      "/SkillIconData/Icon@class=?/",
      [this.mod.game.me.class],
      true,
      false,
      ["skillId", "iconName"]
    );
    res.forEach((icon) => {
      this.iconsData.set(icon.attributes.skillId, icon.attributes.iconName);
      this.iconsData.set(
        this.getSkillBase(icon.attributes.skillId),
        icon.attributes.iconName
      );
    });
  }

  getSkillBase(skill) {
    return Math.floor(skill / 10000);
  }

  handleCrestMessage({ type, skill }) {
    if (type != 6 || !this.mod.game.me.inDungeon || !this.Config.enabled)
      return;

    const {
      skillsResetShowSystemResetMsg,
      skillsResetMsgStyle,
      skillsResetPlaySound,
      skillsResetSoundId,
      skillsResetFontColor,
    } = this.Config.settings;

    let icon =
      this.iconsData.get(skill) || this.iconsData.get(this.getSkillBase(skill));
    if (
      this.lastReset.icon !== icon ||
      (this.lastReset.icon === icon &&
        Date.now() - this.lastReset.time > this.warnTimeout)
    ) {
      this.lastReset.icon = icon;
      this.lastReset.time = Date.now();
      this.mod.send("S_CUSTOM_STYLE_SYSTEM_MESSAGE", "*", {
        message: `<img src="img://__${icon}" width="48" height="48" vspace="-20"/><font size="24" color="${skillsResetFontColor}">&nbsp;Reset</font>`,
        style: skillsResetMsgStyle,
      });
    }
    if (skillsResetPlaySound)
      this.mod.send("S_PLAY_SOUND", "*", { SoundID: skillsResetSoundId });

    return skillsResetShowSystemResetMsg;
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      case "re":
        this.iconsData.clear();
        this.loadIconData().then(() => {
          this.cmdMsg("Icon Data reloaded for skills resets.");
        });
        break;
      default:
        this.toggleEnableMod();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">SkillResetsMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">re</font>: Reload Icon Data.
<font color="#56B4E9">[any other key]</font>: Toggle Skill Resets.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = SkillResetsMod;
