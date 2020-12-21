/**
 * Main ih-backend-d.
 *
 *  app.js
 */

const util = require('util');
const init = require('./lib/init');

const globalvarservice = require('./lib/globalvar/globalvarservice');
const deviceservice = require('./lib/device/deviceservice');
const pluginservice = require('./lib/plugin/pluginservice');
const sceneservice = require('./lib/scene/sceneservice');
const snippetservice = require('./lib/snippet/snippetservice');
const trendservice = require('./lib/trend/trendservice');

const webserver = require('./lib/web/webserver');
const dm = require('./lib/datamanager');

const EventEmitter = require('events');

(async () => {
  const holder = new EventEmitter();

  process.on('exit', () => {
    if (holder) holder.emit('finish');
  });

  process.on('SIGINT', () => {
    process.exit(0);
  });

  process.on('warning', e => console.log('WARN: process warning: ' + e.stack));

  try {
    await init(__dirname);
    holder.dm = dm;

    await globalvarservice(holder);
    await deviceservice(holder);
    await pluginservice(holder);
    await sceneservice(holder);
    await snippetservice(holder);
    await trendservice(holder);
    await webserver(holder);
  } catch (err) {
    console.log('ERROR: Main App Exception ' + util.inspect(err));
    setTimeout(() => {
      process.exit();
    }, 500);
  }
})();
