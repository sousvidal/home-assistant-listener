const _ = require('lodash');
const fs = require('fs');
const { NodeVM } = require('vm2');

const env = require('./utils/env');
const logger = require('./utils/logger');

class ScriptContainer {
  constructor(script, config) {
    // logger.log('[HAL/SE/SC] initializing');
    this.config = config;
    this.script = script;
    this.loaded = false;
    this.context = {};
    this.busy = false;
    this.startInterval = this.startInterval.bind(this);
    this.endInterval = this.endInterval.bind(this);
    this.runScheduledScript = this.runScheduledScript.bind(this);
    this.runScript = this.runScript.bind(this);

    // setup a VM to run the script in
    this.vm = this.createVM();
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

  loadScriptFuncs() {
    try {
      // load the script from disk
      const path = `${this.config.folder}/${this.script}`;
      const js = fs.readFileSync(path);

      // run the script in the vm
      const funcs = this.vm.run(js, this.script);

      // validate the script
      if (_.has(funcs, 'shouldRun') && _.has(funcs, 'run')) {
        this.scriptFuncs = funcs;
        this.loaded = true;
      } else {
        logger.error(`[HAL/SE/SC] invalid script: ${this.script}`);
        this.scriptFuncs = null;
        this.loaded = false;
      }
    } catch (e) {
      logger.error(e);
      this.end();
    }
  }

  reloadScript() {
    logger.log(`[HAL/SE/SC] reloadScript: ${this.script}`);
    // clear the schedule
    this.endInterval();
    // reload the script funcs
    this.loadScriptFuncs();
    // reset the context
    this.context = {};
  }

  getContext(caller) {
    return {
      ...this.context,
      scheduled: !!(this.busy && this.interval),
      caller: caller || 'default',
    };
  }

  async runScript(state, keys, caller = null) {
    this.state = state;
    this.keys = keys;

    if (!this.loaded) {
      // load the script first.
      this.loadScriptFuncs();
    }

    // assemble the full context object
    const context = this.getContext(caller);

    try {
      // check if we should run at all
      const shouldRun = await this.callScriptFunc('shouldRun', this.state, this.keys, context);
      if (shouldRun) {
        const newContext = await this.callScriptFunc('run', this.state, this.keys, context);
        // set the new context
        if (newContext && _.isObject(newContext)) {
          this.context = {
            ...context,
            ...newContext,
          };
        }
      }
    } catch (e) {
      logger.error(`[HAL/SE/SC] error in script: ${this.script}`, e);
    }
  }

  async runScheduledScript(callback) {
    logger.log('[HAL/SE/SC] running scheduled script');
    const newSubcontext = callback({...this.subcontext});
    this.subcontext = newSubcontext || this.subcontext;
  }

  async callScriptFunc(key, ...args) {
    const scriptFunc = _.get(this.scriptFuncs, key);
    return scriptFunc(...args);
  }

  startInterval(callback, timeout) {
    if (this.busy) {
      logger.warn('[HAL/SE/SC] interval already set');
    } else {
      logger.log('[HAL/SE/SC] setting interval');
      this.busy = true;
      this.subcontext = {};
      this.interval = setInterval(() => this.runScheduledScript(callback), timeout);
    }
  }

  endInterval() {
    logger.log('[HAL/SE/SC] clearing interval');
    this.busy = false;
    this.subcontext = {};
    clearInterval(this.interval);
  }

  createVM() {
    const vm = new NodeVM({
      console: env.get('LOG_SCRIPTS', 'false') === 'true' ? 'inherit' : 'off',
      timeout: 1000,
      sandbox: {
        HAL: {
          callHomeAssistantService: this.config.serviceHandler,
          interval: this.startInterval,
          clearInterval: this.endInterval,
        },
      },
      require: {
          external: true,
          builtin: ['fs', 'path', 'lodash'],
          root: "./node_modules",
      }
    });

    return vm;
  }
}

module.exports = ScriptContainer;
