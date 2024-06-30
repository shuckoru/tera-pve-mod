const BaseMod = require("./base");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { updateModConfig } = require("../config");
const fetch = require("node-fetch");

const Messages = {
  EncryptionEnabled: (enabled) =>
    `Encryption: ${
      enabled
        ? '<font color="#56B4E9">enabled</font>'
        : '<font color="#E69F00">disabled</font>'
    }.`,
  PrivateMessageSent: (recipient, message) =>
    `Private message sent to ${recipient}: ${message}`,
  PrivateMessageReceived: (sender, message) =>
    `Private message received from ${sender}: ${message}`,
  EncryptionHelp: `<font color="#56B4E9">Encryption Commands:</font>
<font color="#56B4E9">safechat</font>: Enable/Disable whisper encryption.
<font color="#56B4E9">add [player]</font>: Exchange public keys with a player.
<font color="#56B4E9">help</font>: Show this help message.`,

  PublicKeyRequestSent: (recipient) =>
    `Public key request sent to ${recipient}.`,
  PublicKeyReceived: (sender) => `Public key received from ${sender}.`,
  PublicKeySent: (recipient) => `Public key sent to ${recipient}.`,
};

class SafeChatMod extends BaseMod {
  static Version = 1;

  static Name = "safechat";
  Description = "Send and receive private messages using end-to-end encryption";
  Hooks = {};
  Commands = null;
  EncryptedMessageIdentifier = "EMsg: ";
  PublicKeyRequestIdentifier = "KeyReq: ";
  PublicKeyResponseIdentifier = "KeyRes: ";
  TranslatedMSGIdentifier = "(Translated) : ";
  SafeMSGIdentifier = "(Safe)";

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      C_WHISPER: {
        version: "*",
        position: -Infinity,
        handler: (event) => this.handleOutgoingWhisper(event),
      },
      S_WHISPER: {
        version: "*",
        position: Infinity,
        handler: (event) => this.handleIncomingWhisper(event),
      },
    };

    this.Commands = (key, value, ...args) => {
      this.handleCommand(key, value, args);
    };

    this.loadKeyPair();
  }

  handleOutgoingWhisper(event) {
    event.message = this.swearWordsFix(event.message);

    const msg = event.message;

    if (
      msg.startsWith(this.PublicKeyResponseIdentifier) ||
      msg.startsWith(this.PublicKeyRequestIdentifier) ||
      msg.startsWith(this.EncryptedMessageIdentifier)
    )
      return;

    if (
      this.Config.enabled &&
      event.target.toLowerCase() in this.Config.settings.playersPublicKeys
    ) {
      const encryptedMessage = this.encryptMessage(
        msg,
        event.target.toLowerCase()
      );

      if (this.isMessageEncrypted(encryptedMessage)) {
        event.message = encryptedMessage;
        this.mod.send("C_WHISPER", "*", event);

        const localWhisperEvent = {
          gameId: this.mod.game.me.gameId,
          isWorldEventTarget: false,
          gm: false,
          founder: false,
          name: this.mod.game.me.name,
          recipient: `${this.SafeMSGIdentifier}${event.target}`,
          message: msg,
        };

        this.mod.send("S_WHISPER", "*", localWhisperEvent);

        return false;
      }
    }
    return true;
  }

  handleIncomingWhisper(event) {
    const sender = event.name.toLowerCase();
    const receiver = event.recipient.toLowerCase();

    if (event.message.startsWith(this.PublicKeyResponseIdentifier)) {
      if (!this.isMe(sender)) {
        const [_, senderPublicKey] = event.message.split(" ");
        this.addPublicKey(sender, senderPublicKey);
      }
      return false;
    }

    if (event.message.startsWith(this.PublicKeyRequestIdentifier)) {
      if (!this.isMe(sender)) {
        this.sendPublicKey(sender);
        if (!(sender in this.Config.settings.playersPublicKeys))
          this.requestPublicKey(sender);
      }
      return false;
    }

    if (this.isMessageEncrypted(event.message)) {
      if (this.isMe(sender)) return false;

      event.message = this.decryptMessage(event.message);

      if (this.isMessageEncrypted(event.message)) {
        // TODO: handle this better by sending them key directly and also requesting new one
        event.message =
          "Sender tried to send an encrypted message but decryption failed. Make sure they have your updated keys.";
      } else {
        event.name = this.SafeMSGIdentifier + event.name;
      }
      return true;
    }

    if (
      this.Config.settings.translateMessages &&
      !event.message.startsWith(this.TranslatedMSGIdentifier)
    ) {
      const eventCopy = { ...event };
      this.translate(
        eventCopy.message,
        this.Config.settings.translateTo || "en"
      ).then((translatedMsg) => {
        if (translatedMsg.startsWith(this.TranslatedMSGIdentifier)) {
          eventCopy.message = translatedMsg;
          this.mod.send("S_WHISPER", "*", eventCopy);
        }
      });
      return;
    }
    event.message = this.swearWordsFix(event.message);
    return true;
  }

  addPublicKey(name, key) {
    this.Config.settings.playersPublicKeys[name.toLowerCase()] = key;
    updateModConfig(this.constructor.Name, this.Config);
    this.cmdMsg(Messages.PublicKeyReceived(name));
  }

  isMe(name) {
    return name.toLowerCase() == this.mod.game.me.name.toLowerCase();
  }

  encryptMessage(message, target) {
    // just in case
    target = target.toLowerCase();

    const targetPublicKey = this.Config.settings.playersPublicKeys[target];

    if (!targetPublicKey) {
      this.cmdMsg(
        `Public key for ${target} not found. Please exchange keys first.`
      );
      return null;
    }

    try {
      const ephemeralKeyPair = crypto.createECDH("prime256v1");
      const ephemeralPublicKey = ephemeralKeyPair.generateKeys("hex");
      const sharedSecret = ephemeralKeyPair.computeSecret(
        targetPublicKey,
        "hex"
      );

      const iv = crypto.randomBytes(16);
      const key = crypto.createHash("sha256").update(sharedSecret).digest();

      const cipher = crypto.createCipheriv("aes-256-gcm", key.slice(0, 32), iv);

      let encrypted = cipher.update(message, "utf8", "base64");
      encrypted += cipher.final("base64");
      const authTag = cipher.getAuthTag().toString("base64");

      const encryptedData = {
        encryptedMessage: encrypted,
        iv: iv.toString("base64"),
        authTag: authTag,
        ephemeralPublicKey: ephemeralPublicKey,
      };

      const encryptedDataStr = JSON.stringify(encryptedData);
      const encryptedDataBase64 = Buffer.from(
        encryptedDataStr,
        "utf8"
      ).toString("base64");

      // Remove non-alphanumeric characters from the Base64 string
      const encryptedDataAlphanumeric = encryptedDataBase64.replace(
        /[^a-zA-Z0-9]/g,
        ""
      );

      return this.EncryptedMessageIdentifier + encryptedDataAlphanumeric;
    } catch (error) {
      console.error(error);
      return message;
    }
  }

  decryptMessage(message) {
    if (!message.startsWith(this.EncryptedMessageIdentifier)) return message;

    try {
      const encryptedDataAlphanumeric = message.replace(
        this.EncryptedMessageIdentifier,
        ""
      );

      const paddedEncryptedDataBase64 =
        encryptedDataAlphanumeric +
        "=".repeat((4 - (encryptedDataAlphanumeric.length % 4)) % 4);

      const encryptedDataStr = Buffer.from(
        paddedEncryptedDataBase64,
        "base64"
      ).toString("utf8");
      const encryptedData = JSON.parse(encryptedDataStr);

      const { encryptedMessage, iv, authTag, ephemeralPublicKey } =
        encryptedData;
      const keyPair = crypto.createECDH("prime256v1");
      keyPair.setPrivateKey(this.privateKey, "hex");

      const sharedSecret = keyPair.computeSecret(ephemeralPublicKey, "hex");
      const key = crypto.createHash("sha256").update(sharedSecret).digest();

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key.slice(0, 32),
        Buffer.from(iv, "base64")
      );
      decipher.setAuthTag(Buffer.from(authTag, "base64"));

      let decrypted = decipher.update(encryptedMessage, "base64", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error(error);
      return message;
    }
  }

  isMessageEncrypted(message) {
    return message.startsWith(this.EncryptedMessageIdentifier);
  }

  loadKeyPair() {
    const privateKeyPath = path.join(__dirname, "..", "..", "private_key.pem");
    const publicKeyPath = path.join(__dirname, "..", "..", "public_key.pem");

    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      const keyPair = crypto.createECDH("prime256v1");
      const publicKey = keyPair.generateKeys("hex");
      const privateKey = keyPair.getPrivateKey("hex");

      fs.writeFileSync(privateKeyPath, privateKey);
      fs.writeFileSync(publicKeyPath, publicKey);
    }

    this.publicKey = fs.readFileSync(publicKeyPath, "utf8");
    this.privateKey = fs.readFileSync(privateKeyPath, "utf8");
  }

  async translate(text, targetLang) {
    let sourceLang = "auto";

    text = this.swearWordsFix(text);

    const url =
      "https://translate.google.com/translate_a/single" +
      "?client=at&dt=t&dt=ld&dt=qca&dt=rm&dt=bd&dj=1&hl=" +
      targetLang +
      "&ie=UTF-8" +
      "&oe=UTF-8&inputm=2&otf=2&iid=1dd3b944-fa62-4b55-b330-74909a99969e";

    const data = new URLSearchParams({
      sl: sourceLang,
      tl: targetLang,
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

    if (json.confidence < 0.2 || text == translatedMsg) return text;

    return this.TranslatedMSGIdentifier + translatedMsg;
  }

  swearWordsFix(message) {
    return message.replace(/<FONT>(.*?)<\/FONT>/g, "<FONT></FONT>$1");
  }

  requestPublicKey(player) {
    const requestMessage = `${this.PublicKeyRequestIdentifier}${this.mod.game.me.name} is requesting a safe chat connection.`;
    this.mod.send("C_WHISPER", "*", {
      message: requestMessage,
      target: player.toLowerCase(),
    });
    this.cmdMsg(Messages.PublicKeyRequestSent(player));
  }

  sendPublicKey(requester) {
    const responseMessage = this.PublicKeyResponseIdentifier + this.publicKey;
    this.mod.send("C_WHISPER", "*", {
      message: responseMessage,
      target: requester.toLowerCase(),
    });
    this.cmdMsg(Messages.PublicKeySent(requester));
  }

  handleCommand(key, value, args) {
    switch (key) {
      case "help":
        this.cmdMsg(Messages.EncryptionHelp);
        break;
      case "add":
        if (!value) {
          this.cmdMsg("Usage: add [player]");
        } else {
          const player = value.toLowerCase();
          this.requestPublicKey(player);
        }
        break;
      case "translate":
        this.toggleEnabledSettings("translateMessages");
        break;
      case "translateto":
        if (!value) {
          this.cmdMsg("Usage: translateto [language]");
        } else {
          this.updateSettingsValue("translateTo", value);
        }
        break;
      default:
        this.toggleEnableMod();
        break;
    }
  }
}

module.exports = SafeChatMod;
