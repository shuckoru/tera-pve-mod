const BaseMod = require("./base");

class AutoNegotiateMod extends BaseMod {
  static Version = 1;

  static Name = "autonegotiate";
  Description = "Automatically handles trade broker negotiations.";

  Hooks = {};
  Commands = null;
  EventListeners = {};
  lastSuggest = {};
  currentDeal = null;
  currentContract = null;
  actionTimeout = null;
  cancelTimeout = null;
  pendingDeals = [];
  recentDeals = null;

  constructor(mod, config) {
    super(mod, config);

    this.recentDeals = this.Config.settings?.unattendedManualNegotiate
      ? {}
      : null;

    this.Hooks = {
      S_TRADE_BROKER_DEAL_SUGGESTED: {
        version: "*",
        handler: this.handleDealSuggested.bind(this),
      },
      S_TRADE_BROKER_REQUEST_DEAL_RESULT: {
        version: "*",
        handler: this.handleRequestDealResult.bind(this),
      },
      S_TRADE_BROKER_DEAL_INFO_UPDATE: {
        version: "*",
        handler: this.handleDealInfoUpdate.bind(this),
      },
      S_REQUEST_CONTRACT: {
        version: "*",
        handler: this.handleRequestContract.bind(this),
      },
      S_REPLY_REQUEST_CONTRACT: {
        version: "*",
        handler: this.replyOrAccept.bind(this),
      },
      S_ACCEPT_CONTRACT: {
        version: "*",
        handler: this.replyOrAccept.bind(this),
      },
      S_REJECT_CONTRACT: {
        version: "*",
        handler: this.handleRejectContract.bind(this),
      },
      S_CANCEL_CONTRACT: {
        version: "*",
        handler: this.handleCancelContract.bind(this),
      },
      S_SYSTEM_MESSAGE: {
        version: "*",
        handler: this.handleSystemMessage.bind(this),
      },
    };

    if (this.Config.settings?.unattendedManualNegotiate) {
      this.Hooks.C_REQUEST_CONTRACT = {
        version: "*",
        handler: this.handleManualContract.bind(this),
      };
    }

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
    };
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      case "nretry":
        this.retryLastDeal();
        break;
      default:
        this.showStatus();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">AutoNegotiate Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">nretry</font>: Retry last deal suggestion.
<font color="#56B4E9">[any other key]</font>: Show status.`;
    this.cmdMsg(helpMessage);
  }

  retryLastDeal() {
    if (Object.keys(this.lastSuggest).length) {
      this.cmdMsg("Retrying last deal suggestion...");
      this.mod.toClient("S_TRADE_BROKER_DEAL_SUGGESTED", "*", this.lastSuggest);
    } else {
      this.cmdMsg("No deal to retry");
    }
  }

  showStatus() {
    this.cmdMsg("AutoNegotiateMod is running.");
  }

  handleDealSuggested(event) {
    this.lastSuggest = event;

    // Remove old deals that haven't been processed yet
    this.pendingDeals = this.pendingDeals.filter(
      (deal) =>
        deal.playerId !== event.playerId || deal.listing !== event.listing
    );

    if (this.comparePrice(event.offeredPrice, event.sellerPrice) !== 0) {
      this.pendingDeals.push(event);
      this.queueNextDeal(true);
      return false;
    } else if (this.Config.settings?.unattendedManualNegotiate) {
      let dealId = `${event.playerId}-${event.listing}`;

      if (this.recentDeals[dealId])
        clearTimeout(this.recentDeals[dealId].timeout);

      this.recentDeals[dealId] = event;
      this.recentDeals[dealId].timeout = setTimeout(() => {
        delete this.recentDeals[dealId];
      }, this.rng(this.Config.settings.actionDelayTimeoutMs));
    }
  }

  handleRequestDealResult(event) {
    if (this.currentDeal) {
      if (!event.ok) this.endDeal();
      return false;
    }
  }

  handleDealInfoUpdate(event) {
    if (this.currentDeal) {
      if (event.buyerStage === 2 && event.sellerStage < 2) {
        let deal = this.currentDeal;
        setTimeout(
          () => {
            if (
              this.currentDeal &&
              deal.playerId === this.currentDeal.playerId &&
              deal.listing === this.currentDeal.listing &&
              BigInt(event.price) >= BigInt(this.currentDeal.offeredPrice)
            ) {
              this.mod.toServer("C_TRADE_BROKER_DEAL_CONFIRM", "*", {
                listing: this.currentDeal.listing,
                stage: event.sellerStage + 1,
              });
            } else {
              this.endDeal();
            }
          },
          event.sellerStage === 0
            ? this.rng(this.Config.settings.actionDelayShortMs)
            : 0
        );
      }
      return false;
    }
  }

  handleRequestContract(event) {
    if (
      this.currentDeal &&
      (event.type === this.Config.settings.typeNegotiationPending ||
        event.type === this.Config.settings.typeNegotiation)
    ) {
      this.currentContract = event;
      this.setEndTimeout();
      return false;
    }
  }

  handleRejectContract(event) {
    if (
      this.currentDeal &&
      (event.type === this.Config.settings.typeNegotiationPending ||
        event.type === this.Config.settings.typeNegotiation)
    ) {
      this.cmdMsg(`${this.currentDeal.name} aborted negotiation.`);

      if (event.type === this.Config.settings.typeNegotiationPending) {
        this.mod.toServer("C_TRADE_BROKER_REJECT_SUGGEST", "*", {
          playerId: this.currentDeal.playerId,
          listing: this.currentDeal.listing,
        });
      }

      this.currentContract = null;
      this.endDeal();
      return false;
    }
  }

  handleCancelContract(event) {
    if (
      this.currentDeal &&
      (event.type === this.Config.settings.typeNegotiationPending ||
        event.type === this.Config.settings.typeNegotiation)
    ) {
      this.currentContract = null;
      this.endDeal();
      return false;
    }
  }

  handleSystemMessage(event) {
    if (this.currentDeal) {
      try {
        const msg = this.mod.parseSystemMessage(event.message);

        if (msg.id === "SMT_MEDIATE_TRADE_CANCEL_OPPONENT") {
          this.cmdMsg(`${this.currentDeal.name} cancelled negotiation.`);
          return false;
        } else if (msg.id === "SMT_MEDIATE_SUCCESS_SELL") {
          this.cmdMsg("Deal successful");
        }
      } catch (e) {}
    }
  }

  handleManualContract(event) {
    if (event.type === 35) {
      let deal =
        this.recentDeals[
          `${event.data.readUInt32LE(0)}-${event.data.readUInt32LE(4)}`
        ];

      if (deal) {
        this.currentDeal = deal;
        this.cmdMsg(`Handling negotiation with ${this.currentDeal.name}...`);
        process.nextTick(() => {
          this.mod.toClient("S_REPLY_REQUEST_CONTRACT", "*", {
            type: event.type,
          });
        });
      }
    }
  }

  replyOrAccept(event) {
    if (
      this.currentDeal &&
      event.type === this.Config.settings.typeNegotiationPending
    ) {
      this.setEndTimeout();
      return false;
    }
  }

  comparePrice(offer, seller) {
    if (
      this.Config.settings.autoRejectThreshold &&
      this.rngYesOrNo(this.Config.settings.autoRejectChance) &&
      BigInt(offer) <
        (BigInt(seller) * BigInt(this.Config.settings.autoRejectThreshold)) /
          100n
    )
      return -1;
    if (
      this.Config.settings.autoRejectTrolls &&
      this.rngYesOrNo(this.Config.settings.autoRejectChance) &&
      BigInt(offer) >
        (BigInt(seller) * BigInt(this.Config.settings.autoRejectTrolls)) / 100n
    )
      return -1;
    if (
      this.Config.settings.autoAcceptThreshold &&
      BigInt(offer) >=
        (BigInt(seller) * BigInt(this.Config.settings.autoAcceptThreshold)) /
          100n
    )
      return 1;
    return 0;
  }

  queueNextDeal(slow) {
    if (!this.actionTimeout && !this.currentDeal)
      this.actionTimeout = setTimeout(
        this.tryNextDeal.bind(this),
        this.Config.settings.delayActions
          ? this.rng(
              slow
                ? this.Config.settings.actionDelayLongMs
                : this.Config.settings.actionDelayShortMs
            )
          : 0
      );
  }

  tryNextDeal() {
    this.actionTimeout = null;

    if (!(this.currentDeal = this.pendingDeals.shift())) return;

    if (
      this.comparePrice(
        this.currentDeal.offeredPrice,
        this.currentDeal.sellerPrice
      ) === 1
    ) {
      this.cmdMsg(`Attempting to negotiate with ${this.currentDeal.name}...`);
      this.cmdMsg(
        `Price: ${this.formatGold(
          this.currentDeal.sellerPrice
        )} - Offered: ${this.formatGold(this.currentDeal.offeredPrice)}`
      );

      const data = Buffer.alloc(30);
      data.writeUInt32LE(this.currentDeal.playerId, 0);
      data.writeUInt32LE(this.currentDeal.listing, 4);

      this.mod.toServer("C_REQUEST_CONTRACT", "*", {
        type: 35,
        unk2: 0,
        unk3: 0,
        unk4: 0,
        name: "",
        data,
      });
    } else {
      this.mod.toServer("C_TRADE_BROKER_REJECT_SUGGEST", "*", {
        playerId: this.currentDeal.playerId,
        listing: this.currentDeal.listing,
      });

      this.cmdMsg(`Declined negotiation from ${this.currentDeal.name}.`);
      this.cmdMsg(
        `Price: ${this.formatGold(
          this.currentDeal.sellerPrice
        )} - Offered: ${this.formatGold(this.currentDeal.offeredPrice)}`
      );

      this.currentDeal = null;
      this.queueNextDeal();
    }
  }

  setEndTimeout() {
    clearTimeout(this.cancelTimeout);
    this.cancelTimeout = setTimeout(
      this.endDeal.bind(this),
      this.pendingDeals.length
        ? this.rng(this.Config.settings.actionDelayTimeoutShortMs)
        : this.rng(this.Config.settings.actionDelayTimeoutMs)
    );
  }

  endDeal() {
    clearTimeout(this.cancelTimeout);

    if (this.currentContract) {
      this.cmdMsg("Negotiation timed out.");

      this.mod.toServer("C_CANCEL_CONTRACT", "*", {
        type: this.currentContract.type,
        id: this.currentContract.id,
      });
      this.currentContract = null;
      this.setEndTimeout();
      return;
    }

    this.currentDeal = null;
    this.queueNextDeal();
  }

  formatGold(gold) {
    gold = gold.toString();

    let str = "";
    if (gold.length > 4)
      str +=
        '<font color="#ffb033">' +
        Number(gold.slice(0, -4)).toLocaleString() +
        "g</font>";
    if (gold.length > 2)
      str += '<font color="#d7d7d7">' + gold.slice(-4, -2) + "s</font>";
    str += '<font color="#c87551">' + gold.slice(-2) + "c</font>";

    return str;
  }

  rng([min, max]) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  rngYesOrNo(chance) {
    return chance > this.rng([0, 100]) ? true : false;
  }
}

module.exports = AutoNegotiateMod;
