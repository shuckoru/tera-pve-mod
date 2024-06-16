const BaseMod = require("./base");
const fetch = require("node-fetch");

const Messages = {
  ApplyInspectEnabled: (enabled) =>
    `Apply Inspect: ${
      enabled
        ? '<font color="#56B4E9">enabled</font>'
        : '<font color="#E69F00">disabled</font>'
    }.`,
  AvailableDungeonsLookups: (dungeons) =>
    `Available dungeons lookups: ${dungeons}`,
  DungeonNotFound: "Dungeon not found.",
  PlayerDpsNotFound: (playerName, detectedDungeon) =>
    `Player ${playerName} dps in dungeon ${detectedDungeon} not found.`,
  PlayerDpsMessage: (
    detectedDungeon,
    playerName,
    playerDpsAsDPS,
    playerDpsAsTank
  ) => {
    let msg = `[${detectedDungeon} -> ${playerName}]:`;
    if (playerDpsAsDPS)
      msg += ` DPS ${(playerDpsAsDPS / 1000000).toFixed(2)} M/s`;
    if (playerDpsAsTank)
      msg += ` Tank ${(playerDpsAsTank / 1000000).toFixed(2)} M/s`;
    return msg;
  },
};

class TeralogsMod extends BaseMod {
  static Version = 1;

  static Name = "tl";
  Description = "Provides dungeon lookup capabilities for teralogs.com.";

  constructor(mod, config) {
    super(mod, config);

    this.dungeons = {};
    this.setDungeons();

    this.Hooks = {
      S_OTHER_USER_APPLY_PARTY: {
        version: "*",
        handler: this.handleApplyParty.bind(this),
      },
    };

    this.Commands = async (key, value) => {
      this.handleCommand(key, value);
    };
  }

  async setDungeons() {
    const res = await fetch("https://api.teralogs.com/graphql", {
      headers: {
        accept: "*/*",
        "content-type": "application/json",
      },
      body: '{"operationName":"GetAvailableLeaderboards","variables":{},"query":"query GetAvailableLeaderboards {\\n  availableLeaderboards {\\n    areaId\\n    areaName\\n    bossId\\n    bossName\\n    version\\n  }\\n}\\n"}',
      method: "POST",
    });
    const body = await res.json();

    body.data?.availableLeaderboards.forEach(
      ({ areaId, areaName, bossId, version }) => {
        const splitAreaName = areaName.split(" ");
        let lettersOfDungeon =
          splitAreaName.length > 1
            ? splitAreaName[0][0] + splitAreaName[1][0]
            : splitAreaName[0][0];

        lettersOfDungeon = areaName.includes("Hard")
          ? lettersOfDungeon + "H"
          : lettersOfDungeon + "N";

        lettersOfDungeon = lettersOfDungeon.toUpperCase();

        if (this.dungeons[lettersOfDungeon]?.bossId > bossId) return;

        this.dungeons[lettersOfDungeon] = this.dungeons[areaName] = {
          areaId,
          bossId,
          version,
          areaName,
        };
      }
    );
  }

  async getDungeonFromString(lfgMessage) {
    return Object.keys(this.dungeons).find((e) =>
      lfgMessage.toUpperCase().includes(e)
    );
  }

  async getPlayerHighestDpsInActiveDungeon(
    playerName,
    areaId,
    bossId,
    dungeonVersion,
    isTank,
    excludeBanned
  ) {
    const res = await fetch("https://api.teralogs.com/graphql", {
      headers: {
        accept: "*/*",
        "content-type": "application/json",
      },
      body: `{\"operationName\":\"SearchPlayers\",\"variables\":{},\"query\":\"query SearchPlayers {\\n  searchPlayers(\\n    searchVars: {query: \\\"${playerName}\\\", sort: \\\"dps\\\", limit: 1, areaId: ${areaId}, bossId: ${bossId}, version: ${dungeonVersion}, isTank: ${isTank}, excludeBanned: ${excludeBanned}}\\n  ) {\\n    dps\\n  }\\n}\\n\"}`,
      method: "POST",
    });
    const body = await res.json();

    return body.data.searchPlayers[0]?.dps;
  }

  getLfgMessage() {
    return new Promise((resolve) => {
      this.mod.hookOnce("S_MY_PARTY_MATCH_INFO", "*", (e) => {
        resolve(e.message);
      });

      this.mod.toServer("C_REQUEST_MY_PARTY_MATCH_INFO", "*");
    });
  }

  async handleApplyParty(event) {
    if (!this.Config.settings.applyInspectEnabled) return;

    const myLfgMessage = await this.getLfgMessage();
    const detectedDungeon = await this.getDungeonFromString(myLfgMessage);

    if (!detectedDungeon) return;

    const { areaId, bossId, version } = this.dungeons[detectedDungeon];

    const playerDpsInDungeonAsDps =
      await this.getPlayerHighestDpsInActiveDungeon(
        event.name,
        areaId,
        bossId,
        version,
        false,
        true
      );
    const playerDpsInDungeonAsTank =
      await this.getPlayerHighestDpsInActiveDungeon(
        event.name,
        areaId,
        bossId,
        version,
        true,
        true
      );

    if (!playerDpsInDungeonAsDps && !playerDpsInDungeonAsTank) return;

    const msg = Messages.PlayerDpsMessage(
      detectedDungeon,
      event.name,
      playerDpsInDungeonAsDps,
      playerDpsInDungeonAsTank
    );
    this.cmdMsg(msg);
  }

  async handleCommand(key, value) {
    if (key) key = key.toLowerCase();
    if (value) value = value.toLowerCase();
    switch (key) {
      case "help":
        this.showHelp();
        break;
      case "apply":
        this.toggleEnabledSettings("applyInspectEnabled");
        break;
      case "ls":
        this.cmdMsg(
          Messages.AvailableDungeonsLookups(
            Object.keys(this.dungeons)
              .filter((e) => e.length < 4)
              .join(", ")
          )
        );
        break;
      default:
        try {
          const playerName = value;
          const requestedDungeon = key;
          const detectedDungeon = await this.getDungeonFromString(
            requestedDungeon
          );
          if (!detectedDungeon) return this.cmdMsg(Messages.DungeonNotFound);
          const { areaId, bossId, version } = this.dungeons[detectedDungeon];
          const playerDpsAsDPS = await this.getPlayerHighestDpsInActiveDungeon(
            playerName,
            areaId,
            bossId,
            version,
            false,
            true
          );
          const playerDpsAsTank = await this.getPlayerHighestDpsInActiveDungeon(
            playerName,
            areaId,
            bossId,
            version,
            true,
            true
          );
          if (!playerDpsAsDPS && !playerDpsAsTank)
            return this.cmdMsg(
              Messages.PlayerDpsNotFound(playerName, detectedDungeon)
            );

          const msg = Messages.PlayerDpsMessage(
            detectedDungeon,
            playerName,
            playerDpsAsDPS,
            playerDpsAsTank
          );
          this.cmdMsg(msg);
        } catch (error) {
          this.showHelp();
        }
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">TeralogsMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">apply</font>: Toggle apply inspect.
<font color="#56B4E9">ls</font>: List available dungeons lookups.
<font color="#56B4E9">[dungeon] [playerName]</font>: Get player's highest DPS in a dungeon.`;
    this.cmdMsg(helpMessage);
  }
}

module.exports = TeralogsMod;
