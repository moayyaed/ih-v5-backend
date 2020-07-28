/**
 * trendservice.js
 * - Запуск db-агента Задается в конфигурации?
 * - Формирование trendSet
 */

const dm = require('../datamanager');
const Trendengine = require('./trendengine');
const Trendmate = require('./trendmate');

module.exports = async function(holder) {
  const engine = new Trendengine(holder, dm);
  const mate = new Trendmate(engine);

  engine.start(await mate.start());
};
