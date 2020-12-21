/**
 * trendservice.js
 * - Формирование trendSet
 */

const util = require('util');

const dm = require('../datamanager');
const Trendengine = require('./trendengine');
const Trendmate = require('./trendmate');

module.exports = async function(holder) {
  const engine = new Trendengine(holder, dm);
  const mate = new Trendmate(engine);

  // Получить список устройств из таблицы devicedb
  const docs = await holder.dm.dbstore.get('devicedb', {}, { order: 'did' });
  docs.forEach(doc => engine.addItem(doc));

  mate.start();
  engine.start();
};
