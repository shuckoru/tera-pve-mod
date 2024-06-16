const BaseMod = require("./base");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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
  CannotRequestPublicKeyWhenDisabled:
    "Encryption disabled. Cannot request public key.",
  PublicKeyRequestSent: (recipient) =>
    `Public key request sent to ${recipient}.`,
  PublicKeyReceived: (sender) => `Public key received from ${sender}.`,
  PublicKeySent: (recipient) => `Public key sent to ${recipient}.`,
};

class SafeChatMod extends BaseMod {
  static Version = 1;

  static Name = "safechat";
  Description = "Send and receive private messages using end-to-end encryption";
  Config = { playersPublicKeys: {} };
  Hooks = {};
  Commands = null;
  EncryptedMessageIdentifier = "EMsg: ";
  PublicKeyRequestIdentifier = "KeyReq: ";
  PublicKeyResponseIdentifier = "KeyRes: ";

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
    const msg = event.message.replace("<FONT>", "").replace("</FONT>", "");

    if (
      !this.Config.enabled ||
      msg.startsWith(this.PublicKeyRequestIdentifier) ||
      msg.startsWith(this.EncryptedMessageIdentifier)
    )
      return;

    if (event.target.toLowerCase() in this.Config.playersPublicKeys) {
      const encryptedMessage = this.encryptMessage(
        msg,
        event.target.toLowerCase()
      );
      if (encryptedMessage) {
        event.message = encryptedMessage;
        this.mod.send("C_WHISPER", "*", event);
        return false;
      }
    }
  }

  handleIncomingWhisper(event) {
    const msg = event.message.replace("<FONT>", "").replace("</FONT>", "");

    if (msg.startsWith(this.PublicKeyResponseIdentifier)) {
      const [_, senderPublicKey] = msg.split(" ");
      this.addPublicKey(event.name.toLowerCase(), senderPublicKey);
      this.cmdMsg(Messages.PublicKeyReceived(event.name.toLowerCase()));
      return false;
    }

    if (msg.startsWith(this.PublicKeyRequestIdentifier)) {
      if (
        event.name &&
        this.mod.game.me.name &&
        event.name.toLowerCase() != this.mod.game.me.name.toLowerCase()
      )
        this.sendPublicKey(event.name);
      return false;
    }

    if (
      this.Config.enabled &&
      event.message.startsWith(this.EncryptedMessageIdentifier)
    ) {
      event.message = this.decryptMessage(
        event.message,
        event.recipient.toLowerCase()
      );
      event.name = "(Safe)" + event.name;

      this.mod.send("S_WHISPER", "*", event);
      return false;
    }
  }

  addPublicKey(name, key) {
    this.Config.playersPublicKeys[name.toLowerCase()] = key;
  }

  encryptMessage(message, recipient) {
    // just in case
    recipient = recipient.toLowerCase();

    const recipientPublicKey = this.Config.playersPublicKeys[recipient];
    if (!recipientPublicKey) {
      this.cmdMsg(
        `Public key for ${recipient} not found. Please exchange keys first.`
      );
      return null;
    }

    const ephemeralKeyPair = crypto.createECDH("prime256v1");
    const ephemeralPublicKey = ephemeralKeyPair.generateKeys("hex");
    const sharedSecret = ephemeralKeyPair.computeSecret(
      recipientPublicKey,
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
    const encryptedDataBase64 = Buffer.from(encryptedDataStr, "utf8").toString(
      "base64"
    );

    // Remove non-alphanumeric characters from the Base64 string
    const encryptedDataAlphanumeric = encryptedDataBase64.replace(
      /[^a-zA-Z0-9]/g,
      ""
    );

    return this.EncryptedMessageIdentifier + encryptedDataAlphanumeric;
  }

  decryptMessage(message, sender) {
    // just in case
    sender = sender.toLowerCase();
    if (!message.startsWith(this.EncryptedMessageIdentifier)) return message;

    const senderPublicKey = this.Config.playersPublicKeys[sender];
    if (!senderPublicKey) {
      this.cmdMsg(
        `Public key for ${sender} not found. Cannot decrypt message.`
      );
      return message;
    }

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

    const { encryptedMessage, iv, authTag, ephemeralPublicKey } = encryptedData;
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
      default:
        this.toggleEnableMod();
        break;
    }
  }

  requestPublicKey(player) {
    if (!this.Config.enabled)
      return this.cmdMsg(Messages.CannotRequestPublicKeyWhenDisabled);
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
}

module.exports = SafeChatMod;
