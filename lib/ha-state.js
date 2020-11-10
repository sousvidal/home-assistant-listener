const _ = require('lodash');
const EventEmitter = require('events');

const env = require('./utils/env');
const logger = require('./utils/logger');

class HomeAssistantState extends EventEmitter {
  constructor() {
    super();
    logger.log('[HAL/State] initializing');
    this.prevEntities = {};
    this.entities = {};
    this.entitiesLoaded = false;
    this.stateCounter = 1;

    // throttle the onEntitiesChanged function to only fire every x ms with the current entities.
    this._onEntitiesChanged = this._onEntitiesChanged.bind(this);
    this.onEntitiesChanged = _.throttle(this._onEntitiesChanged, 0, { leading: true });
    this.getEntityState = this.getEntityState.bind(this);
    this.getEntity = this.getEntity.bind(this);
    this.getPreviousEntity = this.getPreviousEntity.bind(this);
    this.getPreviousEntityState = this.getPreviousEntityState.bind(this);
    this.getEnvVar = this.getEnvVar.bind(this);
  }

  _onEntitiesChanged(entities) {
    // console.log(`[HAL/State] onEntitiesChanged (${this.stateCounter})`);
    // this.stateCounter++;

    const initialRun = !this.entitiesLoaded;
    let changedEntityKeys = null;
    if (this.entitiesLoaded) {
      // determine if there was an actual change and gather the changed entity keys.
      changedEntityKeys = _.filter(_.keys(this.entities), (entityKey) => {
        return !_.isEqual(this.entities[entityKey], entities[entityKey]);
      });
    }

    if (initialRun || (changedEntityKeys && changedEntityKeys.length > 0)) {
      this.prevEntities = this.entities;
      this.entities = entities;
      this.entitiesLoaded = true;

      this.emit('HAL/State/changed', changedEntityKeys);
    }
  }

  //
  // helper functions
  getEntities() {
    return this.entities;
  }

  getEntity(entityKey) {
    return _.get(this.entities, entityKey);
  }

  getPreviousEntity(entityKey) {
    return _.get(this.prevEntities, entityKey);
  }

  getEntityState(entityKey) {
    return _.get(this.getEntity(entityKey), 'state');
  }

  getPreviousEntityState(entityKey) {
    return _.get(this.getPreviousEntity(entityKey), 'state');
  }

  getEnvVar(key) {
    if (!_.startsWith('HASS')) {
      return env.get(key, null);
    }

    return null;
  }

  getEntityAttributes(key) {
    return _.get(this.getEntity(key), 'attributes');
  }

  getEntityAttribute(key, attr) {
    return _.get(this.getEntityAttributes(key), attr);
  }
}

module.exports = HomeAssistantState;
