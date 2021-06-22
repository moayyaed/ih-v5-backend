/*
 *  logger.js
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');

module.exports = {
  fd: 0,
  loglevel: 0,

  start(logfileName, level) {
    console.log('logfileName '+logfileName)
    // this.fd = fs.openSync(logfileName, 'a'); // добавляет
    this.fd = fs.openSync(logfileName, 'w'); // перезаписывает
    this.setLoglevel(level || 0);
  },

  // level: 0 - низкий уровень (пишется всегда), 1 -средний уровень, 2 - высокий уровень
  log(msg, level, loglevel) {

    // console.log('LOGGER.log '+msg+' level='+level+' loglevel='+loglevel)
    if (!this.fd) return;
    if (level && loglevel < level) return;

    const str = typeof msg == 'object' ? 'ERROR: ' + hut.getShortErrStr(msg) : msg;
    fs.write(this.fd, getDateStr() + ' ' + str + '\n', err => {
      if (err) console.log('Log error:' + str + util.inspect(err));
    });
  },

  setLoglevel(level) {
    this.loglevel = level;
    this.log('Log level: '+level);
  }

};

function getDateStr() {
  const dt = new Date();
  return (
    pad(dt.getDate()) +
    '.' +
    pad(dt.getMonth() + 1) +
    ' ' +
    pad(dt.getHours()) +
    ':' +
    pad(dt.getMinutes()) +
    ':' +
    pad(dt.getSeconds()) +
    '.' +
    pad(dt.getMilliseconds(), 3)
  );
}

function pad(str, len = 2) {
  return String(str).padStart(len, '0');
}

