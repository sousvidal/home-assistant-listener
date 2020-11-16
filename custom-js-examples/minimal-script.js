module.exports = {
  config: {
    supportedNodeEnvs: ['development', 'production'],
  },
  onStateChanged: async (state) => {
    // this will be called on each Home Assistant state change.
  },
};
