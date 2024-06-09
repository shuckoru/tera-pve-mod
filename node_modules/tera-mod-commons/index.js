const path = require("path");
const fs = require("fs");
const NodeCache = require("node-cache");
const dotenv = require("dotenv");

const say = require("say");

const cache = new NodeCache();

const ChatChannels = {
  Say: 0,
  Party: 1,
  Guild: 2,
  Area: 3,
  Trade: 4,
  Greet: 9,
  FirstPrivateChannel: 11,
  LastPrivateChannel: 18,
  PartyNotice: 21,
  RaidNotice: 25,
  Emote: 26,
  Global: 27,
  Raid: 32,
  Megaphone: 213,
  GuildAdv: 214,
};

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const reloadEnv = () => {
  const envConfig = dotenv.parse(
    fs.readFileSync(path.join(__dirname, "..", ".env"))
  );

  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
};

const ttsSay = (msg, msgId) => {
  let cacheKey = msgId ? `ttsSay${msgId}` : `ttsSay${msg}`;
  if (cache.get(cacheKey) != undefined) return;

  say.speak(msg, "Microsoft Zira Desktop");

  cache.set(cacheKey, msg, 1);
};

const sendCustomStyleMessage = (mod) => (msg, msgId, style) => {
  let cacheKey = `sendCustomStyleMessage${msgId}`;
  if (cache.get(cacheKey) != undefined) return;

  mod.send("S_CUSTOM_STYLE_SYSTEM_MESSAGE", "*", {
    style: style,
    message: msg,
  });

  cache.set(cacheKey, msg, 1);
};

const sendMsg = (mod) => (msg, chatName) => {
  let cacheKey = `sendMsg${msg}`;
  if (cache.get(cacheKey) != undefined) return;

  mod.send("S_CHAT", "*", {
    name: chatName,
    message: msg,
  });

  cache.set(cacheKey, msg, 0.5);
};

const sendMsgInPartyChat = (mod) => (msg) => {
  if (!msg) return;
  let cacheKey = `sendMsgInPartyChat${msg}`;
  if (cache.get(cacheKey) != undefined) return;

  msg.split("\n").forEach(async (splitMsg) => {
    await mod.send("C_CHAT", "*", {
      channel: ChatChannels.Party,
      message: splitMsg,
    });
    await delay(300);
  });

  cache.set(cacheKey, msg, 0.5);
};

const sendMsgInCustomPrivateChannel = (mod) => (msg, channelId) => {
  let cacheKey = "sendMsgInCustomChannel" + msg;
  if (cache.get(cacheKey) != undefined) return;

  mod.send("S_CHAT", "*", {
    channel: channelId,
    message: msg,
  });

  cache.set(cacheKey, msg, 0.5);
};

const sendModuleBasedInGameCmdMessage = (mod) => (moduleName) => (msg) =>
  mod.command.message(`[${moduleName}] ${msg}`);

const sendModuleBasedInGameCmdMessageFromObject =
  (mod) => (moduleName) => (obj) => {
    let msg = "\n";
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        msg += `${key}: ${obj[key]}\n`;
      }
    }
    mod.command.message(`[${moduleName}] ${msg}`);
  };

module.exports = {
  sendMsg,
  sendCustomStyleMessage,
  sendMsgInPartyChat,
  sendMsgInCustomPrivateChannel,
  ChatChannels,
  reloadEnv,
  sendModuleBasedInGameCmdMessage,
  sendModuleBasedInGameCmdMessageFromObject,
  ttsSay,
};
