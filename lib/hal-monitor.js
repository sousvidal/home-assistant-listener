const _ = require('lodash');

const logger = require('./utils/logger');

const haState = require('./ha-state');
const ScriptManager = require('./script-manager');
const HomeAssistantListener = require('./ha-listener');

class HALMonitor {
  constructor() {
    logger.log('[HAL/Monitor] initializing');

    // initialize the global state
    this.haState = haState;

    // initialize the websocket listener and dispatcher
    this.listener = new HomeAssistantListener();

    // initialize the custom script executioner
    this.scriptManager = new ScriptManager({
      serviceHandler: this.listener.onServiceCalled,
    });

    this.onStateChanged = this.onStateChanged.bind(this);
  }

  onStateChanged(keys) {
    // let the scriptManager run the custom js scripts
    const state = this.haState;
    this.scriptManager.runScripts(state, keys);
  }

  async run() {
    // observe state changes
    this.haState.on('HAL/State/changed', this.onStateChanged);

    // connect the listener
    await this.listener.connect();
    // subscribe the state to changes
    await this.listener.subscribe(this.haState.onEntitiesChanged);
  }
}

module.exports = HALMonitor;
