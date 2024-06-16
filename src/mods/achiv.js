const BaseMod = require("./base");

class AchievementTrackerMod extends BaseMod {
  static Version = 1;

  static Name = "achiv";
  Description = "Track and display achievement progress";

  Hooks = {};
  Commands = null;
  EventListeners = {};

  constructor(mod, config) {
    super(mod, config);

    this.cache = {
      achievements: {},
      strings: {},
      progress: {},
    };

    this.Hooks = {
      S_UPDATE_ACHIEVEMENT_PROGRESS: {
        version: "*",
        handler: ({ achievements }) => {
          if (!this.Config.enabled) return;
          this.getData(achievements.map(({ id }) => id)).then(() => {
            achievements.forEach((achievement) => {
              if (!(mod.game.me.name in this.cache.progress))
                this.cache.progress[mod.game.me.name] = {};
              if (
                achievement.id in this.cache.progress[mod.game.me.name] &&
                achievement.id in this.cache.achievements
              ) {
                achievement.requirements.forEach((requirement) => {
                  const cached = this.cache.progress[mod.game.me.name][
                    achievement.id
                  ].requirements.find(
                    ({ index }) => index === requirement.index
                  );
                  if (cached?.amount < requirement.amount) {
                    const achievementData =
                      this.cache.achievements[achievement.id];
                    const conditionData = achievementData.conditions.find(
                      ({ id }) => id === requirement.index
                    );
                    if (requirement.amount <= conditionData?.max) {
                      this.dungeonMessage(
                        `${achievementData.name}: ${conditionData.string} (${requirement.amount}/${conditionData.max})`,
                        33
                      );
                    }
                  }
                });
              }
              this.cache.progress[mod.game.me.name][achievement.id] =
                achievement;
            });
          });
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
      case "tb":
        this.toggleEnabledSettings("achievementTrackerTbMsgEnabled");
        break;
      default:
        this.toggleEnableMod();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">AchievementTrackerMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">tb</font>: Toggle Achievement Tracker TB Msg.
<font color="#56B4E9">[any other key]</font>: Toggle Achievement Tracker.`;
    this.cmdMsg(helpMessage);
  }

  dungeonMessage(message, type = 43) {
    this.mod.send("S_DUNGEON_EVENT_MESSAGE", "*", {
      type: type,
      chat: false,
      channel: 0,
      message: message,
    });
    if (this.Config.settings.achievementTrackerTbMsgEnabled)
      this.cmdMsg(message);
  }

  async getString(name) {
    const id = /^@Achievement:(?<id>\d+)$/.exec(name).groups.id;
    if (!(id in this.cache.strings)) {
      const result = await this.mod.queryData(
        "/StrSheet_Achievement/String@id=?/",
        [Number(id)],
        false,
        false,
        ["string"]
      );
      this.cache.strings[id] = result?.attributes.string ?? "";
    }
    return this.cache.strings[id];
  }

  async getData(ids) {
    const filtered = ids.filter((id) => !(id in this.cache.achievements));
    if (filtered.length > 0) {
      const achievements = await this.mod.queryData(
        "/AchievementList/Achievement@id=?/",
        [ids],
        true
      );
      for (const {
        attributes: { id, name: rawName },
        children,
      } of achievements) {
        const name = await this.getString(rawName);
        const conditions = children
          .filter(
            ({ name, attributes: { type } }) =>
              name === "Condition" && type !== "check"
          )
          .map(({ attributes }) => attributes);
        for (const condition of conditions) {
          if (condition.string !== undefined)
            condition.string = await this.getString(condition.string);
        }
        this.cache.achievements[id] = { name, conditions };
      }
    }
  }
}

module.exports = AchievementTrackerMod;
