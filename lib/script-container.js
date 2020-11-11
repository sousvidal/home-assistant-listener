const _ = require('lodash');
const fs = require('fs');
const cron = require('node-cron');
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
    this.subcontexts = {};
    this.busy = false;
    this.startInterval = this.startInterval.bind(this);
    this.endInterval = this.endInterval.bind(this);
    this.runScheduledScript = this.runScheduledScript.bind(this);
    this.runScript = this.runScript.bind(this);
    this.startSchedule = this.startSchedule.bind(this);
    this.endSchedule = this.endSchedule.bind(this);
    this.envCheck = this.envCheck.bind(this);

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

  load() {
    // load script funcs into this.scriptFuncs
    this.loadScriptFuncs();
    // initialize, if needed
    const passedEnvCheck = this.envCheck();
    if (passedEnvCheck && _.has(this.scriptFuncs, 'init')) {
      this.callScriptFunc('init');
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
    // reload the script
    this.load();
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

  envCheck() {
    const supportedNodeEnvs = this.getScriptProp('supportedNodeEnvs');
    if (supportedNodeEnvs) {
      return _.includes(supportedNodeEnvs, this.state.getEnvVar('NODE_ENV'));
    }

    return true;
  }

  async runScript(state, keys, caller = null) {
    this.state = state;
    this.keys = keys;

    if (!this.loaded) {
      // load the script first.
      this.load();
    }

    // see if we are allowed to run in this environment
    const passedEnvCheck = this.envCheck();
    if(passedEnvCheck) {
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
  }

  async runScheduledScript(callback, scheduleType) {
    logger.log('[HAL/SE/SC] running scheduled script');
    const subcontext = this.getSubcontext(scheduleType);
    const newSubcontext = callback(this.state, {...subcontext});
    this.setSubcontext(scheduleType, newSubcontext);
  }

  setSubcontext(key, value) {
    this.subcontexts[key] = value || this.getSubcontext();
  }

  getSubcontext(key) {
    return _.get(this.subcontexts, key, {}) || {};
  }

  clearSubcontext(key) {
    this.subcontexts[key] = {};
  }

  getScriptProp(key, defaultValue = null) {
    return _.get(this.scriptFuncs, key, defaultValue);
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
      this.clearSubcontext('interval');
      this.interval = setInterval(() => this.runScheduledScript(callback, 'interval'), timeout);
    }
  }

  endInterval() {
    logger.log('[HAL/SE/SC] clearing interval');
    this.busy = false;
    this.clearSubcontext('interval');
    clearInterval(this.interval);
  }

  startSchedule(cronValue, callback) {
    logger.log(`[HAL/SE/SC] schedule set: ${cronValue}`);
    // end any previous schedules first
    this.endSchedule();

    // validate and create a new schedule
    if (cron.validate(cronValue)) {
      this.schedule = cron.schedule(cronValue, () => this.runScheduledScript(callback, 'schedule'));
    }
  }

  endSchedule() {
    if (this.schedule) {
      this.schedule.destroy();
    }
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
          schedule: this.startSchedule,
          clearSchedule: this.endSchedule,
        },
      },
      require: {
          external: true,
          builtin: ['fs', 'path', 'lodash', 'moment'],
          root: "./node_modules",
      }
    });

    return vm;
  }
}

module.exports = ScriptContainer;
