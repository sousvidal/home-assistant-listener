const _ = require('lodash');
const env = require('./env');

class Logger {
  constructor() {
    this.logLevel = Number(env.get('LOG_LEVEL', '0'));
    this.log = this.log.bind(this);
    this.warn = this.warn.bind(this);
  }

  log(...args) {
    if (this.logLevel > 1) {
      console.log(...args);
    }
  }

  warn(...args) {
    if (this.logLevel > 0) {
      console.warn(...args);
    }
  }

  error(...args) {
    console.error(...args);
  }

  important(...args) {
    console.log(...args);
  }
}

module.exports = new Logger();
