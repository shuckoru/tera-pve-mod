const BaseMod = require("./base");

const {
  sendCustomStyleMessage,
  sendMsgInPartyChat,
  ttsSay,
} = require("tera-mod-commons");

const MessageTypes = {
  PersonalDPS: { id: 1, style: 82 },
  EndOfFight: { id: 3, style: 49 },
  DpsBurning: { id: 4, style: 51 },
  TrackedDebuffExpiring: { id: 5, style: 51 },
  TrackedAbnormalityActivated: { id: 6, style: 51 },
};

const Messages = {
  TrackedDebuffExpired: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;expired</font>`,
  TrackedDebuffExpiring: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;ending</font>`,
  TrackedAbnormalityActivated: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;activated</font>`,
  DpsBurning: (dpsName) => `${dpsName} is burning`,
  PartyDPS: (damageDoneToBoss, fightDurationInSeconds) =>
    `${(damageDoneToBoss / 1000000 / fightDurationInSeconds).toFixed(1)} M/s`,
  PlayerDPS: (personalDamageDone, fightDurationInSeconds) =>
    `${(Number(personalDamageDone) / 1000000 / fightDurationInSeconds).toFixed(
      1
    )} M/s`,
  FightTimer: (fightDurationInSeconds) =>
    `${Math.floor(fightDurationInSeconds / 60)}:${
      fightDurationInSeconds % 60 > 9
        ? fightDurationInSeconds % 60
        : "0" + String(fightDurationInSeconds % 60)
    }`,
  UptimesReport: (
    bossName,
    bossHp,
    report,
    damageDoneToBoss,
    playersDps,
    fightDurationInSeconds
  ) =>
    `${bossName}
${Messages.FightTimer(fightDurationInSeconds)}    ${Messages.PartyDPS(
      damageDoneToBoss,
      fightDurationInSeconds
    )}    Damage: ${(damageDoneToBoss / 1000000).toFixed()} M    ${(
      bossHp / 1000000
    ).toFixed()} M
Healer  D: ${report.healerDebuff.toFixed(
      1
    )}% - CBs: ${report.healerCBuff.toFixed(
      1
    )}% - BBs: ${report.healerBurnBuff.toFixed(1)}%
Tank     D: ${report.tankDebuff.toFixed(1)}% - CBs: ${report.tankCBuff.toFixed(
      1
    )}% - BBs: ${report.tankBurnBuff.toFixed(1)}%
MSync  Healer: ${report.healerBurnBuffMetaSync.toFixed(
      1
    )}% - Tank: ${report.tankBurnBuffMetaSync.toFixed(1)}%
Boss     Enr: ${report.bossEnraged.toFixed(
      1
    )}% - BEnr: ${report.bossBEnraged.toFixed(1)}%
PSync   T&H: ${report.tankHealerSync.toFixed(1)}%
${playersDps}`,
};

class FightStatsMod extends BaseMod {
  static Version = 1;

  static Name = "fstats";
  Description = "Tracks and reports fight statistics";

  Hooks = {};
  Commands = null;

  constructor(mod, config) {
    super(mod, config);

    this.bossGameId = null;
    this.fightStartInSeconds = 0;
    this.fightDurationInSeconds = 0;
    this.personalDamageDone = 0;
    this.personalDps = "0 M/s";
    this.lastFightStats = null;
    this.playersDpsMessage = "";
    this.bossName = null;
    this.bossHp = 0;
    this.damageDoneToBoss = 0;

    this.fightTimerUpdateInterval = null;
    this.dpsDisplayTimerInterval = null;
    this.statsUpdateInterval = null;

    this.playersDps = {};
    this.abnormalities = {};
    this.abnormsEndTimestamps = {};

    this.report = {
      healerDebuff: 0,
      healerCBuff: 0,
      healerBurnBuff: 0,
      healerBurnBuffMetaSync: 0,
      healerBurnBuffTankSync: 0,
      tankDebuff: 0,
      tankCBuff: 0,
      tankBurnBuff: 0,
      tankBurnBuffMetaSync: 0,
      bossEnraged: 0,
      bossBEnraged: 0,
      tankHealerSync: 0,
    };

    this.defaultStats = {
      hDebuffTime: 0,
      hCBuffTime: 0,
      hBBuffTime: 0,
      hBBuffTimeMetaSync: 0,
      MetaSeconds: 20,
      tDebuffTime: 0,
      tCBuffTime: 0,
      tBBuffTime: 0,
      tBBuffTimeMetaSync: 0,
      bossEnraged: 0,
      bossEnragedTime: 0,
      bossBEnragedTime: 0,
      tankHealerSyncTime: 0,
    };

    this.stats = { ...this.defaultStats };

    this.healerConstantDebuffs = [28090, 27160];
    this.healerConstantBuffs = [805713, 801503, 702003];
    this.healerBurnBuffs = [805800, 702004];
    this.mysticBurnDebuff = 701708;

    this.tankConstantDebuffs = [401500, 401800, 200302, 10153140, 101210];
    this.tankBurnDebuffs = [10153141];
    this.tankConstantBuffs = [91900403, 690131, 10153551, 101350, 690093];
    this.tankBurnBuffs = [400701, 200701, 200232];

    this.trackedDebuffs = [
      ...this.healerConstantDebuffs,
      ...this.tankConstantDebuffs,
      ...this.tankBurnDebuffs,
      this.mysticBurnDebuff,
    ];
    this.trackedBuffs = [
      ...this.healerConstantBuffs,
      ...this.healerBurnBuffs,
      ...this.tankConstantBuffs,
      ...this.tankBurnBuffs,
    ];

    this.Hooks = {
      S_NPC_STATUS: {
        version: "*",
        handler: (event) => this.handleNpcStatus(event),
      },
      S_ABNORMALITY_BEGIN: {
        version: "*",
        position: -99999,
        handler: (event) => this.handleAbnormality(event),
      },
      S_ABNORMALITY_REFRESH: {
        version: "*",
        position: -99999,
        handler: (event) => this.handleAbnormality(event),
      },
      S_ABNORMALITY_END: {
        version: "*",
        position: -99999,
        handler: (event) => this.handleAbnormalityEnd(event),
      },
      S_BOSS_GAGE_INFO: {
        version: "*",
        handler: (event) => this.handleBossGageInfo(event),
      },
      S_EACH_SKILL_RESULT: {
        version: "*",
        handler: (event) => this.handleSkillResult(event),
      },
      S_DESPAWN_NPC: {
        version: "*",
        position: -99999,
        handler: (event) => this.handleDespawnNpc(event),
      },
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };

    mod.game.me.on("change_zone", () => {
      this.resetData();
    });
  }

  handleNpcStatus(event) {
    if (this.bossGameId != event.gameId) return;
    this.stats.bossEnraged = event.enraged ? 1 : 0;
  }

  handleAbnormality(event) {
    if (!this.mod.game.me.inDungeon) return;

    this.abnormalities[event.id] = { time: Number(event.duration) };
    const endTimestamp = Date.now() + Number(event.duration);
    const trackedBuff = this.trackedBuffs.find((b) => b == event.id);

    if (trackedBuff) this.abnormsEndTimestamps[trackedBuff] = endTimestamp;

    const trackedDebuff = this.trackedDebuffs.find((b) => b == event.id);
    if (trackedDebuff && event.target == this.bossGameId)
      this.abnormsEndTimestamps[trackedDebuff] = endTimestamp;
  }

  handleAbnormalityEnd(event) {
    if (!this.mod.game.me.inDungeon) return;

    const trackedDebuff = this.trackedDebuffs.find((b) => b == event.id);
    if (trackedDebuff && event.target == this.bossGameId)
      this.stats[trackedDebuff] = 0;
  }

  handleBossGageInfo(event) {
    if (this.bossGameId != event.id) {
      this.bossGameId = event.id;
    }

    if (!this.bossName) {
      this.mod
        .queryData("/StrSheet_Creature/HuntingZone@id=?", [event.huntingZoneId])
        .then(({ children }) => {
          this.bossName =
            children.find((c) => c.attributes?.templateId == event.templateId)
              ?.attributes?.name || "Boss";
        });
    }

    if (event.curHp == event.maxHp) this.resetData();

    if (event.curHp < event.maxHp && this.stats.bossEnraged) {
      this.bossHp = Number(event.maxHp);
      this.damageDoneToBoss = Number(event.maxHp - event.curHp);
    }
  }

  handleSkillResult(event) {
    if (event.target == this.bossGameId && this.fightStartInSeconds == 0) {
      if (
        this.Config.settings.startFightOnFirstDmgHit &&
        Number(event.value) == 0
      )
        return;

      this.fightStartInSeconds = Math.floor(Date.now() / 1000);
      this.fightTimerUpdateInterval = this.setFightTimerInterval();
      this.statsUpdateInterval = this.createStatsUpdateInterval();
      this.dpsDisplayTimerInterval = this.setDisplayDpsInterval();

      if (this.Config.settings.fightStartNotifyEnabled)
        ttsSay("starting", null);
    }

    if (
      this.mod.game.me.level < 65 ||
      ![1, 8].includes(event.type) ||
      event.target != this.bossGameId
    )
      return;

    const partyMember =
      this.mod.game.party.getMemberData(event.source) ||
      this.mod.game.party.getMemberData(event.owner);

    if (
      this.mod.game.me.gameId === event.source ||
      this.mod.game.me.gameId === event.owner
    )
      this.personalDamageDone += Number(event.value);

    if (!partyMember) return;
    if (!this.playersDps[partyMember.name])
      this.playersDps[partyMember.name] = Number(event.value);
    else this.playersDps[partyMember.name] += Number(event.value);
  }

  handleDespawnNpc(event) {
    if (event.gameId != this.bossGameId) return;

    if (!this.fightStartInSeconds == 0) {
      this.lastFightStats = Messages.UptimesReport(
        this.bossName,
        this.bossHp,
        this.report,
        this.damageDoneToBoss,
        this.playersDpsMessage,
        this.fightDurationInSeconds
      );
      this.cmdMsg(this.lastFightStats);
      if (this.Config.settings.autoPasteDpsInPartyChatEnabled)
        sendMsgInPartyChat(this.mod)(this.lastFightStats);
    }

    this.resetData();
  }

  handleCommand(key, value) {
    switch (key) {
      case "startondmg":
        this.toggleEnabledSettings("startFightOnFirstDmgHit");
        break;
      case "partydps":
        this.toggleEnabledSettings("liveDpsMeterEnabled");
        break;
      case "personaldps":
        this.toggleEnabledSettings("personalDpsEnabled");
        break;
      case "timer":
        this.toggleEnabledSettings("timerEnabled");
        break;
      case "autopaste":
        this.toggleEnabledSettings("autoPasteDpsInPartyChatEnabled");
        break;
      case "paste":
        if (!this.lastFightStats) return;
        sendMsgInPartyChat(this.mod)(this.lastFightStats);
        break;
      case "start":
        this.toggleEnabledSettings("fightStartNotifyEnabled");
        break;
      case "burnr":
        this.toggleEnabledSettings("burnReminderEnabled");
        break;
      default:
        this.showHelp();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">FightStats Commands:</font>
<font color="#56B4E9">startondmg</font>: Toggle start fight on first damage hit.
<font color="#56B4E9">partydps</font>: Toggle live party DPS meter.
<font color="#56B4E9">personaldps</font>: Toggle personal DPS meter.
<font color="#56B4E9">timer</font>: Toggle fight timer.
<font color="#56B4E9">autopaste</font>: Toggle auto paste DPS in party chat.
<font color="#56B4E9">paste</font>: Paste last fight stats in party chat.
<font color="#56B4E9">start</font>: Toggle fight start notification.
<font color="#56B4E9">burnr</font>: Toggle burn reminder.`;
    this.cmdMsg(helpMessage);
  }

  resetData() {
    this.mod.clearInterval(this.dpsDisplayTimerInterval);
    this.mod.clearInterval(this.fightTimerUpdateInterval);
    this.fightStartInSeconds = 0;
    this.fightDurationInSeconds = 0;
    this.personalDamageDone = 0;
    this.personalDps = "0 M/s";
    this.damageDoneToBoss = 0;
    this.playersDpsMessage = "";
    this.bossName = null;
    this.bossHp = 0;
    sendCustomStyleMessage(this.mod)(
      " ",
      ...Object.values(MessageTypes.PersonalDPS)
    );
    this.resetReportAndStats();

    Object.keys(this.playersDps).forEach((k) => delete this.playersDps[k]);
  }

  resetReportAndStats() {
    this.fightStartInSeconds = 0;
    this.mod.clearInterval(this.statsUpdateInterval);

    for (const key in this.report) {
      if (Object.hasOwnProperty.call(this.report, key)) {
        this.report[key] = 0;
      }
    }
    this.stats = { ...this.defaultStats };
  }

  updateReport() {
    const now = Math.floor(Date.now() / 1000);
    const fightTimeInSeconds = now - this.fightStartInSeconds;
    const minutesInFight = Math.floor(fightTimeInSeconds / 60);

    const secondsOfMetaPassed =
      fightTimeInSeconds % 60 <= this.stats.MetaSeconds
        ? minutesInFight * this.stats.MetaSeconds + (fightTimeInSeconds % 60)
        : (minutesInFight + 1) * this.stats.MetaSeconds;

    this.report.healerDebuff =
      this.stats.hDebuffTime / (fightTimeInSeconds / 100);
    this.report.healerCBuff =
      this.stats.hCBuffTime / (fightTimeInSeconds / 100);
    this.report.healerBurnBuff =
      this.stats.hBBuffTime / (fightTimeInSeconds / 100);
    this.report.healerBurnBuffMetaSync =
      this.stats.hBBuffTimeMetaSync > 0
        ? this.stats.hBBuffTimeMetaSync / (secondsOfMetaPassed / 100)
        : 0;

    this.report.tankDebuff =
      this.stats.tDebuffTime / (fightTimeInSeconds / 100);
    this.report.tankCBuff = this.stats.tCBuffTime / (fightTimeInSeconds / 100);
    this.report.tankBurnBuff =
      this.stats.tBBuffTime / (fightTimeInSeconds / 100);
    this.report.tankBurnBuffMetaSync =
      this.stats.tBBuffTimeMetaSync > 0
        ? this.stats.tBBuffTimeMetaSync / (secondsOfMetaPassed / 100)
        : 0;

    this.report.bossEnraged =
      this.stats.bossEnragedTime / (fightTimeInSeconds / 100);
    this.report.bossBEnraged =
      this.stats.bossBEnragedTime / (secondsOfMetaPassed / 100);

    this.report.tankHealerSync =
      this.stats.tankHealerSyncTime > 0
        ? this.stats.tankHealerSyncTime / (secondsOfMetaPassed / 100)
        : 0;

    if (this.Config.settings.liveDpsMeterEnabled)
      this.cmdMsg(
        Messages.UptimesReport(
          this.bossName,
          this.bossHp,
          this.report,
          this.damageDoneToBoss,
          this.playersDpsMessage,
          this.fightDurationInSeconds
        )
      );
  }

  isAbnormUp(timestamp) {
    return (ab) => timestamp < this.abnormsEndTimestamps[ab];
  }

  createStatsUpdateInterval() {
    return this.mod.setInterval(() => {
      const now = Date.now();
      const isAbnormUpNow = this.isAbnormUp(now);

      const HealerConstantBuffUp =
        this.healerConstantBuffs.slice(0, 2).every(isAbnormUpNow) ||
        this.healerConstantBuffs.slice(2).every(isAbnormUpNow);

      const HealerDebuffUp =
        this.healerConstantDebuffs.slice(0, 1).every(isAbnormUpNow) ||
        this.healerConstantDebuffs.slice(1).every(isAbnormUpNow);

      const priestBurnUp = isAbnormUpNow(this.healerBurnBuffs[0]);
      const mysticBurnUp =
        isAbnormUpNow(this.healerBurnBuffs[1]) &&
        isAbnormUpNow(this.mysticBurnDebuff);
      const HealerBurnUp = [priestBurnUp, mysticBurnUp].slice().find((c) => c);

      const TankConstantBuffUp = this.tankConstantBuffs.find(isAbnormUpNow);

      const TankDebuffUp =
        this.tankConstantDebuffs.slice(0, 2).every(isAbnormUpNow) ||
        this.tankConstantDebuffs.slice(2).find(isAbnormUpNow);
      const zerkTankBurnUp = isAbnormUpNow(this.tankBurnBuffs[0]);
      const brawlerBurnUp = isAbnormUpNow(this.tankBurnDebuffs[0]);
      const lancerBurnUp = this.tankBurnBuffs.slice(1).every(isAbnormUpNow);
      const TankBurnUp = [zerkTankBurnUp, brawlerBurnUp, lancerBurnUp]
        .slice()
        .find((c) => c);

      if (HealerDebuffUp) this.stats.hDebuffTime++;
      if (HealerConstantBuffUp) this.stats.hCBuffTime++;
      if (HealerBurnUp) this.stats.hBBuffTime++;
      if (TankDebuffUp) this.stats.tDebuffTime++;
      if (TankConstantBuffUp) this.stats.tCBuffTime++;
      if (TankBurnUp) this.stats.tBBuffTime++;

      if (
        this.fightDurationInSeconds % 60 > 0 &&
        this.fightDurationInSeconds % 60 <= this.stats.MetaSeconds
      ) {
        if (TankBurnUp) this.stats.tBBuffTimeMetaSync++;
        if (HealerBurnUp) this.stats.hBBuffTimeMetaSync++;
        if (this.stats.bossEnraged == 1) this.stats.bossBEnragedTime++;
      }

      if (this.stats.bossEnraged == 1) this.stats.bossEnragedTime++;

      if (HealerBurnUp && TankBurnUp) this.stats.tankHealerSyncTime++;

      this.updateReport();
    }, 1000);
  }

  resetData() {
    this.mod.clearInterval(this.dpsDisplayTimerInterval);
    this.mod.clearInterval(this.fightTimerUpdateInterval);
    this.fightStartInSeconds = 0;
    this.fightDurationInSeconds = 0;
    this.personalDamageDone = 0;
    this.personalDps = "0 M/s";
    this.damageDoneToBoss = 0;
    this.playersDpsMessage = "";
    this.bossName = null;
    this.bossHp = 0;
    sendCustomStyleMessage(this.mod)(
      " ",
      ...Object.values(MessageTypes.PersonalDPS)
    );
    this.resetReportAndStats();

    Object.keys(this.playersDps).forEach((k) => delete this.playersDps[k]);
  }

  setFightTimerInterval() {
    return this.mod.setInterval(() => {
      const timestampInSeconds = Math.floor(Date.now() / 1000);
      this.fightDurationInSeconds =
        timestampInSeconds - this.fightStartInSeconds;
      const playerDpsList = Object.keys(this.playersDps).map((player) => [
        player,
        this.playersDps[player],
      ]);

      playerDpsList.sort((a, b) => b[1] - a[1]);

      const dpsPlayersDpsMessage = playerDpsList
        .map(
          (k) =>
            `${k[0]}: ${Messages.PlayerDPS(k[1], this.fightDurationInSeconds)}`
        )
        .slice(0, 3)
        .join(" - ");

      this.playersDpsMessage = `${dpsPlayersDpsMessage}\n${playerDpsList
        .map(
          (k) =>
            `${k[0]}: ${Messages.PlayerDPS(k[1], this.fightDurationInSeconds)}`
        )
        .slice(3, 5)
        .join(" - ")}`;

      if (
        this.Config.settings.burnReminderEnabled &&
        this.fightDurationInSeconds % 60 != 0 &&
        (this.fightDurationInSeconds % 60) % 57 == 0
      )
        ttsSay("burn in 3", null);

      this.personalDps = Messages.PlayerDPS(
        this.personalDamageDone,
        this.fightDurationInSeconds
      );
    }, 300);
  }

  setDisplayDpsInterval() {
    return this.mod.setInterval(() => {
      let msg = "";

      if (this.Config.settings.timerEnabled)
        msg +=
          Messages.FightTimer(Math.ceil(this.fightDurationInSeconds)) +
          " ".repeat(13);

      if (this.Config.settings.personalDpsEnabled) msg += this.personalDps;

      setImmediate(() => {
        sendCustomStyleMessage(this.mod)(
          msg,
          ...Object.values(MessageTypes.PersonalDPS)
        );
      });
    }, 300);
  }
}

module.exports = FightStatsMod;
