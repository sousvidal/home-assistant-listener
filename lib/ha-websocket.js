const _ = require('lodash');
const WebSocket = require("ws");
const homeassistant = require('home-assistant-js-websocket');

const env = require('./utils/env');
const logger = require('./utils/logger');

const getSocketURL = (url) => {
  return `${_.replace(url, 'http', 'ws')}/api/websocket`;
}

module.exports = () => {
  // Open connection
  const url = getSocketURL(env.get('HASS_URL'));

  const authObj = {
    type: 'auth',
    access_token: env.get('HASS_TOKEN'),
  };

  logger.log('[HAL/WS] Initializing', url);

  function connect(promResolve, promReject) {
    logger.log('[HAL/WS] New connection', url);

    const socket = new WebSocket(url, {
      rejectUnauthorized: false,
    });

    // If invalid auth, we will not try to reconnect.
    let invalidAuth = false;

    const onOpen = async (event) => {
      try {
        socket.send(JSON.stringify(authObj));
      } catch (err) {
        logger.error(err);
        socket.close();
      }
    };

    const onMessage = async (event) => {
      const message = JSON.parse(event.data);

      logger.log('[HAL/WS] Received', message);

      switch (message.type) {
        case homeassistant.MSG_TYPE_AUTH_INVALID:
          invalidAuth = true;
          socket.close();
          break;
        case homeassistant.MSG_TYPE_AUTH_OK:
            socket.removeEventListener('open', onOpen);
            socket.removeEventListener('message', onMessage);
            socket.removeEventListener('close', onClose);
            socket.removeEventListener('error', onClose);
            promResolve(socket);
            break;

        default:
          if (message.type !== homeassistant.MSG_TYPE_AUTH_REQUIRED) {
            logger.log('[HAL/WS] Unhandled message', message);
          }
      }
    };

    const onClose = (err) => {
      logger.error(err);
      // If we are in error handler make sure close handler doesn't also fire.
      socket.removeEventListener('close', onClose);
      if (invalidAuth) {
          promReject(homeassistant.ERR_INVALID_AUTH);
          return;
      }

      // Try again in a second
      logger.log('onClose');
      setTimeout(() => connect(promResolve, promReject), 5000);
    };

    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onClose);
  }

  return new Promise((resolve, reject) => connect(resolve, reject));
};
