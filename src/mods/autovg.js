const BaseMod = require("./base");

class AutoQuestsMod extends BaseMod {
  static Version = 1;

  static Name = "autovg";
  Description = "Automatically completes various quests";

  Hooks = {};
  Commands = null;
  EventListeners = {};

  constructor(mod, config) {
    super(mod, config);

    this.myQuestId = 0;
    this.cleared = 0;
    this.entered = false;
    this.hold = false;
    this.daily = 0;

    this.EventListeners = {
      change_zone: (zone) => {
        if (this.Config.settings.battleground.includes(zone)) {
          this.hold = true;
        } else if (this.hold && this.myQuestId !== 0) {
          this.hold = false;
          this.completeQuest();
          this.dailycredit();
        }
      },
      enter_game: () => {
        this.daily = 0;
      },
    };

    this.Hooks = {
      S_AVAILABLE_EVENT_MATCHING_LIST: {
        version: "*",
        handler: (event) => {
          this.daily = event.unk4weekly = event.unk6;
        },
      },
      S_LOGIN: {
        version: "event",
        handler: () => {
          this.mod.hookOnce("S_SPAWN_ME", "event", () => {
            this.mod.setTimeout(
              this.dailycredit.bind(this),
              1000 + Math.random() * 250
            );
          });
        },
      },
      S_FIELD_EVENT_ON_ENTER: {
        raw: true,
        handler: () => {
          this.entered = true;
        },
      },
      C_RETURN_TO_LOBBY: {
        version: "*",
        handler: () => {
          this.entered = false;
        },
      },
      S_COMPLETE_EVENT_MATCHING_QUEST: {
        version: "*",
        handler: (event) => {
          this.daily++;
          if (this.Config.settings.Vanguard) {
            this.myQuestId = event.id;
            if (!this.hold) {
              this.mod.setTimeout(
                this.completeQuest.bind(this),
                1000 + Math.random() * 250
              );
            }
          }
        },
      },
      S_FIELD_EVENT_PROGRESS_INFO: {
        version: "*",
        handler: () => {
          if (this.Config.settings.Guardian) {
            this.mod.setTimeout(
              this.completeGuardian.bind(this),
              2000 + Math.random() * 250
            );
          }
        },
      },
      S_UPDATE_GUILD_QUEST_STATUS: {
        version: "*",
        handler: (event) => {
          if (this.Config.settings.GQuest) {
            if (event.targets[0].completed == event.targets[0].total) {
              this.mod.setTimeout(() => {
                this.mod.send("C_REQUEST_FINISH_GUILD_QUEST", "*", {
                  quest: event.quest,
                });
              }, 2000 + Math.random() * 1000);
              this.mod.setTimeout(() => {
                this.mod.send("C_REQUEST_START_GUILD_QUEST", "*", {
                  questId: event.quest,
                });
              }, 4000 + Math.random() * 1000);
            }
          }
        },
      },
      S_FIELD_POINT_INFO: {
        version: "*",
        handler: (event) => {
          if (
            this.entered &&
            event.cleared != this.cleared &&
            event.cleared - 1 > event.claimed
          ) {
            this.mod.send("S_CHAT", "*", {
              channel: 21,
              gm: true,
              name: "Guardian Mission",
              message: `${event.cleared} / 40`,
            });
          }
          this.cleared = event.cleared;
        },
      },
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
      case "VG":
        this.toggleSetting("Vanguard", "Auto-Vanguardquest");
        break;
      case "GQ":
        this.toggleSetting("GQuest", "Auto-Guildquest");
        break;
      case "GL":
        this.toggleSetting("Guardian", "Auto-Gardian-Legion");
        break;
      case "DC":
        this.toggleSetting("Daily", "Auto-Daily-Credit");
        break;
      case "VGLog":
        this.toggleSetting("VLog", "Vanguard-Quest Logger");
        break;
      case "UI":
        this.showUI();
        break;
      default:
        this.cmdMsg("Invalid argument. Usage command with 'auto'");
        this.cmdMsg("UI | Show the UI setting");
        this.cmdMsg("VG | Auto-Vanguard");
        this.cmdMsg("GQ | Auto-GuildQuest with relaunch");
        this.cmdMsg("VGLog | Vanguard-Quest-Logger");
        this.cmdMsg("GL | Auto claim box in Guardian legion");
        this.cmdMsg("DL | Auto claim Daily credit");
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">AutoQuestsMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">VG</font>: Toggle Auto-Vanguardquest.
<font color="#56B4E9">GQ</font>: Toggle Auto-Guildquest.
<font color="#56B4E9">GL</font>: Toggle Auto-Gardian-Legion.
<font color="#56B4E9">DC</font>: Toggle Auto-Daily-Credit.
<font color="#56B4E9">VGLog</font>: Toggle Vanguard-Quest Logger.
<font color="#56B4E9">UI</font>: Show the UI setting.`;
    this.cmdMsg(helpMessage);
  }

  toggleSetting(setting, message) {
    this.Config.settings[setting] = !this.Config.settings[setting];
    this.cmdMsg(
      `${message}: ${
        this.Config.settings[setting]
          ? '<font color="#56B4E9">On</font>'
          : '<font color="#E69F00">Off</font>'
      }.`
    );
  }

  completeQuest() {
    this.mod.send("C_COMPLETE_DAILY_EVENT", "*", { id: this.myQuestId });
    this.mod.setTimeout(() => {
      this.mod.send("C_COMPLETE_EXTRA_EVENT", "*", { type: 0 });
    }, 500 + Math.random() * 250);
    this.mod.setTimeout(() => {
      this.mod.send("C_COMPLETE_EXTRA_EVENT", "*", { type: 1 });
    }, 1000 + Math.random() * 250);
    this.myQuestId = 0;
    if (this.Config.settings.VLog) {
      this.report();
    }
  }

  report() {
    if (this.daily < 16) {
      this.cmdMsg(`Daily Vanguard Requests completed: ${this.daily}`);
    } else {
      this.cmdMsg("You have completed all 16 Vanguard Requests today.");
    }
  }

  completeGuardian() {
    this.mod.send("C_REQUEST_FIELD_POINT_REWARD", "*", {});
    this.mod.setTimeout(() => {
      this.mod.send("C_REQUEST_ONGOING_FIELD_EVENT_LIST", "*", {});
    }, 2000 + Math.random() * 500);
  }

  dailycredit() {
    if (this.Config.settings.Daily) {
      const result = this.mod.trySend("C_REQUEST_RECV_DAILY_TOKEN", "*", {});
      if (!result) {
        this.mod.log("Unmapped protocol packet 'C_REQUEST_RECV_DAILY_TOKEN'.");
      }
    }
  }

  showUI() {
    // Implement UI logic here
  }
}

module.exports = AutoQuestsMod;
