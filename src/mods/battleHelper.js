const BaseMod = require("./base");
const { updateModConfig } = require("../config");

class BattleHelper extends BaseMod {
  static Version = 1;

  static Name = "bhelper";
  Description = "Ethical utilities for fighting bosses";

  DebugMode = false;

  PartyMessageChannel = 1;

  constructor(mod, config) {
    super(mod, config);
    this.Hooks = {
      S_DUNGEON_EVENT_MESSAGE: {
        version: "*",
        handler: (event) => this.handleDngEventMsg(event),
      },
      S_QUEST_BALLOON: {
        version: "*",
        handler: (event) => this.handleQuestBaloon(event),
      },
    };
    this.Commands = async (key, value) => this.handleCommand(key, value);
  }

  justLogIt(event) {
    console.log(event);
  }

  async sendMsg(msg) {
    if (!msg || msg == "") return;

    if (this.Config?.settings?.sendToParty)
      await this.mod.send("C_CHAT", "*", {
        channel: this.PartyMessageChannel,
        message: `(B) ${msg}`,
      });
    else this.cmdMsg(`(B) ${msg}`);
  }

  async handleDngEventMsg(event) {
    if (!this.Config.enabled) return;
    const msgId = event.message.split(":")[1];

    const notWhitelisted =
      this.Config.settings.whitelistedMessages?.indexOf(Number(msgId)) == -1;

    if (this.DebugMode)
      this.cmdMsg(
        `Message ID: ${msgId}${notWhitelisted ? "" : " (whitelisted)"}`
      );

    if (notWhitelisted) return;

    const result = await this.mod.queryData(
      "/StrSheet_Dungeon/String@id=?/",
      [Number(msgId)],
      false,
      false,
      ["string"]
    );
    const textMessageFromBoss = result?.attributes.string;

    this.sendMsg(textMessageFromBoss);
  }

  async handleQuestBaloon(event) {
    if (!this.Config.enabled) return;

    const regex = /^\d+/;
    const msgId = event.message.split(":")[1].match(regex)[0];

    const notWhitelisted =
      this.Config.settings.whitelistedMessages?.indexOf(Number(msgId)) == -1;

    if (this.DebugMode)
      this.cmdMsg(
        `Message ID: ${msgId}${notWhitelisted ? "" : " (whitelisted)"}`
      );

    if (notWhitelisted) return;

    const result = await this.mod.queryData(
      "/StrSheet_MonsterBehavior/String@id=?/",
      [Number(msgId)],
      false,
      false,
      ["msg"]
    );
    const textMessageFromBoss = result?.attributes.msg;

    this.sendMsg(textMessageFromBoss);
  }

  async handleCommand(key, value) {
    switch (key) {
      case "msg":
        if (!value) {
          this.cmdMsg(
            "This command requires a msg ID. To find it enabled debug mode."
          );
          return;
        }
        if (value in this.Config.settings.whitelistedMessages) {
          this.Config.settings.whitelistedMessages =
            this.Config.settings.whitelistedMessages.filter(
              (msgId) => Number(msgId) != Number(value)
            );
          this.cmdMsg(`Removed ${value} from whitelisted messages.`);
        } else {
          this.Config.settings.whitelistedMessages[value] = 1;
          this.cmdMsg(`Added ${value} to whitelisted messages.`);
        }
        break;
      case "debug":
        this.DebugMode = !this.DebugMode;
        this.cmdMsg(
          `${this.constructor.Name} debug mode: ${
            this.DebugMode ? "ena" : "disa"
          }bled!`
        );
        break;
      case "party":
        this.toggleEnabledSettings("sendToParty");
        break;
      case "default":
        this.resetConfigToDefault();
        break;
      case "help":
        this.showHelp();
        console.log(this.Config.settings.whitelistedMessages);
        break;
      default:
        this.toggleEnableMod();
        break;
    }
    updateModConfig(this.constructor.Name, this.Config);
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">Battle Helper Commands:</font>
<font color="#56B4E9">party</font>: Toggle party chat relay.
<font color="#56B4E9">msg [msgId]</font>: Add/remove msg from whitelist.
<font color="#56B4E9">debug</font>: Toggle debug mode (default disabled).
<font color="#56B4E9">default</font>: Reset config to default.
<font color="#56B4E9">help</font>: Show this message.
<font color="#56B4E9">[any other key]</font>: Enable/disable mod.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = BattleHelper;
