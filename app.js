/**
 * Main backend V5
 *
 *  app.js
 */

const util = require('util');
const EventEmitter = require('events');

const init = require('./lib/init');
const start = require('./lib/start');
const dm = require('./lib/datamanager');
const am = require('./lib/accessmanager');

(async () => {
  const holder = new EventEmitter();
  holder.system = { bootTs: Date.now() };

  process.on('exit', () => {
    if (holder) holder.emit('finish');
  });

  process.on('SIGINT', () => {
    process.exit(0);
  });

  process.on('warning', e => console.log('WARN: process warning: ' + util.inspect(e)));
  process.on('uncaughtException', e => console.log('ERROR: uncaughtException: ' + util.inspect(e)));
  process.on('unhandledRejection', (reason, promise) =>
    console.log('ERROR: unhandledRejection: Reason ' + util.inspect(reason) + '. Promise ' + util.inspect(promise))
  );

  try {
    await init(__dirname);
    holder.dm = dm;
    holder.am = am;
    await start(holder);
  } catch (err) {
    console.log('ERROR: Main App Exception ' + util.inspect(err));
    setTimeout(() => {
      process.exit();
    }, 500);
  }
})();
