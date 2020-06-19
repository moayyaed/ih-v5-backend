/**
 * Main ih-backend-d.
 *
 *  app.js
 */

const util = require('util');
const init = require('./lib/init');

// const dbadapter = require('./lib/dbhistory/dbadapter');
const deviceserver = require('./lib/device/deviceserver');
const pluginserver = require('./lib/plugin/pluginserver');
const sceneserver = require('./lib/scene/sceneserver');
const trendserver = require('./lib/trend/trendserver');
const webserver = require('./lib/web/webserver');
const resserver = require('./lib/resource/resourceserver');
const EventEmitter = require('events');

const holder = new EventEmitter();

init(__dirname)
  .then(() => {
    deviceserver(holder);
  })
  .then(() => {
    resserver(holder);
  })
  .then(() => {
    pluginserver(holder);
  })
  .then(() => {
    sceneserver(holder);
  })
  .then(() => {
    trendserver(holder);
  })
  .then(() => {
    webserver(holder);
  })
  .catch(e => {
    console.log('ERR: FATAL ERROR. ' + util.inspect(e));
    setTimeout(() => {
      process.exit();
    }, 500);
  });

process.on('exit', () => {
  if (holder) holder.emit('finish');
});

process.on('SIGINT', () => {
  process.exit(0);
});

process.on('uncaughtException', err => {
  console.log('ERR: uncaughtException ' + util.inspect(err));
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('ERR: Unhandled Rejection at:', promise, 'reason:', reason);
});
