const _ = require('lodash');
const fs = require('fs');
const moment = require('moment');
const cron = require('node-cron');
const { NodeVM } = require('vm2');

const logger = require('./utils/logger');
const env = require('./utils/env');

class ScriptVM {
  constructor(config) {
    this.config = config;
    this.scriptFuncs = null;

    this.startInterval = this.startInterval.bind(this);
    this.endInterval = this.endInterval.bind(this);
    this.startSchedule = this.startSchedule.bind(this);
    this.endSchedule = this.endSchedule.bind(this);

    // create a NodeVM instance
    this.vm = this.createVM();
  }

  async callScriptFunc(func, ...args) {
    try {
      if (_.has(this.scriptFuncs, func)) {
        const scriptFunc = _.get(this.scriptFuncs, func);
        return scriptFunc(...args);
      }
    } catch (e) {
      logger.error(e);
    }

    return null;
  }

  getScriptProp(key, defaultValue = null) {
    return _.get(this.scriptFuncs, key, defaultValue);
  }

  loadScript() {
    // load the script from disk
    const path = `${this.config.folder}/${this.config.script}`;
    const js = fs.readFileSync(path);

    // run the script in the vm
    const funcs = this.vm.run(js, this.config.script);

    // validate the script
    if (_.has(funcs, 'onStateChanged')) {
      this.scriptFuncs = funcs;
    } else {
      logger.error(`[HAL/SE/SC] invalid script: ${this.config.script}`);
      this.scriptFuncs = null;
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

  startInterval(callback, timeout) {
    if (this.busy) {
      logger.warn('[HAL/SE/SC] interval already set');
    } else {
      logger.log('[HAL/SE/SC] setting interval');
      this.busy = true;
      this.interval = setInterval(() => this.config.runScheduledCallback(callback), timeout);
    }
  }

  endInterval() {
    logger.log('[HAL/SE/SC] clearing interval');
    this.busy = false;
    clearInterval(this.interval);
  }

  startSchedule(cronValue, callback) {
    logger.log(`[HAL/SE/SC] schedule set: ${cronValue}`);
    // end any previous schedules first
    this.endSchedule();

    // validate and create a new schedule
    if (cron.validate(cronValue)) {
      this.schedule = cron.schedule(cronValue, () => this.config.runScheduledCallback(callback, 'schedule'));
    }
  }

  endSchedule() {
    if (this.schedule) {
      this.schedule.destroy();
    }
  }
}

module.exports = ScriptVM;
