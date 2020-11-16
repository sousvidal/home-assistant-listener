const _ = require('lodash');
const fs = require('fs');

const env = require('./utils/env');
const logger = require('./utils/logger');

const ScriptVM = require('./script-vm');
const ScriptState = require('./script-state');

class ScriptContainer {
  constructor(script, config) {
    // logger.log('[HAL/SE/SC] initializing');
    this.config = config;
    this.script = script;
    this.loaded = false;
    this.state = null;
    this.envSupported = false;
    this.runScheduledCallback = this.runScheduledCallback.bind(this);
    this.envCheck = this.envCheck.bind(this);

    // setup a VM to run the script in
    this.vm = new ScriptVM({
      serviceHandler: this.config.serviceHandler,
      script,
      folder: this.config.folder,
      runScheduledCallback: this.runScheduledCallback,
    });
  }

  end() {
    // time to die.
    logger.log(`[HAL/SE/SC] end: ${this.script}`);
    this.endInterval();
    // call back so the container can clean up
    if (this.config.onScriptEnd) {
      this.config.onScriptEnd();
    }
  }

  load(forceReload = false) {
    if (forceReload || !this.loaded) {
      try {
        // load the script into the VM
        this.vm.loadScript();
      } catch (e) {
        logger.error(e);
        this.end();
      }

      // get a state (this also creates a state if there isn't any)
      const state = this.getState();

      // do an env check
      this.envSupported = this.envCheck();
      if (this.envSupported) {
        // initialize, if needed
        this.vm.callScriptFunc('init', state.getVMState());
      }

      this.loaded = true;
    }
  }

  reloadScript() {
    logger.log(`[HAL/SE/SC] reloadScript: ${this.script}`);
    // reset the state
    // TODO: make a nice method for this? destroying it seems pointless.
    this.state = null;
    // reload the script
    this.load(true);
  }

  envCheck() {
    let envSupported = false;
    const supportedNodeEnvs = _.get(this.vm.getScriptProp('config'), 'supportedNodeEnvs');
    if (supportedNodeEnvs) {
      envSupported = _.includes(supportedNodeEnvs, env.get('NODE_ENV', 'development'));
    }

    return envSupported;
  }

  getState() {
    if (!this.state) {
      // create a new state
      const config = this.vm.getScriptProp('config');
      this.state = new ScriptState(config);
    }

    return this.state;
  }

  async runScript(entities, entityKeys, stateEntityKeys) {
    // load the script
    this.load();

    if (this.envSupported) {
      // load the state and update the values
      const state = this.getState();
      state.updateValues(entities, entityKeys, stateEntityKeys);

      // pre-validate the state
      if (state.validate()) {
        const vmState = state.getVMState();
        try {
          // call 'onStateChanged' on the script.
          await this.vm.callScriptFunc('onStateChanged', vmState);
        } catch (e) {
          logger.error(`[HAL/SE/SC] error in script: ${this.script}`, e);
        }
      }
    }
  }

  async runScheduledCallback(callback) {
    logger.log('[HAL/SE/SC] running scheduled callback');
    const state = this.getState();
    const vmState = state.getVMState();
    await callback(vmState);
  }
}

module.exports = ScriptContainer;
