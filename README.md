# [HAL] home-assistant-listener
Javascript scripting support for Home Assistant.

## Installation

### Using Docker
Installation is easy using [Docker](https://www.docker.com/).
Use the `docker-compose.yml` sample below to get started in minutes:

```yaml
version: '3'
services:
  home-assistant-listener:
    container_name: home-assistant-listener
    image: janwillemdebirk/home-assistant-listener:latest
    volumes:
      - ~/HAL/custom-js:/var/home-assistant-listener/custom-js
    environment:
      - TZ=Europe/Amsterdam
      - LOG_LEVEL=0
      - LOG_SCRIPTS=false
      - HASS_URL=http://127.0.0.1:8123
      - HASS_TOKEN=<your token here>
    restart: always
    network_mode: host
    ports:
      - "8069:8069"
```

#### Volumes
The `custom-js` folder is used to drop all your JavaScript files in, HAL will automatically load (and re-load) them. Replace the `~/HAL/custom-js` folder by any other path you wish to store your scripts in.

#### Environment
There's a few environment variables that you need to replace to get up and running:

`HASS_URL` is the URL that points to your Home Assistant installation.
`HASS_TOKEN` is the Long Lived Access Token to securely interact with Home Assistant. [Read more](https://www.home-assistant.io/docs/authentication/) about access tokens here.

### Standalone
*Coming soon*

---

## Scripting

### Examples
There's a `custom-js-examples` folder to explore. The example scripts will get you familiar with the way scripts are setup.

### API Reference
*Coming soon*

### Minimal script interface
Every script needs a minimal amount of code for HAL to understand and run:

```JavaScript
module.exports = {
  config: {
    supportedNodeEnvs: ['development', 'production'],
  },
  onStateChanged: async (state) => {
    // this will be called on each Home Assistant state change.
  },
};
```

#### config
The config object allows HAL to learn a bit more about your script.

| Property | | Type | Value(s) |
| --- | --- | --- | --- |
| `supportedNodeEnvs` | _required_ | Array | development, production |
| `entityFilter` | _optional_ | String, Array, RegExp | |
| `entityStateFilter` | _optional_ | String, Array, RegExp | |
| `onlyStateChanges` | _optional_ | Boolean | true, false |

#### onStateChanged
This method will be called by HAL every time an *entity* within Home Asssistant changes. The function is `async`, so you can safely use async/await within your code. The `onStateChanged` method is the main entry point for most of your scripts.

The `state` object is passed with each `onStateChanged` call and unique to your script.
You can read more about it below.

### Extended script interface
But wait, there's more! Quite a bit more actually.

#### init
This method is _optional_ and will be called by HAL when your script initialises or reloads. It allows you do do some maintanance within your script or some other initial tasks. This method is also called with the `state` object as parameter.

```JavaScript
init: (state) => {
  // do some housekeeping
},
```

#### state
The `state` object is passed as a paramater to most of the script methods. It contains a lot of information about the Home Assistant entities, has a few convenience methods and can be used to as a storage facility for your own script.

| Method | Input parameter(s) | Return type |
| --- | --- | --- |
| `getEntities` | | Object |
| `getChangedEntityKeys` | | Array |
| `getEntity` | Entity ID/Key | Object |
| `getEntityState` | Entity ID/Key | Any |
| `getEntityAttributes` | Entity ID/Key | Object |
| `getEntityAttribute` | Entity ID/Key, Attribute Key | Any |
| `getValueForKey` | Key, Default Value | Any |
| `setValueForKey` | Key, Value | Any |
| `getCurrentDateTime` | | [MomentJS](https://momentjs.com/) Object |
| `isAnyoneHome` | Array or String of People | Boolean |

*Examples and descriptions coming soon*

#### HAL
HAL itself also exposes a few helpful methods to the script interface.
*Coming soon*