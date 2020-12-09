/**
 * pluginservice.js
 *
 */

const dm = require('../datamanager');
const Pluginengine = require('./pluginengine');
const Pluginmate = require('./pluginmate');

// Просто EE
const Pluginagent = require('events');

module.exports = async function(holder) {
  const agent = new Pluginagent(); // Просто eventEmitter?

  const engine = new Pluginengine(holder, dm, agent);
  const mate = new Pluginmate(engine);
  await mate.start();

  const unitDocs = await loadUnits();
  unitDocs.forEach(doc => engine.addUnit(doc));

  engine.start();
  console.log('INFO: Plugin engine has started, units: ' + unitDocs.length);
  

  async function loadUnits() {
    const docs = await dm.dbstore.get('units');

    const result = [];
    for (const doc of docs) {
      if (!doc.folder && doc.plugin) {
        // Загрузить каналы, если есть ??
        const charr = await engine.loadUnitChannels(doc._id);
        result.push({ ...doc, charr });
      }
    }
    return result;
  }
};
