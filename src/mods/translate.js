const fetch = require("node-fetch");

const BaseMod = require("./base");
const { updateModConfig } = require("../config");

const Messages = {
  TargetLanguage: (language) => `Target Language set to: ${language}.`,
  InvalidLanguage: (language) => `Error: ${language} is not a valid language.`,
  TargetLanguageStatus: (language) => `Target Language: ${language}.`,
  SendModeEnabled: (language) =>
    `Now translating outgoing messages to: ${language}`,
  HelpMessage: `<font color="#56B4E9">TranslateMod Commands:</font>
<font color="#56B4E9">translate</font>: Toggle module.
<font color="#56B4E9">translate source [language]</font>: Set source language.
<font color="#56B4E9">translate target [language]</font>: Set target language.
<font color="#56B4E9">translate send [language]</font>: Set send mode language.
<font color="#56B4E9">translate help</font>: Show this help message.`,
  OriginalMessage: (message) => `Original message: ${message}`,
};

class TranslateMod extends BaseMod {
  static Name = "translate";
  static Version = 1;
  Description = "Translates chat messages in real-time.";

  AVAILABLE_LANGUAGES = [
    "af",
    "sq",
    "ar",
    "az",
    "eu",
    "bn",
    "be",
    "bg",
    "ca",
    "zh-CN",
    "zh-TW",
    "hr",
    "cs",
    "da",
    "nl",
    "en",
    "eo",
    "et",
    "tl",
    "fi",
    "fr",
    "gl",
    "ka",
    "de",
    "el",
    "gu",
    "ht",
    "iw",
    "hi",
    "hu",
    "is",
    "id",
    "ga",
    "it",
    "ja",
    "kn",
    "ko",
    "la",
    "lv",
    "lt",
    "mk",
    "ms",
    "mt",
    "no",
    "fa",
    "pl",
    "pt",
    "ro",
    "ru",
    "sr",
    "sk",
    "sl",
    "es",
    "sw",
    "sv",
    "ta",
    "te",
    "th",
    "tr",
    "uk",
    "ur",
    "vi",
    "cy",
    "yi",
  ];

  TranslatedMSGIdentifier = "(T)";

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_CHAT: {
        handler: (event) => this.handleIncoming("S_CHAT", event),
      },
      S_PRIVATE_CHAT: {
        handler: (event) => this.handleIncoming("S_PRIVATE_CHAT", event),
      },
      C_CHAT: {
        handler: (event) => this.handleOutgoing("C_CHAT", event),
      },
    };

    this.Commands = async (key, value) => {
      this.handleCommand(key, value);
    };

    this.mod.game.on("leave_loading_screen", () => {
      if (this.Config.settings.sendMode) {
        this.cmdMsg(
          `Send Mode Enabled. Translating outgoing messages to ${this.Config.settings.sendLang}.`
        );
        this.cmdMsg('Use "/8 translate send off" to disable it.');
      }
    });
  }

  async handleCommand(key, language) {
    key = key ? key.toLowerCase() : null;
    language = language ? language.toLowerCase() : null;
    if (language && !this.AVAILABLE_LANGUAGES.includes(language)) {
      this.cmdMsg(Messages.InvalidLanguage(language));
      return;
    }
    switch (key) {
      case "target":
        if (!language) {
          this.cmdMsg(
            Messages.TargetLanguageStatus(this.Config.settings.targetLang)
          );
        } else {
          this.cmdMsg(Messages.TargetLanguage(language));
          this.Config.settings.targetLang = language;
          updateModConfig(this.constructor.Name, this.Config);
        }
        break;
      case "send":
        if (!language) {
          this.toggleEnabledSettings("sendMode");
        } else {
          this.Config.settings.sendLang = language;
          this.cmdMsg(Messages.SendModeEnabled(language));
          updateModConfig(this.constructor.Name, this.Config);
        }
        break;
      case "help":
        this.cmdMsg(Messages.HelpMessage);
        break;
      default:
        this.toggleEnableMod();
        break;
    }
  }

  handleIncoming(packet, event) {
    event.message = this.swearWordsFix(event.message);
    if (
      this.Config.enabled &&
      !this.mod.game.me.is(event.gameId) &&
      !event.message.includes(this.TranslatedMSGIdentifier)
    ) {
      this.translate(event.message, {
        target: this.Config.settings.targetLang,
      }).then((translated) => {
        if (translated)
          this.mod.send(packet, "*", {
            ...event,
            message: translated,
          });
      });
    }
    return true;
  }

  handleOutgoing(packet, event) {
    event.message = this.swearWordsFix(event.message);
    if (this.Config.enabled && this.Config.settings.sendMode) {
      const copyOfMsg = { ...event };
      this.translate(copyOfMsg.message, {
        target: this.Config.settings.sendLang,
      }).then((translated) => {
        if (translated)
          this.mod.send(packet, "*", {
            ...copyOfMsg,
            message: translated,
          });
      });
    }
    return true;
  }

  swearWordsFix(message) {
    return message.replace(/<FONT>(.*?)<\/FONT>/g, "<FONT></FONT>$1");
  }

  async translate(text, { target, source }) {
    const sanitized = text.replace(/<(.+?)>|&rt;|&lt;|&gt;|/g, "").trim();
    if (sanitized === "") return;
    let sourceLang = source ?? "auto";

    text = sanitized;

    const url =
      "https://translate.google.com/translate_a/single" +
      "?client=at&dt=t&dt=ld&dt=qca&dt=rm&dt=bd&dj=1&hl=" +
      target +
      "&ie=UTF-8" +
      "&oe=UTF-8&inputm=2&otf=2&iid=1dd3b944-fa62-4b55-b330-74909a99969e";

    const data = new URLSearchParams({
      sl: sourceLang,
      tl: target,
      q: text,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        "User-Agent":
          "AndroidTranslate/5.3.0.RC02.130475354-53000263 5.1 phone TRANSLATE_OPM5_TEST_1",
      },
      body: data.toString(),
    });

    if (response.status != 200) {
      console.error(response);
      return text;
    }

    const json = await response.json();

    const translatedMsg = json.sentences.map((e) => e.trans).join("");

    if (json.confidence < 0.2 || text == translatedMsg) return;

    return `<FONT>${this.TranslatedMSGIdentifier}: ${translatedMsg}</FONT>`;
  }
}

module.exports = TranslateMod;
