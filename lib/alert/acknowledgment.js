/**
 * acknowledgment.js
 *
 * Обработка квитирования алерта
 *  - Проверяется, что алерт существует
 *  TODO - имеются права на квитирование
 * - Изменяется запись в таблице alerts
 * - Генерируется событие ack:alert для движка алертов
 */

const util = require('util');

async function exec(query, oper, holder) {
  try {
    if (!query.userId) throw { message: 'Missing userId!' };
    if (!query.payload) throw { message: 'Missing payload!' };
    if (!query.payload._id) throw { message: 'Missing payload._id!' };

    const payload = query.payload;
    const _id = payload.id;

    let userId = query.userId;
    let tsAck = Date.now();
    // TODO - проверить права

    // Считать алерт и проставить tsAck и userId
    const aleObj = await holder.dm.findRecordById('alerts', _id);
    if (!aleObj) throw { message: 'Not found alert with _id=' + _id };

    if (oper == 'deack') {
      userId = '';
      tsAck = 0;
    }
    aleObj.tsAck = tsAck;
    aleObj.userId = userId;

    await holder.dm.updateDocs('alerts', [{ _id, $set: { tsAck, userId } }]);
    holder.emit(oper + ':alert', aleObj);

    return { refresh: true };
  } catch (e) {
    console.log('ERROR: ackAlert ' + util.inspect(e));
    throw { message: (e.message + ' ' || '') + 'Операция не выполнена!' };
  }
}

module.exports = {
  exec
};
