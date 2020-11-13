const _ = require('lodash');

const logger = require('./utils/logger');

const ScriptManager = require('./script-manager');
const HomeAssistantListener = require('./ha-listener');

class HALMonitor {
  constructor() {
    logger.log('[HAL/Monitor] initializing');

    // keep track of entities
    this.entities = null;

    // initialize the websocket listener and dispatcher
    this.listener = new HomeAssistantListener();

    // initialize the custom script executioner
    this.scriptManager = new ScriptManager({
      serviceHandler: this.listener.onServiceCalled,
    });

    this.onEntitiesChanged = this.onEntitiesChanged.bind(this);
  }

  onEntitiesChanged(entities) {
    const initialRun = !this.entities;
    let changedEntityKeys = null;
    let changedStateEntityKeys = null;

    if (!initialRun) {
      // determine if there was an actual change and gather the changed entity keys.
      changedEntityKeys = _.filter(_.keys(this.entities), (entityKey) => {
        return !_.isEqual(_.get(this.entities, entityKey), _.get(entities, entityKey));
      });

      // determine the entities that have had their actual state changed.
      changedStateEntityKeys = _.filter(changedEntityKeys, (entityKey) => {
        return !_.isEqual(_.get(_.get(this.entities, entityKey), 'state'), _.get(_.get(entities, entityKey), 'state'));
      });
    }

    if (initialRun || (changedEntityKeys && changedEntityKeys.length > 0)) {
      // save
      this.entities = entities;
      // let the scriptManager run the custom js scripts
      this.scriptManager.onEntitiesChanged(this.entities, changedEntityKeys, changedStateEntityKeys);
    }
  }

  async run() {
    // connect the listener
    await this.listener.connect();
    // subscribe the state to changes
    await this.listener.subscribe(this.onEntitiesChanged);
  }
}

module.exports = HALMonitor;
