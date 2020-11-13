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
    this.getValueForKey = this.getValueForKey.bind(this);
    this.setValueForKey = this.setValueForKey.bind(this);
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

    const entityKeys = this.getEntityKeys();
    if (!entityKeys || entityKeys.length === 0) {
      return false;
    }

    // validate the entityKeys by applying a filter, if one matches we should probaby run.
    if (_.has(this.config, 'entityFilter')) {
      shouldRun = this.validateEntityFilter(this.getConfigValue('entityFilter'));
    }
    // validate the states that belong to the entityKeys by applying a filter, if one matches we should probably run.
    if (shouldRun && _.has(this.config, 'entityStateFilter')) {
      shouldRun = this.validateEntityStateFilter(this.getConfigValue('entityStateFilter'));
    }
    
    return shouldRun;
  }

  getConfigValue(key) {
    return _.get(this.config, key);
  }

  validateEntityFilter(filter) {
    if (filter instanceof RegExp) {
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

  validateEntityStateFilter(filter) {
    // filter the entityKeys by applying the filter
    if (filter instanceof RegExp) {
      return !!_.find(this.getEntityKeys(), (key) => this.getEntityState(key).search(filter) !== -1);
    }
    if (_.isString(filter)) {
      return !!_.find(this.getEntityKeys(), (key) => this.getEntityState(key) === filter);
    }
    if (_.isArray(filter)) {
      return !!_.find(this.getEntityKeys(), (key) => _.includes(filter, this.getEntityState(key)));
    }

    return true;
  }

  setValueForKey(key, value) {
    this.customValues[key] = value;
  }

  getValueForKey(key, defaultValue) {
    return _.get(this.customValues, key, defaultValue);
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
      getValueForKey: this.getValueForKey,
      setValueForKey: this.setValueForKey,
    };
  }
}

module.exports = ScriptState;
