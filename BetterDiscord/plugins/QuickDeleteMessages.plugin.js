//META{"name":"QuickDeleteMessages","source":"https://gitlab.com/_Lighty_/bdstuff/blob/master/MessageLoggerV2.plugin.js","website":"https://_lighty_.gitlab.io/bdstuff/?plugin=QuickDeleteMessages"}*//
class QuickDeleteMessages {
  getName() {
    return 'QuickDeleteMessages';
  }
  getVersion() {
    return '1.0.6';
  }
  getAuthor() {
    return 'Lighty';
  }
  getDescription() {
    return 'Hold Delete and click a message to delete it! Original by square(Inve1951).';
  }
  load() {}
  start() {
    let onLoaded = () => {
      try {
        if (!global.ZeresPluginLibrary || !(this.localUser = ZLibrary.DiscordModules.UserStore.getCurrentUser())) setTimeout(() => onLoaded(), 1000);
        else this.initialize();
      } catch (err) {
        ZLibrary.Logger.stacktrace(this.getName(), 'Failed to start!', err);
        ZLibrary.Logger.err(this.getName(), `If you cannot solve this yourself, contact ${this.getAuthor()} and provide the errors shown here.`);
        this.stop();
        ZLibrary.Toasts.show(`[${this.getName()}] Failed to start! Check console (CTRL + SHIFT + I, click console tab) for more error info.`, { type: 'error', timeout: 10000 });
      }
    };
    const getDir = () => {
      // from Zeres Plugin Library, copied here as ZLib may not be available at this point
      const process = require('process');
      const path = require('path');
      if (process.env.injDir) return path.resolve(process.env.injDir, 'plugins/');
      switch (process.platform) {
        case 'win32':
          return path.resolve(process.env.appdata, 'BetterDiscord/plugins/');
        case 'darwin':
          return path.resolve(process.env.HOME, 'Library/Preferences/', 'BetterDiscord/plugins/');
        default:
          return path.resolve(process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : process.env.HOME + '/.config', 'BetterDiscord/plugins/');
      }
    };
    this.pluginDir = getDir();
    let libraryOutdated = false;
    // I'm sick and tired of people telling me my plugin doesn't work and it's cause zlib is outdated, ffs
    if (!global.ZLibrary || !global.ZeresPluginLibrary || (bdplugins.ZeresPluginLibrary && (libraryOutdated = ZeresPluginLibrary.PluginUpdater.defaultComparator(bdplugins.ZeresPluginLibrary.plugin._config.info.version, '1.2.6')))) {
      const title = libraryOutdated ? 'Library outdated' : 'Library Missing';
      const ModalStack = BdApi.findModuleByProps('push', 'update', 'pop', 'popWithKey');
      const TextElement = BdApi.findModuleByProps('Sizes', 'Weights');
      const ConfirmationModal = BdApi.findModule(m => m.defaultProps && m.key && m.key() == 'confirm-modal');
      const confirmedDownload = () => {
        require('request').get('https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js', async (error, response, body) => {
          if (error) return require('electron').shell.openExternal('https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js');
          require('fs').writeFile(require('path').join(this.pluginDir, '0PluginLibrary.plugin.js'), body, () => {
            setTimeout(() => {
              if (!global.bdplugins.ZeresPluginLibrary) return BdApi.alert('Notice', `Due to you using EnhancedDiscord instead of BetterDiscord, you'll have to reload your Discord before ${this.getName()} starts working. Just press CTRL + R to reload and ${this.getName()} will begin to work!`);
              onLoaded();
            }, 1000);
          });
        });
      };
      if (!ModalStack || !ConfirmationModal || !TextElement) {
        BdApi.alert('Uh oh', `Looks like you${libraryOutdated ? 'r Zeres Plugin Library was outdated!' : ' were missing Zeres Plugin Library!'} Also, failed to show a modal, so it has been ${libraryOutdated ? 'updated' : 'downloaded and loaded'} automatically.`);
        confirmedDownload();
        return;
      }
      ModalStack.push(props => {
        return BdApi.React.createElement(
          ConfirmationModal,
          Object.assign(
            {
              header: title,
              children: [BdApi.React.createElement(TextElement, { color: TextElement.Colors.PRIMARY, children: [`The library plugin needed for ${this.getName()} is ${libraryOutdated ? 'outdated' : 'missing'}. Please click Download Now to ${libraryOutdated ? 'update' : 'install'} it.`] })],
              red: false,
              confirmText: 'Download Now',
              cancelText: 'Cancel',
              onConfirm: () => confirmedDownload()
            },
            props
          )
        );
      });
    } else onLoaded();
  }
  stop() {
    try {
      this.shutdown();
    } catch (err) {
      ZLibrary.Logger.stacktrace(this.getName(), 'Failed to stop!', err);
    }
  }
  initialize() {
    ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), 'https://_lighty_.gitlab.io/bdstuff/plugins/QuickDeleteMessages.plugin.js');
    this.settings = ZLibrary.PluginUtilities.loadSettings(this.getName(), {
      confirmDelete: false,
      ctrlClickDelete: false
    });

    this.tools = {
      deleteMessage: ZLibrary.DiscordModules.MessageActions.deleteMessage,
      confirmDelete: ZLibrary.WebpackModules.getByProps('confirmDelete').confirmDelete
    };

    this.deleteKeyDown = false;
    document.addEventListener(
      'keydown',
      (this.keydownListener = e => {
        if (e.repeat) return;
        if (e.keyCode === 46) this.deleteKeyDown = true;
      })
    );
    document.addEventListener(
      'keyup',
      (this.keyupListener = e => {
        if (e.repeat) return;
        if (e.keyCode === 46) this.deleteKeyDown = false;
      })
    );
    const messageClassname = ZLibrary.WebpackModules.getByProps('groupStart', 'message').message.split(' ')[0];
    const containerClassname = ZLibrary.WebpackModules.getByProps('embedWrapper', 'container').container.split(' ')[0];
    document.addEventListener(
      'click',
      (this.clickListener = e => {
        if (this.settings.ctrlClickDelete ? !e.ctrlKey : !this.deleteKeyDown) return;
        let target = e.target;
        while (target && (!target.classList || !target.classList.contains(messageClassname))) target = target.parentElement;
        if (!target) return;
        const instance = ZLibrary.ReactTools.getOwnerInstance(target.querySelector('.' + containerClassname));
        if (!instance || !instance.props || !instance.props.message) return;
        if (!this.canDelete(instance.props)) return;
        this.settings.confirmDelete && !e.shiftKey ? this.tools.confirmDelete(instance.props.channel, instance.props.message, true) : this.tools.deleteMessage(instance.props.channel.id, instance.props.message.id);
        e.preventDefault();
        e.stopPropagation();
        return false;
      }),
      true
    );
  }
  shutdown() {
    if (this.keydownListener) document.removeEventListener('keydown', this.keydownListener);
    if (this.keyupListener) document.removeEventListener('keyup', this.keyupListener);
    if (this.clickListener) document.removeEventListener('click', this.clickListener);
  }
  getSettingsPanel() {
    const makeOption = (name, note, option) => {
      return new ZLibrary.Settings.Switch(name, note, this.settings[option], e => (this.settings[option] = e));
    };
    return ZLibrary.Settings.SettingPanel.build(_ => this.saveSettings(), makeOption('Show confirmation', 'Can still hold shift to bypass it!', 'confirmDelete'), makeOption('Use CTRL instead of Delete', '', 'ctrlClickDelete'));
  }
  saveSettings() {
    ZLibrary.PluginUtilities.saveSettings(this.getName(), this.settings);
  }
  canDelete(props) {
    return props.message.author.id === this.localUser.id || ZLibrary.DiscordModules.Permissions.can(ZLibrary.DiscordModules.DiscordPermissions.MANAGE_MESSAGES, this.localUser, props.channel);
  }
}
