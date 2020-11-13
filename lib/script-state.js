const _ = require('lodash');

const logger = require('./utils/logger');

class ScriptState {
  constructor(config) {
    this.config = config;
    this.entities = {};
    this.prevEntities = {};
    this.entityKeys = [];
    this.stateEntityKeys = [];
    this.getVMState = this.getVMState.bind(this);
    this.customValues = {};
  }

  updateValues(entities, entityKeys, stateEntityKeys) {
    this.setEntities(entities);
    this.entityKeys = entityKeys;
    this.stateEntityKeys = stateEntityKeys;
  }

  setEntities(newEntities = {}) {
    this.prevEntities = this.entities;
    this.entities = _.cloneDeep(newEntities);
  }

  getEntities() {
    return this.entities;
  }

  getEntity(entityKey) {
    return _.get(this.getEntities(), entityKey);
  }

  getEntityState(entityKey) {
    return _.get(this.getEntity(entityKey), 'state');
  }

  getPrevEntities() {
    return this.prevEntities;
  }

  getPrevEntity(entityKey) {
    return _.get(this.getPrevEntities(), entityKey);
  }

  getPrevEntityState(entityKey) {
    return _.get(this.getPrevEntity(entityKey), 'state');
  }

  getEntityKeys() {
    if (this.getConfigValue('onlyStateChanges') === true) {
      return this.stateEntityKeys;
    }

    return this.entityKeys;
  }

  //
  // validate
  // 

  validate() {
    // validate if we can run a script or not
    let shouldRun = true;
    const configKeys = _.keys(this.config);
    let iteration = 0;
    while (shouldRun && iteration < configKeys.length) {
      const configKey = configKeys[iteration];
      const configValue = this.getConfigValue(configKey);
      switch (configKey) {
        case 'entityFilter':
          shouldRun = this.validateEntityFilter(configValue);
          break;
        default:
          break;
      }
      iteration++;
    }
    
    return shouldRun;
  }

  getConfigValue(key) {
    return _.get(this.config, key);
  }

  validateEntityFilter(filter) {
    // filter the entityKeys by applying the filter
    if (_.isRegExp(filter)) {
      return !!_.find(this.getEntityKeys(), (key) => key.search(filter) !== -1);
    }
    if (_.isString(filter)) {
      return !!_.find(this.getEntityKeys(), (key) => key === filter);
    }
    if (_.isArray(filter)) {
      return !!_.find(this.getEntityKeys(), (key) => _.includes(filter, key));
    }

    return true;
  }

  //
  // getVMState
  // returns an object safe to pass on to the VM (for script usage)
  getVMState() {
    const getChangedEntityKeys = () => this.getEntityKeys();
    const getEntities = () => this.getEntities();
    const getEntity = (entityKey) => _.get(getEntities(), entityKey);
    const getEntityAttributes = (entityKey) => _.get(getEntity(entityKey), 'attributes');

    return {
      getEntities,
      getChangedEntityKeys,
      getEntity,
      getEntityState: (entityKey) => _.get(getEntity(entityKey), 'state'),
      getEntityAttributes,
      getEntityAttribute: (entityKey, attributeKey) => _.get(getEntityAttributes(entityKey), attributeKey),
      getValueForKey: (key, defaultValue) => _.get(this.customValues, key, defaultValue),
      setValueForKey: (key, value) => this.customValues[key] = value,
    };
  }
}

module.exports = ScriptState;
