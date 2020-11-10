const _ = require('lodash');
const fs = require('fs');

class Env {
  constructor() {
    this.env = this.getEnv();
    this.pick = this.pick.bind(this);
    this.get = this.get.bind(this);
    this.getAll = this.getAll.bind(this);
  }

  loadLocalEnv() {
    try {
      const data = fs.readFileSync('./.env.json');
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error(e);
    }
  
    return {};
  }

  getEnv() {
    let env = {};
    if (process.env && _.get(process.env, 'NODE_ENV') === 'production') {
      env = process.env;
    } else {
      env = {
        ...this.loadLocalEnv(),
        NODE_ENV: 'development',
      };
    }

    return env;
  }

  pick(keys) {
    return _.map(keys, (key) => this.get(key));
  }

  get(key, defaultValue) {
    return _.get(this.env, key, defaultValue);
  }

  getAll() {
    return {
      ...this.env,
    };
  }
}

module.exports = new Env();
