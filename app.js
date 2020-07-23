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
    await deviceserver(holder);
    await resserver(holder);
    await pluginserver(holder);
    await sceneserver(holder);
    await trendserver(holder);
    await webserver(holder);
  } catch (err) {
    console.log('ERROR: Main App Exception ' + util.inspect(err));
    setTimeout(() => {
      process.exit();
    }, 500);
  }
})();
