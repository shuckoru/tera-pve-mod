const { updateModConfig } = require("../config");
const BaseMod = require("./base");

class AbnormsHideMod extends BaseMod {
  static Version = 1;
  static Name = "abhide";
  Description = "Hide certain abnormalities based on configuration";

  DebugMode = false;
  HealerClasses = new Set(["priest", "elementalist"]);
  abnormalitiesNames = {};

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_ABNORMALITY_BEGIN: {
        position: 999,
        handler: (event) => this.handleAbnormality(event),
      },
      S_ABNORMALITY_REFRESH: {
        position: 999,
        handler: (event) => this.handleAbnormality(event),
      },
    };

    this.Commands = async (key, value) => this.handleCommand(key, value);
  }

  handleAbnormality(event) {
    if (!this.Config.enabled) return;

    const { excludeHealers, excludedClasses } =
      this.Config.settings.blacklisted[event.id] || {};

    const IAmHealer = this.HealerClasses.has(this.mod.game.me.class);
    const shouldSkipCozHealer = excludeHealers && IAmHealer;
    const myClassIsExcluded = excludedClasses
      ? this.mod.game.me.class in excludedClasses
      : false;

    if (
      event.id in this.Config.settings.blacklisted &&
      !myClassIsExcluded &&
      !shouldSkipCozHealer
    )
      return false;

    if (this.DebugMode && this.abnormalitiesNames[event.id])
      this.cmdMsg(`name: ${this.abnormalitiesNames[event.id]} id: ${event.id}`);
  }

  async handleCommand(key, value) {
    if (JSON.stringify(this.abnormalitiesNames) == "{}")
      await this.extractAbnormNames();

    const abnormId = value || null;
    switch (key) {
      case "help":
        this.showHelp();
        break;
      case "excludehealers":
        this.toggleExcludeHealers(abnormId);
        break;
      case "excludeclass":
        this.toggleExcludeClass(abnormId);
        break;
      case "add":
        this.addAbnormality(abnormId);
        break;
      case "remove":
        this.removeAbnormality(abnormId);
        break;
      case "debug":
        this.DebugMode = !this.DebugMode;
        this.cmdMsg(`abhide debug: ${this.DebugMode ? "ena" : "disa"}bled`);
        break;
      case "reset":
        this.Config.settings.blacklisted = {};
        this.cmdMsg(
          "Blacklisted abnormalities reset to default. Restart the game to see effects."
        );
        break;
      default:
        this.toggleEnableMod();
        break;
    }
    updateModConfig(this.constructor.Name, this.Config);
  }

  showHelp() {
    this.cmdMsg(`<font color="#56B4E9">AbnormsHideMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">add [abnormalityId]</font>: Add an abnormality to the blacklist.
<font color="#56B4E9">remove [abnormalityId]</font>: Remove an abnormality from the blacklist.
<font color="#56B4E9">excludehealers [abnormalityId]</font>: Toggle healer exclusion for the specified abnormality.
<font color="#56B4E9">excludeclass [abnormalityId]</font>: Exclude your class from the specified abnormality.
<font color="#56B4E9">debug</font>: Toggle abnormalities debug mode.
<font color="#56B4E9">[any other key]</font>: Toggle Abnormalities Hide Mod.`);
  }

  toggleExcludeHealers(id) {
    if (!(id in this.Config.settings.blacklisted)) {
      this.cmdMsg(
        `<font color="#FF0000">Error:</font> Abnormality ID ${id} is not in the blacklist.`
      );
      return;
    }

    if (typeof this.Config.settings.blacklisted[id] === "string")
      this.Config.settings.blacklisted[id] =
        this.getNewBlacklistedAbnormality(id);

    const blacklistedAbnorm = this.Config.settings.blacklisted[id];

    blacklistedAbnorm.excludeHealers = !blacklistedAbnorm.excludeHealers;

    this.cmdMsg(
      `<font color="#00FF00">Success:</font> Abnormality ID ${id} is now ${
        blacklistedAbnorm.excludeHealers ? "whitelisted" : "blacklisted"
      } for healers.`
    );
  }

  toggleExcludeClass(id) {
    if (!(id in this.Config.settings.blacklisted)) {
      this.cmdMsg(
        `<font color="#FF0000">Error:</font> Abnormality ID ${id} is not in the blacklist.`
      );
      return;
    }

    if (typeof this.Config.settings.blacklisted[id] === "string")
      this.Config.settings.blacklisted[id] =
        this.getNewBlacklistedAbnormality(id);

    const blacklistedAbnorm = this.Config.settings.blacklisted[id];

    if (this.mod.game.me.class in blacklistedAbnorm.excludedClasses) {
      this.cmdMsg(
        `<font color="#FF0000">Error:</font> Class ${this.mod.game.me.class} is already excluded for Abnormality ID ${id}.`
      );
      return;
    }

    blacklistedAbnorm.excludedClasses[this.mod.game.me.class] = Date.now();
    this.cmdMsg(
      `<font color="#00FF00">Success:</font> Class ${this.mod.game.me.class} is now excluded for Abnormality ID ${id}.`
    );
  }

  getNewBlacklistedAbnormality(id) {
    return {
      name: this.abnormalitiesNames[id],
      excludeHealers: false,
      excludedClasses: {},
    };
  }

  addAbnormality(id) {
    if (!id) {
      this.cmdMsg(
        '<font color="#FF0000">Error:</font> You must provide an abnormality ID to add.'
      );
      return;
    }

    if (id in this.Config.settings.blacklisted) {
      this.cmdMsg(
        `<font color="#FF0000">Error:</font> Abnormality ID ${id} is already in the blacklist.`
      );
      return;
    }

    this.Config.settings.blacklisted[id] =
      this.getNewBlacklistedAbnormality(id);
    this.cmdMsg(
      `<font color="#00FF00">Success:</font> Abnormality ID ${id} Name ${this.abnormalitiesNames[id]} added to the blacklist.`
    );
  }

  removeAbnormality(id) {
    if (!id) {
      this.cmdMsg(
        '<font color="#FF0000">Error:</font> You must provide an abnormality ID to remove.'
      );
      return;
    }

    if (!(id in this.Config.settings.blacklisted)) {
      this.cmdMsg(
        `<font color="#FF0000">Error:</font> Abnormality ID ${id} is not in the blacklist.`
      );
      return;
    }

    delete this.Config.settings.blacklisted[id];
    this.cmdMsg(
      `<font color="#00FF00">Success:</font> Abnormality ID ${id} removed from the blacklist.`
    );
  }

  async extractAbnormNames() {
    const results = await this.mod.queryData(
      "/StrSheet_Abnormality/String/",
      [],
      true
    );
    results.forEach((item) => {
      this.abnormalitiesNames[item.attributes.id] = item.attributes.name;
    });
  }
}

module.exports = AbnormsHideMod;
