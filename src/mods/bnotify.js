const BaseMod = require("./base");
const { sendCustomStyleMessage } = require("tera-mod-commons");

const MessageTypes = {
  EndOfFight: { id: 3, style: 49 },
  DpsBurning: { id: 4, style: 51 },
  TrackedDebuffExpiring: { id: 5, style: 51 },
  TrackedAbnormalityActivated: { id: 6, style: 51 },
};

const Messages = {
  BattleNotifyDebugModeEnabled: (enabled) =>
    `Battle notify debug: ${
      enabled
        ? '<font color="#56B4E9">enabled</font>'
        : '<font color="#E69F00">disabled</font>'
    }.`,
  BurnNotifyEnabled: (enabled) =>
    `Burn notify: ${
      enabled
        ? '<font color="#56B4E9">enabled</font>'
        : '<font color="#E69F00">disabled</font>'
    }.`,

  DebuffReminderEnabled: (enabled) =>
    `Debuff reminder: ${
      enabled
        ? '<font color="#56B4E9">enabled</font>'
        : '<font color="#E69F00">disabled</font>'
    }.`,
  TrackedDebuffExpired: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;expired</font>`,
  TrackedDebuffExpiring: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;ending</font>`,
  TrackedAbnormalityActivated: (eventId) =>
    `<img src='img://abonormality__${eventId}' width='48' height='48' vspace='-7' /><font size="24">&nbsp;activated</font>`,
  DpsBurning: (dpsName) => `${dpsName} is burning`,
};

class SimpleBattleNotify extends BaseMod {
  static Version = 1;

  static Name = "bnotify";
  Description = "Provides notifications for battle events";

  Hooks = {};
  Commands = null;
  EventListeners = {};
  PlayerRoles = {
    Tank: 0,
    DPS: 1,
    Healer: 2,
  };
  tankAbnorms = [401400, 100201, 10153040];
  trackedAbnorms = {};
  playerRole = this.PlayerRoles.DPS;
  bossGameId = null;
  fightStartInSeconds = 0;

  BurnSkillsMap = [
    { skillId: 163100, class: 8, className: "Reaper" },
    { skillId: 260102, class: 10, className: "Brawler" },
    { skillId: 200200, class: 0, className: "Warrior" },
    { skillId: 80200, class: 11, className: "Ninja" },
    { skillId: 340200, class: 4, className: "Sorc" },
    { skillId: 340230, class: 4, className: "Sorc" },
    { skillId: 210200, class: 3, className: "Zerker" },
    { skillId: 203200, class: 2, className: "Slayer" },
    { skillId: 120130, class: 12, className: "Valkyrie" },
    { skillId: 120199, class: 12, className: "Valkyrie" },
    { skillId: 120100, class: 12, className: "Valkyrie" },
    { skillId: 350100, class: 5, className: "Archer" },
    { skillId: 410101, class: 9, className: "Gunner" },
  ];

  constructor(mod, config) {
    super(mod, config);

    this.EventListeners = {
      change_template: (templateId, playerClass, race, gender) => {
        this.setPlayerRole(playerClass);
      },
      change_zone: (zone, quick) => {
        this.resetData();
        this.setPlayerRole(this.mod.game.me.class);
      },
    };

    this.Hooks = {
      S_BOSS_GAGE_INFO: {
        version: "*",
        handler: (event) => {
          if (this.bossGameId != event.id) this.bossGameId = event.id;
          if (event.curHp == event.maxHp) this.fightStartInSeconds = 0;
          if (event.curHp < event.maxHp && this.fightStartInSeconds == 0)
            this.fightStartInSeconds = Math.floor(Date.now() / 1000);
        },
      },
      S_DESPAWN_NPC: {
        version: "*",
        handler: (event) => {
          if (event.gameId != this.bossGameId) return;
          this.resetData();
        },
      },
      S_ACTION_STAGE: {
        version: "*",
        position: -9999999,
        handler: (event) => {
          const partyMember = this.mod.game.party?.getMemberData(event.gameId);

          if (
            partyMember &&
            this.mod.game.me.gameId != event.gameId &&
            this.Config.settings.burnNotifyEnabled &&
            this.fightStartInSeconds != 0 &&
            this.BurnSkillsMap.find(
              (i) => event.skill.id == i.skillId && partyMember.class == i.class
            )
          )
            sendCustomStyleMessage(this.mod)(
              Messages.DpsBurning(partyMember.name),
              ...Object.values(MessageTypes.DpsBurning)
            );
        },
      },
      S_ABNORMALITY_BEGIN: {
        version: "*",
        position: -9999999,
        handler: (event) => {
          if (
            !this.Config.settings.debuffReminderEnabled ||
            !(event.id in this.Config.settings.trackedAbnormalities)
          )
            return;

          const { needsTankAbnorm, tankDebuff, supportDebuff } =
            this.Config.settings.trackedAbnormalities[event.id];

          if (
            event.source != this.mod.game.me.gameId &&
            this.mod.game.party.getMemberData(event.source)
          ) {
            if (!tankDebuff && !supportDebuff)
              sendCustomStyleMessage(this.mod)(
                Messages.TrackedAbnormalityActivated(event.id),
                ...Object.values(MessageTypes.TrackedAbnormalityActivated)
              );
            return;
          }

          if (
            needsTankAbnorm &&
            !this.tankAbnorms.find((ab) => ab in this.mod.game.me.abnormalities)
          )
            return;

          if (event.target == this.bossGameId) {
            if (!this.trackedAbnorms[event.id])
              this.trackedAbnorms[event.id] = {};

            const abnorm = this.trackedAbnorms[event.id];
            this.mod.clearInterval(abnorm.interval);
            this.mod.clearTimeout(abnorm.timeout);
            abnorm.timeout = this.mod.setTimeout(() => {
              sendCustomStyleMessage(this.mod)(
                Messages.TrackedDebuffExpiring(event.id),
                event.id,
                MessageTypes.TrackedDebuffExpiring.style
              );
            }, Number(event.duration) - 3 * 1000);
          }
        },
      },
      S_ABNORMALITY_REFRESH: {
        version: "*",
        position: -9999999,
        handler: (event) => {
          const trackedAbnorm = this.trackedAbnorms[event.id];

          if (event.target != this.bossGameId || !trackedAbnorm) return;

          const { needsTankAbnorm } =
            this.Config.settings.trackedAbnormalities[event.id];

          if (
            needsTankAbnorm &&
            !this.tankAbnorms.find((ab) => ab in this.mod.game.me.abnormalities)
          )
            return;

          this.mod.clearInterval(trackedAbnorm.interval);
          this.mod.clearTimeout(trackedAbnorm.timeout);
          trackedAbnorm.timeout = this.mod.setTimeout(() => {
            sendCustomStyleMessage(this.mod)(
              Messages.TrackedDebuffExpiring(event.id),
              event.id,
              MessageTypes.TrackedDebuffExpiring.style
            );
          }, Number(event.duration) - 3 * 1000);
        },
      },
      S_ABNORMALITY_END: {
        version: "*",
        position: -9999999,
        handler: (event) => {
          const trackedAbnorm = this.trackedAbnorms[event.id];

          if (
            !this.Config.settings.debuffReminderEnabled ||
            event.target != this.bossGameId ||
            !(event.id in this.Config.settings.trackedAbnormalities) ||
            !trackedAbnorm
          )
            return;

          const { tankDebuff, supportDebuff } =
            this.Config.settings.trackedAbnormalities[event.id];

          if (
            (tankDebuff &&
              this.tankAbnorms.find(
                (ab) => ab in this.mod.game.me.abnormalities
              )) ||
            (supportDebuff && this.playerRole == this.PlayerRoles.Healer)
          ) {
            this.sendDebuffExpiredMsg(event.id);
            this.mod.clearInterval(trackedAbnorm.interval);
            this.mod.clearTimeout(trackedAbnorm.timeout);
            trackedAbnorm.expiredWarnings = 0;
            trackedAbnorm.interval = this.mod.setInterval(() => {
              this.sendDebuffExpiredMsg(event.id);
              trackedAbnorm.expiredWarnings++;
              if (trackedAbnorm.expiredWarnings >= 3) {
                this.mod.clearInterval(trackedAbnorm.interval);
                delete this.trackedAbnorms[event.id];
              }
            }, 2 * 1000);
          }
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
      case "burnn":
        this.toggleEnabledSettings("burnNotifyEnabled");
        break;
      case "debuffr":
        this.toggleEnabledSettings("debuffReminderEnabled");
        break;
      default:
        this.showStatus();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">BattleNotify Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">burnn</font>: Toggle burn notify.
<font color="#56B4E9">debuffr</font>: Toggle debuff reminder.
<font color="#56B4E9">[any other key]</font>: Show status.`;
    this.cmdMsg(helpMessage);
  }

  showStatus() {
    const { burnNotifyEnabled } = this.Config.settings;

    this.cmdMsg(Messages.BurnNotifyEnabled(burnNotifyEnabled));
  }

  setPlayerRole(playerClass) {
    switch (playerClass) {
      case "lancer":
        this.playerRole = this.PlayerRoles.Tank;
        break;
      case "priest":
      case "mystic":
        this.playerRole = this.PlayerRoles.Healer;
        break;
      default:
        this.playerRole = this.PlayerRoles.DPS;
        break;
    }
  }

  resetData() {
    this.fightStartInSeconds = 0;
    this.playerRole = this.PlayerRoles.DPS;

    for (const abnorm in this.trackedAbnorms) {
      const { timeout, interval } = this.trackedAbnorms[abnorm];
      this.mod.clearTimeout(timeout);
      this.mod.clearInterval(interval);
    }
  }

  sendDebuffExpiredMsg(eventId) {
    sendCustomStyleMessage(this.mod)(
      Messages.TrackedDebuffExpired(eventId),
      eventId,
      MessageTypes.TrackedDebuffExpiring.style
    );
  }
}

module.exports = SimpleBattleNotify;
