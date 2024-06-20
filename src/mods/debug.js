const BaseMod = require("./base");
const fs = require("fs");
const path = require("path");
const { mkdir } = require("fs").promises;

class DebuggerMod extends BaseMod {
  static Version = 1;

  static Name = "debug";
  Description =
    "Provides debugging functionalities for abnormalities, actions, and packets";

  Hooks = {};
  Commands = null;
  abnormalitiesWithNames = {};
  abDebugEnabled = false;
  abDebugAllEnabled = false;
  actionDebugEnabled = false;
  packetsLoggerEnabled = false;
  loggerHook = null;
  file = null;
  filePath = null;

  constructor(mod, config) {
    super(mod, config);

    this.Messages = {
      AbnormalitiesDebugMode: (enabled) =>
        `Abnormalities Debug Mode: ${
          enabled
            ? '<font color="#56B4E9">enabled</font>'
            : '<font color="#E69F00">disabled</font>'
        }.`,
      AbnormalitiesDebugAllMode: (enabled) =>
        `Abnormalities Debug All Mode: ${
          enabled
            ? '<font color="#56B4E9">enabled</font>'
            : '<font color="#E69F00">disabled</font>'
        }.`,
      SkillsDebugEnabled: (enabled) =>
        `Skill debug: ${
          enabled
            ? '<font color="#56B4E9">enabled</font>'
            : '<font color="#E69F00">disabled</font>'
        }.`,
      PacketsLoggerEnabled: (enabled) =>
        `Packets Logger: ${
          enabled
            ? '<font color="#56B4E9">enabled</font>'
            : '<font color="#E69F00">disabled</font>'
        }.`,
      HookEnabled: "<---- Hook ENABLED ---->\r\n",
      HookDisabled: "<---- Hook DISABLED ---->\r\n",
      LogMessage: (today, fromServer, fake, data, code) =>
        `[${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}:${today.getMilliseconds()}] ${
          fromServer ? "<-" : "->"
        } ${fake ? "[CRAFTED] " : ""}${data.$silenced ? "[BLOCKED] " : ""}${
          data.$modified ? "[EDITED] " : ""
        }${!fake && !data.$silenced && !data.$modified ? " " : ""}${
          mod.dispatch.protocolMap.code.get(code) || code
        } ${data.toString("hex")}\r\n`,
      DebuggerHelp: `<font color="#56B4E9">Debugger Commands:</font>
<font color="#56B4E9">debug ab</font>: Toggle abnormalities debug mode.
<font color="#56B4E9">debug ab all</font>: Toggle abnormalities debug all mode.
<font color="#56B4E9">debug action</font>: Toggle actions debug mode.
<font color="#56B4E9">debug log <filename></font>: Toggle packets logger with optional filename.
<font color="#56B4E9">help</font>: Show this help message.`,
    };

    this.Hooks = {
      S_ABNORMALITY_BEGIN: {
        version: "*",
        position: -Infinity,
        handler: (event) => this.handleAbnormality(event),
      },
      S_ABNORMALITY_REFRESH: {
        version: "*",
        position: -Infinity,
        handler: (event) => this.handleAbnormality(event),
      },
      S_ACTION_STAGE: {
        version: "*",
        position: -Infinity,
        handler: (event) => this.handleAction(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleAbnormality(event) {
    if (!this.abDebugEnabled) return;
    const name = this.abnormalitiesWithNames[event.id];
    const isBlacklisted = event.id in this.Config.blacklistedAbnormalities;
    if (this.abDebugAllEnabled) {
      this.cmdMsg(`name: ${name} id: ${event.id}`);
    } else if (name && !isBlacklisted) {
      this.cmdMsg(`name: ${name} id: ${event.id}`);
    }
  }

  handleAction(event) {
    if (!this.actionDebugEnabled) return;
    if (!this.mod.game.me.is(event.gameId)) return;

    this.cmdMsg(
      this.mod.game.me.class[0].toUpperCase() + this.mod.game.me.class.slice(1)
    );

    const partyMember = this.mod.game.party?.getMemberData(event.gameId);

    if (partyMember) {
      this.cmdMsg("partyMember.class: " + partyMember.class);
      this.cmdMsg("partyMember.name: " + partyMember.name);
      this.cmdMsg("event.skill.id: " + event.skill.id);
    }

    this.mod
      .queryData("/StrSheet_UserSkill/String@id=?&&class=?", [
        event.skill.id,
        this.mod.game.me.class[0].toUpperCase() +
          this.mod.game.me.class.slice(1),
      ])
      .then((res) => {
        this.cmdMsg(`ID: ${event.skill.id} Name: ${res.attributes.name}`);
      });
  }

  async togglePacketsLogger(logFileName) {
    this.packetsLoggerEnabled = !this.packetsLoggerEnabled;
    this.cmdMsg(this.Messages.PacketsLoggerEnabled(this.packetsLoggerEnabled));

    if (this.packetsLoggerEnabled) {
      if (!logFileName) logFileName = "";
      else logFileName += "-";
      logFileName += Date.now() + ".log";

      await mkdir(path.join(__dirname, "..", "..", "/logs"), {
        recursive: true,
      });

      this.filePath = path.join(__dirname, "..", "..", "/logs/" + logFileName);
      this.file = fs.createWriteStream(this.filePath, {
        highWaterMark: 1024 * 1024,
      });
      this.file.write(this.Messages.HookEnabled);
      this.loggerHook = this.mod.hook(
        "*",
        "raw",
        {
          order: 999999,
          filter: { fake: null, silenced: null, modified: null },
        },
        (code, data, fromServer, fake) => {
          const today = new Date();
          this.file.write(
            this.Messages.LogMessage(today, fromServer, fake, data, code)
          );
        }
      );
    } else {
      this.mod.unhook(this.loggerHook);
      this.file.end(this.Messages.HookDisabled);
    }
  }

  handleCommand(key, value) {
    switch (key) {
      case "ab":
        this.toggleAbDebug(value);
        break;
      case "action":
        this.toggleActionDebug();
        break;
      case "log":
        this.togglePacketsLogger(value);
        break;
      case "help":
      default:
        this.showHelp();
        break;
    }
  }

  toggleAbDebug(all) {
    if (all) {
      this.abDebugAllEnabled = !this.abDebugAllEnabled;
      this.cmdMsg(
        this.Messages.AbnormalitiesDebugAllMode(this.abDebugAllEnabled)
      );
    } else {
      this.abDebugEnabled = !this.abDebugEnabled;
      this.cmdMsg(this.Messages.AbnormalitiesDebugMode(this.abDebugEnabled));
    }

    if (
      this.abDebugEnabled &&
      Object.keys(this.abnormalitiesWithNames).length === 0
    ) {
      this.mod
        .queryData("/StrSheet_Abnormality/String/", [], true)
        .then((result) => {
          result.forEach((item) => {
            this.abnormalitiesWithNames[item.attributes.id] =
              item.attributes.name;
          });
        });
    }
  }

  toggleActionDebug() {
    this.actionDebugEnabled = !this.actionDebugEnabled;
    this.cmdMsg(this.Messages.SkillsDebugEnabled(this.actionDebugEnabled));
  }

  showHelp() {
    this.cmdMsg(this.Messages.DebuggerHelp);
  }

  destructor() {
    for (const hook in this.Hooks) {
      this.mod.unhook(this.Hooks[hook]);
    }
    if (this.file) this.file.end();
  }
}

module.exports = DebuggerMod;
