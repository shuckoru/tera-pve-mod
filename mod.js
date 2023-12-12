const {
  sendMsg,
  sendCustomStyleMessage,
  sendMsgInPartyChat,
  sendModuleBasedInGameCmdMessage,
  sendModuleBasedInGameCmdMessageFromObject,
} = require("tera-mod-commons");

const path = require("path");

const { setModConfigVariables, unwatchConfigFilesChanges } = require("./config");

const ModuleName = "PVE";

const sendInGameCmdMessage = (mod) => (msg) => sendModuleBasedInGameCmdMessage(mod)(ModuleName)(msg);
const sendInGameCmdMessageFromObject = (mod) => (msg) =>
  sendModuleBasedInGameCmdMessageFromObject(mod)(ModuleName)(msg);

const modConfigs = {
  blacklistedAbnormalities: {
    filePath: path.join(__dirname, "./config/blacklistedAbnormalities.json"),
    data: {},
  },
  trackedAbnormalities: {
    filePath: path.join(__dirname, "./config/trackedAbnormalities.json"),
    data: {},
  },
};

const switches = {
  dpsEnabled: true,
  dpsEnabledTimer: true,
  burnMsgEnabled: false,
  dmgValueTestEnabled: false,
  abnormalitiesDebugEnabled: false,
  dmgValueTestVerboose: false,
  autoPasteFightDetailsInPartyChat: false,
  hideAbnormalitiesEnabled: true,
};

let bossGameId;
let fightTimer;
let fightStartInSeconds = 0;
let fightEndInSeconds;
let fightDurationInSeconds = 0;
let personalDamageDone = 0;
let partyDps = "0 M/s";
let personalDps = "0 M/s";
let players = {};
let spacesInBetweenDpsAndTimer = 13;
let lastFightDetailsMsg;
let playerRole = 2;

const DPSDmgType = 1;

const damageValueTesterSkillsCast = {};

let trackedEnduranceDebuffTimeout;
let trackedEnduranceDebuffExpiredWarnings = 0;

const firstTickSkills = {
  240130: "OIP",
};

const PlayerRoles = {
  Tank: 0,
  DPS: 1,
  Healer: 2,
};

const MessageTypes = {
  PersonalDPS: { id: 1, style: 82 },
  FightStarted: { id: 2, style: 51 },
  EndOfFight: { id: 3, style: 49 },
  BurnIn2: { id: 4, style: 51 },
  TrackedDebuffExpiring: { id: 5, style: 51 },
  TrackedAbnormalityActivated: { id: 6, style: 51 },
  PersonalDPSWithTimer: { id: 7, style: 82 },
};

const Messages = {
  AvailableCommands: `
Available commands:
help        - Show available commands
dps         - Toggle DPS meter
timer       - Toggle Fight Timer
burn        - Toggle Burn Reminder
reset       - Reset DPS
autopaste   - Toggle automatic pasting of fight details in party chat
paste       - Send last fight details message in party chat
dvt         - Toggle damage value test. Use 'dvt v' for verbose mode
ftskill     - Add a skill to first tick skills. Usage: 'ftskill <skillId>'
ftskillrm   - Remove a skill from first tick skills. Usage: 'ftskillrm <skillId>'
abhide      - Toggle hiding of abnormalities
abdebug     - Toggle abnormalities debug mode`,
  AbnormalitiesHideStatus: (enabled) => `Abnormalities Hide Mode: ${enabled ? "enabled" : "disabled"}.`,
  AbnormalitiesDebugModeStatus: (enabled) => `Abnormalities Debug Mode: ${enabled ? "enabled" : "disabled"}.`,
  FightStarted: "Fight started.",
  FirstTickSkillsRemove: (skillId) => `Removed ${skillId} to be counted as 1st damage tick skill.`,
  FirstTickSkillsAdd: (skillId) => `Added ${skillId} to be counted as 1st damage tick skill.`,
  DamageValueRaw: (event, eventTime, dmg) =>
    `${event.skill.id} - ${eventTime.toFixed(1)} - ${(dmg / 10 / eventTime).toFixed(2)}`,
  DamageValueVerbose: (event, eventTime, dmg) =>
    `skillId: ${event.skill.id} - eventTime: ${eventTime.toFixed(1)} - DamageValue: ${(dmg / 10 / eventTime).toFixed(
      2
    )} - Damage: ${dmg}`,
  DamageValueTestLegend: `SkillId, AnimationTime, DamageValue`,
  DamageValueVerbooseEnabled: (enabled) => `Damage Value Tester verboose: ${enabled ? "enabled" : "disabled"}.`,
  DamageValueTest: (enabled) => `Damage Value Tester: ${enabled ? "enabled" : "disabled"}.`,
  DPSMeterEnabled: (enabled) => `DPS meter: ${enabled ? "enabled" : "disabled"}.`,
  FightTimerEnabled: (enabled) => `Fight timer: ${enabled ? "enabled" : "disabled"}.`,
  BurnReminderEnabled: (enabled) => `Burn reminder: ${enabled ? "enabled" : "disabled"}.`,
  FightDetailsAutoPaste: (enabled) => `Fight details auto paste: ${enabled ? "enabled" : "disabled"}.`,
  FightDetails: () => `Fight ended and it last: ${fightTimer}.
Party dps: ${partyDps}.
Personal dps: ${personalDps}`,
  TrackedDebuffExpired: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;expired</font>`,
  TrackedDebuffExpiring: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;ending</font>`,
  TrackedAbnormalityActivated: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;activated</font>`,
  BurnIn2: '<font size="24">Burn in 2..</font>',
  FightTimer: () =>
    `${Math.floor(fightDurationInSeconds / 60)}:${
      fightDurationInSeconds % 60 > 9 ? fightDurationInSeconds % 60 : "0" + String(fightDurationInSeconds % 60)
    }`,
  PartyDPS: (event) => `${(Number(event.maxHp - event.curHp) / 1000000 / fightDurationInSeconds).toFixed(1)} M/s`,
  PersonalDPS: () => `${(Number(personalDamageDone) / 1000000 / fightDurationInSeconds).toFixed(1)} M/s`,
  PersonalDPSWithTimer: () => `${fightTimer}${" ".repeat(spacesInBetweenDpsAndTimer)}${personalDps}`,
  ModFeatureStatus: `
[${switches.dpsEnabled ? "Enabled" : "Disabled"}] DPS
[${switches.dpsEnabledTimer ? "Enabled" : "Disabled"}] DPS Timer
[${switches.burnMsgEnabled ? "Enabled" : "Disabled"}] Burn Message
[${switches.dmgValueTestEnabled ? "Enabled" : "Disabled"}] Damage Value Test
[${switches.abnormalitiesDebugEnabled ? "Enabled" : "Disabled"}] Abnormalities Debug
[${switches.dmgValueTestVerboose ? "Enabled" : "Disabled"}] Damage Value Test Verbose
[${switches.autoPasteFightDetailsInPartyChat ? "Enabled" : "Disabled"}] Auto Paste Fight Details
[${switches.hideAbnormalitiesEnabled ? "Enabled" : "Disabled"}] Hide Abnormalities`,
  DPSValuesReset: "DPS Values Successfully Reset.",
};

const resetDps = (mod) => {
  fightStartInSeconds = 0;
  fightDurationInSeconds = 0;
  personalDamageDone = 0;
  personalDps = 0;
  sendCustomStyleMessage(mod)(" ", ...Object.values(MessageTypes.PersonalDPS));
};

const abnormsHelpersMod = (mod) => {
  mod.game.me.on("change_zone", (zone, quick) => {
    switch (mod.game.me.class) {
      case "lancer":
        playerRole = PlayerRoles.Tank;
        break;
      case "priest":
      case "mystic":
        playerRole = PlayerRoles.Healer;
        break;
      default:
        playerRole = PlayerRoles.DPS;
        break;
    }
  });

  mod.hook("S_ABNORMALITY_BEGIN", "*", (event) => {
    if (!mod.game.me.inDungeon) return;

    if (event.id in modConfigs.trackedAbnormalities.data) {
      const { dpsMode, tankMode, tankDebuff, supportDebuff } = modConfigs.trackedAbnormalities.data[event.id];

      if (event.source == mod.game.me.gameId) {
        if (dpsMode) playerRole = PlayerRoles.DPS;
        if (tankMode) playerRole = PlayerRoles.Tank;
      }

      if ((tankDebuff && playerRole == PlayerRoles.Tank) || (supportDebuff && playerRole == PlayerRoles.Healer)) {
        clearTimeout(trackedEnduranceDebuffTimeout);
        trackedEnduranceDebuffTimeout = setTimeout(() => {
          sendCustomStyleMessage(mod)(
            Messages.TrackedDebuffExpiring(event.id),
            ...Object.values(MessageTypes.TrackedDebuffExpiring)
          );
        }, Number(event.duration) - 2 * 1000);
      } else if (!tankDebuff && !supportDebuff && !dpsMode && !tankMode)
        sendCustomStyleMessage(mod)(
          Messages.TrackedAbnormalityActivated(event.id),
          ...Object.values(MessageTypes.TrackedAbnormalityActivated)
        );
    }
  });

  mod.hook("S_ABNORMALITY_REFRESH", "*", (event) => {
    if (!mod.game.me.inDungeon) return;

    if (!(event.id in modConfigs.trackedAbnormalities.data)) return;

    const { tankDebuff, supportDebuff } = modConfigs.trackedAbnormalities.data[event.id];
    if ((tankDebuff && playerRole == PlayerRoles.Tank) || (supportDebuff && playerRole == PlayerRoles.Healer)) {
      clearTimeout(trackedEnduranceDebuffTimeout);
      trackedEnduranceDebuffTimeout = setTimeout(() => {
        sendCustomStyleMessage(mod)(
          Messages.TrackedDebuffExpiring(event.id),
          ...Object.values(MessageTypes.TrackedDebuffExpiring)
        );
      }, Number(event.duration) - 2 * 1000);
    }
  });
  mod.hook("S_ABNORMALITY_END", "*", (event) => {
    if (!mod.game.me.inDungeon) return;

    if (!(event.id in modConfigs.trackedAbnormalities.data)) return;

    const { tankDebuff, supportDebuff } = modConfigs.trackedAbnormalities.data[event.id];

    if ((tankDebuff && playerRole == PlayerRoles.Tank) || (supportDebuff && playerRole == PlayerRoles.Healer)) {
      clearTimeout(trackedEnduranceDebuffTimeout);
      trackedEnduranceDebuffExpiredWarnings = 0;
      trackedEnduranceDebuffTimeout = setInterval(() => {
        sendCustomStyleMessage(mod)(
          Messages.TrackedDebuffExpired(event.id),
          ...Object.values(MessageTypes.TrackedDebuffExpiring)
        );
        trackedEnduranceDebuffExpiredWarnings++;
        if (trackedEnduranceDebuffExpiredWarnings >= 5) clearTimeout(trackedEnduranceDebuffTimeout);
      }, 2 * 1000);
    }
  });
};

const abnormsHideMod = (mod) => {
  mod.hook("S_ABNORMALITY_BEGIN", "*", (event) => {
    if (!switches.hideAbnormalitiesEnabled) return;
    if (event.id in modConfigs.blacklistedAbnormalities.data) return false;
    if (switches.abnormalitiesDebugEnabled) sendInGameCmdMessage(mod)(event.id);
  });
};

const dpsMeterMod = (mod) => {
  // Fight Start && Party Dps Calc
  mod.hook("S_BOSS_GAGE_INFO", "*", (event) => {
    if (bossGameId != event.id) {
      bossGameId = event.id;
    }

    let timestampInSeconds = Math.floor(Date.now() / 1000);

    inFight: if (event.curHp < event.maxHp) {
      if (fightStartInSeconds == 0) {
        fightStartInSeconds = timestampInSeconds;
        personalDamageDone = 0;
        sendCustomStyleMessage(mod)(Messages.FightStarted, ...Object.values(MessageTypes.FightStarted));
      }

      fightDurationInSeconds = timestampInSeconds - fightStartInSeconds;

      partyDps = Messages.PartyDPS(event);

      personalDps = Messages.PersonalDPS();

      fightTimer = Messages.FightTimer();

      if (fightDurationInSeconds == 0) break inFight;

      if (switches.dpsEnabled)
        if (switches.dpsEnabledTimer)
          sendCustomStyleMessage(mod)(Messages.PersonalDPSWithTimer(), ...Object.values(MessageTypes.PersonalDPS));
        else sendCustomStyleMessage(mod)(personalDps, ...Object.values(MessageTypes.PersonalDPS));

      if (switches.burnMsgEnabled)
        if (fightDurationInSeconds % 60 != 0 && (fightDurationInSeconds % 60) % 58 == 0)
          sendCustomStyleMessage(mod)(Messages.BurnIn2, ...Object.values(MessageTypes.BurnIn2));
    }
  });

  // Personal DPS calc
  mod.hook("S_EACH_SKILL_RESULT", "*", { order: 99 }, (event) => {
    if (mod.game.me.level < 65 || event.type != DPSDmgType) return;
    if (mod.game.me.gameId === event.source || mod.game.me.gameId === event.owner)
      if (event.target == bossGameId) personalDamageDone += Number(event.value);
  });

  // End of fight
  mod.game.me.on("change_zone", (zone, quick) => {
    resetDps(mod);
  });

  mod.hook("S_DESPAWN_NPC", "*", (event) => {
    if (event.gameId != bossGameId) return event;

    let timestampInSeconds = Math.floor(Date.now() / 1000);

    fightEndInSeconds = timestampInSeconds;
    fightDurationInSeconds = fightEndInSeconds - fightStartInSeconds;

    lastFightDetailsMsg = Messages.FightDetails();

    sendMsg(mod)(lastFightDetailsMsg, "FightInfos");
    sendCustomStyleMessage(mod)(lastFightDetailsMsg, ...Object.values(MessageTypes.EndOfFight));
    if (switches.autoPasteFightDetailsInPartyChat) sendMsgInPartyChat(mod)(lastFightDetailsMsg);

    resetDps(mod);
  });
};

const smolDmgMod = (mod) => {
  mod.hook("S_SPAWN_USER", "*", (event) => {
    players[event.gameId] = true;
  });

  mod.hook("S_DESPAWN_USER", "*", (event) => {
    delete players[event.gameId];
  });
  mod.game.me.on("leave_loading_screen", () => (players = {}));
  mod.hook("S_EACH_SKILL_RESULT", 14, { order: 100 }, (event) => {
    if (mod.game.me.level < 65) return;
    if (mod.game.me.gameId === event.source || mod.game.me.gameId === event.owner) {
      let smolDmg = 0;
      if (players[event.target] != undefined) smolDmg = Number(event.value) / Number(1);
      else smolDmg = Number(event.value) / Number(1000000);
      if (smolDmg < 1) smolDmg = 1;
      event.value = BigInt(Math.floor(smolDmg));
      return true;
    }
  });
};

const skillsDamageValueTester = (mod) => {
  // start skill timer
  // get data
  // end skill timer

  return;

  mod.hook("S_ACTION_STAGE", "*", { filter: { fake: null } }, (event) => {
    // if (!switches.dmgValueTestEnabled) return;

    if (!mod.game.me.is(event.gameId)) return;

    if (damageValueTesterSkillsCast[event.skill.id] && damageValueTesterSkillsCast[event.skill.id].eventId != event.id)
      delete damageValueTesterSkillsCast[event.skill.id];

    damageValueTesterSkillsCast[event.skill.id] = {
      eventId: event.id,
      time: Date.now(),
    };
    // sendInGameCmdMessage(mod)("set time START for skill: " + event.skill.id);
  });

  mod.hook("S_ACTION_END", "*", { filter: { fake: null } }, (event) => {
    // if (!switches.dmgValueTestEnabled) return;

    if (!mod.game.me.is(event.gameId)) return;

    const { time } = damageValueTesterSkillsCast[event.skill.id];

    // sendInGameCmdMessage(mod)(
    //   "set time END for skill: " + event.skill.id + " of " + (Date.now() - time)
    // );

    damageValueTesterSkillsCast[event.skill.id].time = Date.now() - time;
  });

  mod.hook("S_EACH_SKILL_RESULT", "*", { order: 98 }, (event) => {
    // if (!switches.dmgValueTestEnabled) return;
    if (mod.game.me.gameId != event.source) return;

    if (event.value > 0n && damageValueTesterSkillsCast[event.skill.id]) {
      let eventTime = damageValueTesterSkillsCast[event.skill.id].time;

      let dmg = damageValueTesterSkillsCast[event.skill.id].damage
        ? Number(damageValueTesterSkillsCast[event.skill.id].damage) + Number(event.value)
        : Number(event.value);

      damageValueTesterSkillsCast[event.skill.id].damage = dmg;

      let damageValue = (dmg / 10000000 / eventTime).toFixed(3);

      sendInGameCmdMessage("damageValue" + damageValue);

      damageValueTesterSkillsCast[event.skill.id].damageValue = damageValue;

      sendInGameCmdMessage(mod)(
        // switches.dmgValueTestVerboose
        true ? Messages.DamageValueVerbose(event, eventTime, dmg) : Messages.DamageValueRaw(event, eventTime, dmg)
      );
    }
  });
};

const loadModule = (mod) => {
  setModConfigVariables(modConfigs);

  dpsMeterMod(mod);
  smolDmgMod(mod);

  abnormsHideMod(mod);
  abnormsHelpersMod(mod);
  skillsDamageValueTester(mod);
};

const loadCommands = (mod) => {
  mod.command.add("pve", {
    help: () => {
      sendInGameCmdMessage(mod)(Messages.AvailableCommands);
    },
    dps: () => {
      switches.dpsEnabled = !switches.dpsEnabled;
      sendInGameCmdMessage(mod)(Messages.DPSMeterEnabled(switches.dpsEnabled));
    },
    timer: () => {
      switches.dpsEnabledTimer = !switches.dpsEnabledTimer;
      sendInGameCmdMessage(mod)(Messages.FightTimerEnabled(switches.dpsEnabledTimer));
    },
    burn: () => {
      switches.burnMsgEnabled = !switches.burnMsgEnabled;
      sendInGameCmdMessage(mod)(Messages.BurnReminderEnabled(switches.burnMsgEnabled));
    },
    reset: () => {
      resetDps(mod);
      sendInGameCmdMessage(mod)(Messages.DPSValuesReset);
    },
    autopaste: () => {
      switches.autoPasteFightDetailsInPartyChat = !switches.autoPasteFightDetailsInPartyChat;
      sendInGameCmdMessage(mod)(Messages.FightDetailsAutoPaste(switches.switches.autoPasteFightDetailsInPartyChat));
    },
    paste: () => {
      sendMsgInPartyChat(mod)(lastFightDetailsMsg);
    },
    dvt: (verboose) => {
      if (verboose) {
        switches.dmgValueTestVerboose = !switches.dmgValueTestVerboose;
        sendInGameCmdMessage(mod)(Messages.DamageValueVerbooseEnabled(switches.dmgValueTestVerboose));
        return;
      }
      switches.dmgValueTestEnabled = !switches.dmgValueTestEnabled;
      sendInGameCmdMessage(mod)(Messages.DamageValueTest(switches.dmgValueTestEnabled));
      if (switches.dmgValueTestEnabled) sendInGameCmdMessage(mod)(Messages.DamageValueTestLegend);
    },
    ftskill: (skillId) => {
      firstTickSkills[skillId] = "";
      sendInGameCmdMessage(mod)(Messages.FirstTickSkillsAdd(skillId));
    },
    ftskillrm: (skillId) => {
      if (!(skillId in firstTickSkills)) return;
      delete firstTickSkills[skillId];
      sendInGameCmdMessage(mod)(Messages.FirstTickSkillsRemove(skillId));
    },
    abhide: () => {
      switches.hideAbnormalitiesEnabled = !switches.hideAbnormalitiesEnabled;
      sendInGameCmdMessage(mod)(Messages.AbnormalitiesHideStatus(switches.hideAbnormalitiesEnabled));
    },
    abdebug: () => {
      switches.abnormalitiesDebugEnabled = !switches.abnormalitiesDebugEnabled;
      sendInGameCmdMessage(mod)(Messages.AbnormalitiesDebugModeStatus(switches.abnormalitiesDebugEnabled));
    },
    $none: () => {
      sendInGameCmdMessage(mod)(Messages.ModFeatureStatus);
    },
  });
};

const unloadModule = () => {
  unwatchConfigFilesChanges(modConfigs);
};

module.exports = { loadCommands, loadModule, unloadModule };
