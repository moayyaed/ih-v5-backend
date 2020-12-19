/**
 * pluginservice.js
 *   Движок для модулей - дочерних процессов (плагины, dbagent, ...)
 *   У каждого вида - свой mate
 */
const util = require('util');
const appconfig = require('../appconfig');

const Pluginengine = require('./pluginengine');
const Pluginmate = require('./pluginmate');
const Dbagentmate = require('../dbhistory/dbagentmate');

const pluginutil = require('./pluginutil');
const dbagentutil = require('../dbhistory/dbagentutil');

// Просто EE
const Pluginagent = require('events');

module.exports = async function(holder) {
  const agent = new Pluginagent();
  const engine = new Pluginengine(holder, agent);

  // Dbagent - один модуль
  const dbagentmate = new Dbagentmate(engine);
  const dbagentDoc = await dbagentutil.getActiveUnitDoc(holder);

  let msg = appconfig.getMessage('Restart') + '. ';
  if (dbagentDoc === null) {
    msg += appconfig.getMessage('NoDbUsed');
  } else {
    const unitId = dbagentDoc._id;
    msg += appconfig.getMessage('Dbagent') + ' ' + unitId;
    const dbagentobj = dbagentutil.createUnit(dbagentDoc);
    const info = await holder.dm.getDbagentInfo(unitId);

    engine.addUnit(unitId, dbagentobj, info);
    if (info && info.version) msg += ' v'+info.version;
  }
  log('dbagent', msg);

  // Остальные плагины
  const pluginmate = new Pluginmate(engine);

  // const unitDocs = (await dm.dbstore.get('units')).filter(doc => pluginutil.isUnitDoc(doc));
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
    console.log('INFO: ' + unit + ' ' + txt);
    holder.dm.insertToLog('pluginlog', { unit, txt, level });
  }
};
