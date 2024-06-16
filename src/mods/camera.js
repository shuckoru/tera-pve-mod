const BaseMod = require("./base");

class CameraMod extends BaseMod {
  static Version = 1;

  static Name = "camera";
  Description = "Modify camera settings in the game";

  Hooks = {};
  Commands = null;
  EventListeners = {};
  setFovInterval = null;

  constructor(mod, config) {
    super(mod, config);

    this.Hooks = {
      S_SPAWN_ME: {
        raw: true,
        handler: () => this.setCameraConfig(),
      },
    };

    this.EventListeners = {
      change_template: this.setCameraConfig.bind(this),
      change_zone: this.setCameraConfig.bind(this),
      mount: this.setCameraConfig.bind(this),
    };

    this.Commands = (key, value) => {
      this.handleCommand(key, value);
      this.setCameraConfig();
    };
  }

  handleCommand(key, value) {
    switch (key) {
      case "help":
        this.showHelp();
        break;
      case "fovre":
        if (!value) this.cmdMsg("Camera FOV refresh rate requires a value");
        this.updateSettingsValue("cameraFovRefreshInterval", value);
        this.setCameraConfig();
        break;
      case "fov":
        if (value) this.updateSettingsValue("cameraFovValue", value);
        else this.toggleEnabledSettings("cameraFovEnabled");
        this.setCameraConfig();
        break;
      case "distance":
        if (value) this.updateSettingsValue("cameraDistanceValue", value);
        else this.toggleEnabledSettings("cameraDistanceEnabled");
        this.setCameraConfig();
        break;
      case "shake":
        this.toggleEnabledSettings("cameraShakeEnabled");
        this.setCameraConfig();
        break;
      default:
        this.toggleEnableMod();
        this.setCameraConfig();
        break;
    }
  }

  showHelp() {
    const helpMessage = `<font color="#56B4E9">CameraMod Commands:</font>
<font color="#56B4E9">help</font>: Show this help message.
<font color="#56B4E9">fovre [value]</font>: Set the camera FOV refresh rate in ms.
<font color="#56B4E9">fov [value]</font>: Set the camera FOV value. Toggle FOV if no value provided.
<font color="#56B4E9">distance [value]</font>: Set the camera distance value. Toggle distance if no value provided.
<font color="#56B4E9">shake</font>: Toggle camera shake.
<font color="#56B4E9">[any other key]</font>: Toggle camera mod.`;
    this.cmdMsg(helpMessage);
  }

  setCameraConfig() {
    const {
      cameraFovEnabled,
      cameraFovValue,
      cameraDistanceEnabled,
      cameraDistanceValue,
      cameraShakeEnabled,
      cameraFovRefreshInterval,
    } = this.Config.settings;

    this.mod.clearInterval(this.setFovInterval);
    this.mod.send("S_STEER_DEBUG_COMMAND", "*", {
      command: `fov ${
        this.Config.enabled && cameraFovEnabled ? Number(cameraFovValue) : 71
      }`,
    });

    if (this.Config.enabled && cameraFovEnabled) {
      this.setFovInterval = this.mod.setInterval(
        () =>
          this.mod.send("S_STEER_DEBUG_COMMAND", "*", {
            command: `fov ${Number(cameraFovValue)}`,
          }),
        cameraFovRefreshInterval
      );
    }

    this.mod.clientInterface.configureCameraShake(
      this.Config.enabled ? cameraShakeEnabled : true,
      1,
      1
    );

    this.mod.send("S_DUNGEON_CAMERA_SET", "*", {
      enabled: this.Config.enabled && cameraDistanceEnabled,
      default:
        this.Config.enabled && cameraDistanceEnabled
          ? cameraDistanceValue
          : undefined,
      max:
        this.Config.enabled && cameraDistanceEnabled
          ? cameraDistanceValue
          : undefined,
    });
  }
}

module.exports = CameraMod;
