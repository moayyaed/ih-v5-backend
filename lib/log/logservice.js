/**
 * logservice.js
 *
 *  Чтение/запись журналов проекта в БД
 */

// const util = require('util');
const fs = require('fs');
const child = require('child_process');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const logconnector = require('./logconnector');

module.exports = async function(holder) {
  logconnector.start(forkLogagent('sqlite'), holder);
  setRetentions();

  // Слушать изменения rp
  holder.dm.on('updated:jlevelsTable', () => {
    setRetentions();
  });

  logconnector.addLog('pluginlog', { unit: 'system', txt: 'Start server' });

  async function setRetentions() {
    const rp = await holder.dm.datagetter.getLogRetentionDays({}, holder); // Сроки по level
    logconnector.setRetentions(rp);
  }
};

function forkLogagent(agent) {
  try {
    const modulepath = appconfig.getLogagentModule(agent);
    if (!fs.existsSync(modulepath)) throw { message: 'Not found ' + modulepath };

    const options = {
      dbPath: appconfig.get('logbasepath') + '/log.db',
      logfile: appconfig.get('logpath') + '/ih_' + agent + '_logagent.log',
      maxlogrecords: appconfig.get('maxdevicelogrecords'),
      loglevel: 1
    };

    const ps = child.fork(modulepath, [JSON.stringify(options)]);
    if (!ps) throw { message: 'Fork error: ' + modulepath };
    return ps;
  } catch (e) {
    console.log('ERROR: Logagent: ' + hut.getShortErrStr(e) + ' User logs will be unavailable!');
  }
}
