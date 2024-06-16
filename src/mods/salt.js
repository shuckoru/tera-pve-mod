const BaseMod = require("./base");

class SaltRemoverMod extends BaseMod {
  static Version = 1;

  static Name = "salt";

  Description = "Removes various system messages to reduce annoyance";

  Hooks = {};
  Commands = null;
  smtList = {
    SMT_GACHA_REWARD: true,
    SMT_MAX_ENCHANT_SUCCEED: true,
    SMT_PREMIUMCOMPOSE_REWARD: true,
    SMT_SKILL_FAIL_CATEGORY: true,
    SMT_ITEM_USED: true,
    SMT_ITEM_DELETED: true,
    SMT_CONVERT_EVENT_SEED_SUCCESS: true,
    SMT_CONVERT_EVENT_SEED_FAIL: true,
    SMT_ENCHANT_FAILED: true,
    SMT_BATTLE_PARTY_DIE: true,
    SMT_BATTLE_PARTY_RESURRECT: true,
    SMT_CANNOT_TAKE_EQUIPMENT_EXP: true,
    SMT_BAN_PARTY_PARTYPLAYER_BF_FAIL: true,
    SMT_HUNTINGZONE_EVENT_ANNOUNCE: true,
    SMT_GOLDENBELL_MESSAGE: true,
    SMT_FISHING_REWARD: true,
    SMT_GQUEST_NORMAL_ACCEPT: true,
    SMT_GQUEST_NORMAL_COMPLETE: true,
    SMT_GQUEST_NORMAL_FAIL_OVERTIME: true,
    SMT_GQUEST_NORMAL_END_NOTICE: true,
    SMT_GQUEST_NORMAL_CARRYOUT: true,
    SMT_GQUEST_OCCUPY_ACCEPT: true,
    SMT_GQUEST_OCCUPY_COMPLETE: true,
    SMT_GQUEST_OCCUPY_FAIL_OVERTIME: true,
    SMT_GQUEST_NORMAL_CANCEL: true,
    SMT_GQUEST_FAIL_ACCEPT: true,
  };

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_SYSTEM_MESSAGE: {
        order: Infinity,
        filter: { fake: null },
        handler: (event) => this.handleSystemMessage(event),
      },
      S_ABNORMALITY_FAIL: {
        order: Infinity,
        filter: { fake: null },
        handler: () => this.handleAbnormalityFail(),
      },
      S_CREST_MESSAGE: {
        order: Infinity,
        filter: { fake: null },
        handler: (event) => this.handleCrestMessage(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleSystemMessage(event) {
    if (!this.Config.enabled) return;
    return this.smtList[this.mod.parseSystemMessage(event.message).id]
      ? false
      : undefined;
  }

  handleAbnormalityFail() {
    return this.Config.enabled ? false : undefined;
  }

  handleCrestMessage(event) {
    if (event.type !== 6) return;
    return this.Config.enabled ? false : undefined;
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
    const helpMessage = `<font color="#56B4E9">SaltRemoverMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">[any other key]</font>: Toggle Salt Remover.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = SaltRemoverMod;
