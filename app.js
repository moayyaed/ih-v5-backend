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

// const holder = new EventEmitter();
/*
init(__dirname)
  .then(() => {
    console.log('INFO: deviceserver start ' );
    deviceserver(holder);
    console.log('INFO: deviceserver started ' );
  })
  .then(() => {
    console.log('INFO: resserver start ' );
    resserver(holder);
    console.log('INFO: resserver started ' );
  })
  .then(() => {
    console.log('INFO: pluginserver start ' );
    pluginserver(holder);
    console.log('INFO: pluginserver started ' );
  })
  .then(() => {
    console.log('INFO: sceneserver start ' );
    sceneserver(holder);
    console.log('INFO: sceneserver started ' );
  })
  .then(() => {
    console.log('INFO: trendserver start ' );
    trendserver(holder);
    console.log('INFO: trendserver started ' );
  })
  .then(() => {
    console.log('INFO: webserver start ' );
    webserver(holder);
    console.log('INFO: webserver started ' );
  })
  .catch(e => {
    console.log('ERROR: FATAL ERROR. ' + util.inspect(e));
    setTimeout(() => {
      process.exit();
    }, 500);
  });
   process.on('uncaughtException', err => {
    console.log('ERROR: uncaughtException ' + util.inspect(err));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.log('ERROR: Unhandled Rejection at:', promise, 'reason:', reason);
  });

*/
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

    console.log('INFO: deviceserver start ' );
    await deviceserver(holder);
    console.log('INFO: deviceserver started ' );
  
  
    console.log('INFO: resserver start ' );
    await resserver(holder);
    console.log('INFO: resserver started ' );
  
    console.log('INFO: pluginserver start ' );
    await pluginserver(holder);
    console.log('INFO: pluginserver started ' );
  
    console.log('INFO: sceneserver start ' );
    await sceneserver(holder);
    console.log('INFO: sceneserver started ' );
  
    console.log('INFO: trendserver start ' );
    await trendserver(holder);
    console.log('INFO: trendserver started ' );
 
    console.log('INFO: webserver start ' );
    await webserver(holder);
    console.log('INFO: webserver started ' );
  } catch (err) {
    console.log('ERROR: Main App Exception ' + util.inspect(err));
    setTimeout(() => {
      process.exit();
    }, 500);
  }
})();
