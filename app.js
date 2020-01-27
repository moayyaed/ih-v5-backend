/**
 * ih-backend-D
 *
 *  Main
 */

const util = require('util');

require('./lib/init')
  .startP(__dirname)
  .then(() => {
    require('./lib/web/webserver');

    process.on('exit', () => {});

    process.on('SIGINT', () => {
      process.exit(0);
    });

    process.on('uncaughtException', err => {
      console.log('ERR: uncaughtException ' + util.inspect(err));
    });
  })
  .catch(e => {
    console.log('ERR: FATAL ERROR. ' + util.inspect(e));
    setTimeout(() => {
      process.exit();
    }, 500);
  });
