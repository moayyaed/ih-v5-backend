/**
 * trendservice.js
 * - Запуск db-агента Задается в конфигурации?
 * - Формирование trendSet
 */


const util = require('util');

const dm = require('../datamanager');
const dbconnector = require('../dbconnector');
const Trendengine = require('./trendengine');
const Trendmate = require('./trendmate');

module.exports = async function(holder) {
  const engine = new Trendengine(holder, dm);
  const mate = new Trendmate(engine);

  engine.start(await mate.start());

  /**
   * 
   * Временно попробовать писать
   */

  holder.on('changed:device:data', data => {
    console.log('WARN: changed:device:data ' + util.inspect(data));
    const toWrite = data.map(item => ({dn:item.dn, prop:item.prop, ts:item.ts, val:item.value}));
    dbconnector.write(toWrite);
  });
};
