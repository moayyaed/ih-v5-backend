/**
 * pluginservice.js
 *   Движок для модулей - дочерних процессов (плагины, dbagent, ...)
 *   У каждого вида - свой mate
 */

// const util = require('util');
const appconfig = require('../appconfig');

const Pluginengine = require('./pluginengine');
const Pluginmate = require('./pluginmate');
const Dbagentmate = require('../dbs/dbagentmate');

const pluginutil = require('./pluginutil');
const dbagentutil = require('../dbs/dbagentutil');

// Просто EE
const Pluginagent = require('events');

module.exports = async function(holder) {
  const agent = new Pluginagent();
  const engine = new Pluginengine(holder, agent);

  // Dbagent - один модуль
  const dbagentmate = new Dbagentmate(engine);
  const dbagentDoc = await dbagentutil.getActiveUnitDoc(holder);

  let msg = '';
  if (dbagentDoc === null) {
    msg += appconfig.getMessage('NoDbUsed');
  } else {
    const unitId = dbagentDoc._id;
    const info = await holder.dm.getDbagentInfo(unitId);
    if (info && info.version) msg += ' v' + info.version;
    console.log('INFO: ' + unitId + msg);
    msg = appconfig.getMessage('Dbagent') + ' ' + unitId + msg;

    const dbagentobj = dbagentutil.createUnit(dbagentDoc);
    engine.addUnit(unitId, dbagentobj);
  }
  log('dbagent', msg);

  // Остальные плагины
  const pluginmate = new Pluginmate(engine);
  const unitDocs = await pluginutil.getUnitDocs(holder);
  for (const doc of unitDocs) {
    const uobj = await engine.createUnit(doc);
    engine.addUnit(doc._id, uobj);
  }

  dbagentmate.start();
  pluginmate.start();
  engine.start();
  console.log('INFO: Plugin engine has started, units: ' + unitDocs.length);

  function log(unit, txt, level) {
    holder.dm.insertToLog('pluginlog', { unit, txt, level });
  }
};
