const _ = require('lodash');
const homeassistant = require('home-assistant-js-websocket');

const logger = require('./utils/logger');
const createSocket = require('./ha-websocket');

class HomeAssistantListener {
  constructor(config) {
    logger.log('[HAL/Listener] initializing');
    this.connection = null;
    this.onServiceCalled = this.onServiceCalled.bind(this);
  }

  async connect() {
    logger.log('[HAL/Listener] connecting to home-assistant');
    this.connection = await homeassistant.createConnection({ createSocket }).catch((e) => {
      console.log(e);
    });
  }

  async subscribe(callback) {
    logger.log('[HAL/Listener] listening to entities');
    homeassistant.subscribeEntities(this.connection, callback);
  }

  async onServiceCalled(domain, service, data) {
    logger.log(`[HAL/Listener] onServiceCalled: ${domain}/${service}`, data);
    try {
      await homeassistant.callService(this.connection, domain, service, data);
    } catch (e) {
      logger.error(e);
    }
  }
}

module.exports = HomeAssistantListener;
