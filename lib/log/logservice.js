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

const logformer = require('./logformer');
const logconnector = require('./logconnector');

module.exports = async function(holder) {
  logconnector.start(forkLogagent('sqlite'), holder);
  logformer.start(logconnector);
  

  holder.addLog = async (table, mesObj) => {
    if (!logconnector.isActive()) return;
    const docs = await logformer.exec(table, Array.isArray(mesObj) ? mesObj : [mesObj]);
    logconnector.write(table, docs);
  };

  holder.deleteLog = async (table, filter) => {
    if (!logconnector.isActive()) return;
    logconnector.delete(table, filter);
  };

  holder.getLog = async (table = 'mainlog', filter = {}, opt = {}) => {
    if (!logconnector.isActive()) return [];
    return logconnector.read(table, filter, opt);
  };

  holder.addLog('pluginlog', { unit: 'system', txt: 'Start server' });


};

function forkLogagent(agent) {
  try {
    const modulepath = appconfig.getLogagentModule(agent);
    if (!fs.existsSync(modulepath)) throw { message: 'Not found ' + modulepath };

    const options = {
      dbPath: appconfig.get('logbasepath') + '/log.db',
      logfile: appconfig.get('logpath') + '/ih_' + agent + '_logagent.log',
      loglevel: 1
    };

    const ps = child.fork(modulepath, [JSON.stringify(options)]);
    if (!ps) throw { message: 'Fork error: ' + modulepath };
    return ps;
  } catch (e) {
    console.log('ERROR: Logagent: ' + hut.getShortErrStr(e) + ' User logs will be unavailable!');
  }
}
