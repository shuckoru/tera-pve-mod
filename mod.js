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
  burnMsgEnabled: true,
  dmgValueTestEnabled: false,
  abnormalitiesDebugEnabled: false,
  dmgValueTestVerboose: false,
  autoPasteFightDetailsInPartyChat: false,
  hideAbnormalitiesEnabled: true,
};

let lastFightDetailsMsg;

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
autopaste   - Toggle automatic pasting of fight details in party chat
paste       - Send last fight details message in party chat
dvt         - Toggle damage value test. Use 'dvt v' for verbose mode
abhide      - Toggle hiding of abnormalities
abdebug     - Toggle abnormalities debug mode`,
  AbnormalitiesHideStatus: (enabled) => `Abnormalities Hide Mode: ${enabled ? "enabled" : "disabled"}.`,
  AbnormalitiesDebugModeStatus: (enabled) => `Abnormalities Debug Mode: ${enabled ? "enabled" : "disabled"}.`,
  FightStarted: "Fight started.",
  DamageValueRaw: (dmg, executionTime) => dmg / 10000000 / executionTime,
  DamageValueBasePrint: (event, executionTime, dmg) =>
    `${event.skill.id} - ${executionTime.toFixed(1)} - ${Messages.DamageValueRaw(dmg, executionTime).toFixed(2)}`,
  DamageValueVerbosePrint: (event, executionTime, dmg) =>
    `skillId: ${event.skill.id} - executionTime: ${executionTime.toFixed(1)} - DamageValue: ${Messages.DamageValueRaw(
      dmg,
      executionTime
    ).toFixed(2)} - Damage: ${(Number(dmg) / 1000000).toFixed(1)}M/s`,
  DamageValueTestLegend: `SkillId, AnimationTime, DamageValue`,
  DamageValueVerbooseEnabled: (enabled) => `Damage Value Tester verboose: ${enabled ? "enabled" : "disabled"}.`,
  DamageValueTest: (enabled) => `Damage Value Tester: ${enabled ? "enabled" : "disabled"}.`,
  DPSMeterEnabled: (enabled) => `DPS meter: ${enabled ? "enabled" : "disabled"}.`,
  FightTimerEnabled: (enabled) => `Fight timer: ${enabled ? "enabled" : "disabled"}.`,
  BurnReminderEnabled: (enabled) => `Burn reminder: ${enabled ? "enabled" : "disabled"}.`,
  FightDetailsAutoPaste: (enabled) => `Fight details auto paste: ${enabled ? "enabled" : "disabled"}.`,
  FightDetails: (fightTimer, partyDps, personalDps) => `Fight ended and it last: ${fightTimer}.
Party dps: ${partyDps}.
Personal dps: ${personalDps}`,
  TrackedDebuffExpired: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;expired</font>`,
  TrackedDebuffExpiring: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;ending</font>`,
  TrackedAbnormalityActivated: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;activated</font>`,
  BurnIn2: '<font size="24">Burn in 2..</font>',
  FightTimer: (fightDurationInSeconds) =>
    `${Math.floor(fightDurationInSeconds / 60)}:${
      fightDurationInSeconds % 60 > 9 ? fightDurationInSeconds % 60 : "0" + String(fightDurationInSeconds % 60)
    }`,
  PartyDPS: (event, fightDurationInSeconds) =>
    `${(Number(event.maxHp - event.curHp) / 1000000 / fightDurationInSeconds).toFixed(1)} M/s`,
  PersonalDPS: (personalDamageDone, fightDurationInSeconds) =>
    `${(Number(personalDamageDone) / 1000000 / fightDurationInSeconds).toFixed(1)} M/s`,
  PersonalDPSWithTimer: (fightTimer, personalDps) => `${fightTimer}${" ".repeat(13)}${personalDps}`,
  ModFeatureStatus: (switches) => `
[${switches.dpsEnabled ? "Enabled" : "Disabled"}] DPS
[${switches.dpsEnabledTimer ? "Enabled" : "Disabled"}] DPS Timer
[${switches.burnMsgEnabled ? "Enabled" : "Disabled"}] Burn Message
[${switches.autoPasteFightDetailsInPartyChat ? "Enabled" : "Disabled"}] Auto Paste Fight Details
[${switches.dmgValueTestEnabled ? "Enabled" : "Disabled"}] Damage Value Test
[${switches.dmgValueTestVerboose ? "Enabled" : "Disabled"}] Damage Value Test Verbose
[${switches.abnormalitiesDebugEnabled ? "Enabled" : "Disabled"}] Abnormalities Debug
[${switches.hideAbnormalitiesEnabled ? "Enabled" : "Disabled"}] Hide Abnormalities`,
};

const abnormsHelpersMod = (mod) => {
  const PlayerRoles = {
    Tank: 0,
    DPS: 1,
    Healer: 2,
  };

  let playerRole = 2;

  let trackedEnduranceDebuffTimeout;
  let trackedEnduranceDebuffExpiredWarnings = 0;

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
  let bossGameId;
  let fightTimer;
  let fightStartInSeconds = 0;
  let fightEndInSeconds;
  let fightDurationInSeconds = 0;
  let personalDamageDone = 0;
  let partyDps = "0 M/s";
  let personalDps = "0 M/s";

  const resetDps = (mod) => {
    fightStartInSeconds = 0;
    fightDurationInSeconds = 0;
    personalDamageDone = 0;
    personalDps = 0;
    sendCustomStyleMessage(mod)(" ", ...Object.values(MessageTypes.PersonalDPS));
  };

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

      partyDps = Messages.PartyDPS(event, fightDurationInSeconds);

      personalDps = Messages.PersonalDPS(personalDamageDone, fightDurationInSeconds);

      fightTimer = Messages.FightTimer(fightDurationInSeconds);

      if (fightDurationInSeconds == 0) break inFight;

      if (switches.dpsEnabled)
        if (switches.dpsEnabledTimer)
          sendCustomStyleMessage(mod)(
            Messages.PersonalDPSWithTimer(fightTimer, personalDps),
            ...Object.values(MessageTypes.PersonalDPS)
          );
        else sendCustomStyleMessage(mod)(personalDps, ...Object.values(MessageTypes.PersonalDPS));

      if (switches.burnMsgEnabled)
        if (fightDurationInSeconds % 60 != 0 && (fightDurationInSeconds % 60) % 58 == 0)
          sendCustomStyleMessage(mod)(Messages.BurnIn2, ...Object.values(MessageTypes.BurnIn2));
    }
  });

  // Personal DPS calc
  mod.hook("S_EACH_SKILL_RESULT", "*", { order: 99 }, (event) => {
    if (mod.game.me.level < 65 || event.type != 1) return;
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

    lastFightDetailsMsg = Messages.FightDetails(fightTimer, partyDps, personalDps);

    sendInGameCmdMessage(mod)(lastFightDetailsMsg);
    sendCustomStyleMessage(mod)(lastFightDetailsMsg, ...Object.values(MessageTypes.EndOfFight));

    if (switches.autoPasteFightDetailsInPartyChat) sendMsgInPartyChat(mod)(lastFightDetailsMsg);

    resetDps(mod);
  });
};

const smolDmgMod = (mod) => {
  let players = {};

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
  const damageValueTesterSkillsCast = {};
  const report = {
    averageDamageValues: {},
    executions: {},
    averageExecutionTimes: {},
  };

  mod.hook("S_ACTION_STAGE", "*", { filter: { fake: null } }, (event) => {
    if (!switches.dmgValueTestEnabled) return;
    if (!mod.game.me.is(event.gameId)) return;

    if (damageValueTesterSkillsCast[event.skill.id] && damageValueTesterSkillsCast[event.skill.id].eventId != event.id)
      delete damageValueTesterSkillsCast[event.skill.id];

    if (damageValueTesterSkillsCast[event.skill.id] && damageValueTesterSkillsCast[event.skill.id].eventId == event.id)
      return;

    damageValueTesterSkillsCast[event.skill.id] = {
      eventId: event.id,
      startTimestamp: Date.now(),
    };

    if (!report.executions[event.skill.id]) report.executions[event.skill.id] = 0;
    report.executions[event.skill.id] += 1;
  });

  mod.hook("S_ACTION_END", "*", { filter: { fake: null } }, (event) => {
    if (!switches.dmgValueTestEnabled) return;

    if (!mod.game.me.is(event.gameId)) return;

    const { startTimestamp, damage } = damageValueTesterSkillsCast[event.skill.id];

    const executionTime = (Date.now() - startTimestamp) / 1000;

    damageValueTesterSkillsCast[event.skill.id].executionTime = executionTime;

    if (!report.averageExecutionTimes[event.skill.id]) report.averageExecutionTimes[event.skill.id] = 0;
    report.averageExecutionTimes[event.skill.id] = (report.averageExecutionTimes[event.skill.id] + executionTime) / 2;

    if (damage) {
      sendInGameCmdMessage(mod)(
        switches.dmgValueTestVerboose
          ? Messages.DamageValueVerbosePrint(event, executionTime, damage)
          : Messages.DamageValueBasePrint(event, executionTime, damage)
      );
      if (!report.averageDamageValues[event.skill.id]) report.averageDamageValues[event.skill.id] = {};
      const { previous, current } = report.averageDamageValues[event.skill.id];
      report.averageDamageValues[event.skill.id] = {
        previous: current,
        current: current
          ? (current + Messages.DamageValueRaw(damage, executionTime)) / 2
          : Messages.DamageValueRaw(damage, executionTime),
      };
    }
  });

  mod.hook("S_EACH_SKILL_RESULT", "*", { order: 98 }, (event) => {
    if (!switches.dmgValueTestEnabled) return;
    if (!mod.game.me.is(event.source)) return;

    if (event.value > 0n && damageValueTesterSkillsCast[event.skill.id]) {
      const { executionTime, damage } = damageValueTesterSkillsCast[event.skill.id];

      const updatedDamage = damage ? Number(damage) + Number(event.value) : Number(event.value);

      damageValueTesterSkillsCast[event.skill.id].damage = updatedDamage;

      if (executionTime && updatedDamage) {
        sendInGameCmdMessage(mod)(
          switches.dmgValueTestVerboose
            ? Messages.DamageValueVerbosePrint(event, executionTime, updatedDamage)
            : Messages.DamageValueBasePrint(event, executionTime, updatedDamage)
        );
        const { previous, current } = report.averageDamageValues[event.skill.id];

        report.averageDamageValues[event.skill.id] = {
          previous: current,
          current: (previous + Messages.DamageValueRaw(damage, executionTime)) / 2,
        };
      }
    }
  });

  mod.hook("S_DESPAWN_NPC", "*", (event) => {
    if (!switches.dmgValueTestEnabled) return;
    sendInGameCmdMessageFromObject(mod)({ name: "averageExecutionTimes", ...report.averageExecutionTimes });
    sendInGameCmdMessageFromObject(mod)({ name: "executions", ...report.executions });

    const aggregatedDamageValues = {};
    for (const skill in report.averageDamageValues) {
      if (Object.hasOwnProperty.call(report.averageDamageValues, skill)) {
        aggregatedDamageValues[skill] = report.averageDamageValues[skill].current.toFixed(2);
      }
    }
    sendInGameCmdMessageFromObject(mod)({ name: "aggregatedDamageValues", ...aggregatedDamageValues });
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
    abhide: () => {
      switches.hideAbnormalitiesEnabled = !switches.hideAbnormalitiesEnabled;
      sendInGameCmdMessage(mod)(Messages.AbnormalitiesHideStatus(switches.hideAbnormalitiesEnabled));
    },
    abdebug: () => {
      switches.abnormalitiesDebugEnabled = !switches.abnormalitiesDebugEnabled;
      sendInGameCmdMessage(mod)(Messages.AbnormalitiesDebugModeStatus(switches.abnormalitiesDebugEnabled));
    },
    $none: () => {
      sendInGameCmdMessage(mod)(Messages.ModFeatureStatus(switches));
    },
  });
};

const unloadModule = () => {
  unwatchConfigFilesChanges(modConfigs);
};

module.exports = { loadCommands, loadModule, unloadModule };
