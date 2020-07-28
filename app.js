/**
 * Main ih-backend-d.
 *
 *  app.js
 */

const util = require('util');
const init = require('./lib/init');

// const dbadapter = require('./lib/dbhistory/dbadapter');
const deviceservice = require('./lib/device/deviceservice');
const logserver = require('./lib/log/logserver');
const pluginservice = require('./lib/plugin/pluginservice');
const sceneservice = require('./lib/scene/sceneservice');
const trendservice = require('./lib/trend/trendservice');

const webserver = require('./lib/web/webserver');
const resserver = require('./lib/resource/resourceserver');

const EventEmitter = require('events');

(async () => {
  const holder = new EventEmitter();

  process.on('exit', () => {
    if (holder) holder.emit('finish');
  });

  process.on('SIGINT', () => {
    process.exit(0);
  });

 
  try {
    await init(__dirname);
    await logserver(holder);
    await deviceservice(holder);
    await resserver(holder);
    await pluginservice(holder);
    await sceneservice(holder);
    await trendservice(holder);

    await webserver(holder);
  } catch (err) {
    console.log('ERROR: Main App Exception ' + util.inspect(err));
    setTimeout(() => {
      process.exit();
    }, 500);
  }
})();
