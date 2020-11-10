const _ = require('lodash');

const logger = require('./utils/logger');

const HomeAssistantState = require('./ha-state');
const ScriptExecutioner = require('./script-executioner');
const HomeAssistantListener = require('./ha-listener');

class HALMonitor {
  constructor() {
    logger.log('[HAL/Monitor] initializing');

    // initialize the global state
    this.state = new HomeAssistantState();

    // initialize the websocket listener and dispatcher
    this.listener = new HomeAssistantListener();

    // initialize the custom script executioner
    this.executioner = new ScriptExecutioner({
      serviceHandler: this.listener.onServiceCalled,
    });

    this.onStateChanged = this.onStateChanged.bind(this);
  }

  onStateChanged(keys) {
    // let the executioner run the custom js scripts
    const state = this.state;
    this.executioner.runScripts(state, keys);
  }

  async run() {
    // observe state changes
    this.state.on('HAL/State/changed', this.onStateChanged);

    // connect the listener
    await this.listener.connect();
    // subscribe the state to changes
    await this.listener.subscribe(this.state.onEntitiesChanged);
  }
}

module.exports = HALMonitor;
