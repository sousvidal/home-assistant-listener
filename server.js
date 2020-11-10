const express = require('express');

const env = require('./lib/utils/env');
const logger = require('./lib/utils/logger');
const HALMonitor = require('./lib/hal-monitor');

// setup express server.
const app = express();
const port = env.get('PORT', 8096);

// load the environment
logger.important(`[HAL] loaded env: ${env.get('NODE_ENV')}`);
logger.log(env.getAll());

app.listen(port, () => {
  logger.important(`[HAL] listening at http://localhost:${port}`);
});

// start the monitor
(async () => {
  const monitor = new HALMonitor();
  monitor.run();
})();
