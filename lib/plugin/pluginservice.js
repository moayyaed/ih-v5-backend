/**
 * pluginservice.js
 *   Движок для модулей - дочерних процессов (плагины, dbagent, ...)
 *   У каждого вида - свой mate
 */

const dm = require('../datamanager');
const appconfig = require('../appconfig');

const Pluginengine = require('./pluginengine');

const Pluginmate = require('./pluginmate');
const Dbagentmate = require('../dbhistory/dbagentmate');

// Просто EE
const Pluginagent = require('events');

module.exports = async function(holder) {
  const agent = new Pluginagent();
  const engine = new Pluginengine(holder, dm, agent);

  const dbagentmate = new Dbagentmate(engine);
  const dbagentDoc = await dbagentmate.start();
  if (dbagentDoc === null) {
    log('db', appconfig.getMessage('NoDbUsed'), 2);
  } else {
    engine.addUnit('db', dbagentmate.createUnit(dbagentDoc)); // dbconnector должен придти внутри 
    log('db', 'Use dbagent ' + dbagentDoc._id, 2);
  }

  const pluginmate = new Pluginmate(engine);
  const unitDocs = await pluginmate.start();
  unitDocs.forEach(doc => engine.addUnit(doc._id, pluginmate.createUnit(doc))); 

  engine.start();
  console.log('INFO: Plugin engine has started, units: ' + unitDocs.length);

  function log(unit, txt, level) {
    console.log(unit+' '+txt)
    dm.insertToLog('pluginlog', { unit, txt, level });
  }
};
