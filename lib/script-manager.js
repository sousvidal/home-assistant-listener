const _ = require('lodash');
const fs = require('fs');

const ScriptContainer = require('./script-container');
const ScriptState = require('./script-state');

const env = require('./utils/env');
const logger = require('./utils/logger');

const SCRIPTS_FOLDER = env.get('SCRIPTS_FOLDER', './custom-js');

const log = (...args) => {
  if (env.get('LOG_SCRIPTS', 'false') === 'true') {
    logger.log(...args);
  }
}

class ScriptManager {
  constructor(config) {
    logger.log('[HAL/SE] initializing');

    this.config = config;
    this.scriptContainers = {};
    this.callHomeAssistantServiceWrapper = this.callHomeAssistantServiceWrapper.bind(this);

    // gather scripts
    this.scripts = this.getScripts();
    // setup a watcher for new scripts and other changes to the folder
    this.watchScripts();
  }

  getScripts() {
    logger.log('[HAL/SE] gathering scripts');
    const scripts = fs.readdirSync(SCRIPTS_FOLDER);
    const filteredScripts = _.filter(scripts, (script) => _.endsWith(script, '.js') && !_.startsWith(script, '_'));
    logger.log('[HAL/SE] scripts:', filteredScripts);
    return filteredScripts;
  }

  reloadScriptContainers() {
    // reload containers
    _.forEach(this.scriptContainers, (container) => {
      container.reloadScript();
    });
  }

  watchScripts() {
    logger.log('[HAL/SE] listening for changes to the scripts folder');
    const watcherCallback = (type, script) => {
      logger.log('[HAL/SE] scripts folder changed');
      // get new sripts
      this.scripts = this.getScripts();
      // reload existing script containers
      this.reloadScriptContainers();
    }
    const callback = _.throttle(watcherCallback, 1000, { trailing: true });
    fs.watch(SCRIPTS_FOLDER, callback);
  }

  async onEntitiesChanged(entities, entityKeys, stateEntityKeys) {
    await Promise.all(_.map(this.scripts, async (script) => {
      await this.runScript(script, entities, entityKeys, stateEntityKeys);
    }));
  }

  async runScript(script, entities, entityKeys, stateEntityKeys) {
    let container = this.getContainer(script);
    if (!container) {
      // create a new script container
      container = this.createContainer(script);
    }
    
    // run the script
    await container.runScript(entities, entityKeys, stateEntityKeys);
  }

  async callHomeAssistantServiceWrapper(domain, service, data) {
    const handler = _.get(this.config, 'serviceHandler');
    if (handler) {
      handler(domain, service, data);
    }
  }

  onScriptEnd(script) {
    logger.log(`[HAL/SE] onScriptEnd: ${script}`);
    // terminate a script by destroying the container.
    this.scriptContainers[script] = undefined;
    delete this.scriptContainers[script];
  }

  getContainer(script) {
    return _.get(this.scriptContainers, script, null);
  }

  createContainer(script) {
    // create a new container instance
    const container = new ScriptContainer(script, {
      folder: SCRIPTS_FOLDER,
      serviceHandler: this.callHomeAssistantServiceWrapper,
      onScriptEnd: () => this.onScriptEnd(script),
    });

    // retain the container
    this.scriptContainers[script] = container;
    return container;
  }
}

module.exports = ScriptManager;
