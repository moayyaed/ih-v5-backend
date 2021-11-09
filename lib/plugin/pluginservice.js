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
  const pluginmate = new Pluginmate(engine);

  // Dbagent - один модуль
  const dbagentObj = await addDbagent();

  // Системные плагины
  const systemplugins = appconfig.getSystemplugins();

  // reportmaker - установить отдельно. только если включен в список и установлен
  const reportmakerIdx = systemplugins.findIndex(item => item.name == 'reportmaker');
  if (reportmakerIdx >= 0) {
    systemplugins.splice(reportmakerIdx, 1);
    if (dbagentObj) {
      await addReportmaker();
    }
  }

  for (const item of systemplugins) {
    if (item.name && item.type == 'plugin') {
      const info = await holder.dm.getPluginInfo(item.name);
      const unitobj = pluginutil.createSystempluginUnit(item, info);
      // Плагин может быть suspend как и обычный плагин
      // Эта инф-я хранится в таблице sysunits
      unitobj.suspend = await getSuspended(item.name);
      engine.addUnit(item.name, unitobj);
    }
  }

  // Остальные плагины
  const unitDocs = await pluginutil.getUnitDocs(holder);
  for (const doc of unitDocs) {
    const uobj = await engine.createUnit(doc);
    engine.addUnit(doc._id, uobj);
  }

  pluginmate.start();
  engine.start();
  console.log('INFO: Plugin engine has started, units: ' + unitDocs.length);

  async function addDbagent() {
    const dbagentDoc = await dbagentutil.getActiveUnitDoc(holder);
    let dbagentobj;
    let msg = '';
    if (dbagentDoc === null) {
      msg = appconfig.getMessage('NoDbUsed');
    } else {
      const dbagentmate = new Dbagentmate(engine);
      const unitId = dbagentDoc._id;
      const info = await holder.dm.getDbagentInfo(unitId);
      msg = getDbagentMessage(unitId, info);
      dbagentobj = await dbagentutil.createUnit(dbagentDoc, info);
      engine.addUnit(unitId, dbagentobj);
      dbagentmate.start(); // Агент может поменяться
    }
    engine.logUnit('dbagent', msg);
    return dbagentobj;
  }

  function getDbagentMessage(unitId, info) {
    let res = '';
    if (info && info.version) res += ' v' + info.version;
    console.log('INFO: ' + unitId + res);
    return appconfig.getMessage('Dbagent') + ' ' + unitId + res;
  }

  async function addReportmaker(dbagentobj) {
    const unitId = 'reportmaker';
    const info = await holder.dm.getPluginInfo(unitId);
    const unitobj = await dbagentutil.createReportmakerUnit(dbagentobj, info);
    engine.addUnit(unitId,  unitobj);
  }

  async function getSuspended(unitId) {
    const doc = await holder.dm.findRecordById('sysunits', unitId);
    return doc && doc.suspend ? 1 : 0;
  }
};
