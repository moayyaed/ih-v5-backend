/**
 * alertservice.js
 */

const Alertengine = require('./alertengine');
const Alertmate = require('./alertmate');

module.exports = async function(holder) {
  const dm = holder.dm;
  const engine = new Alertengine(holder);

  const mate = new Alertmate(engine, dm);

  // Загрузить активные алерты, которые остались открытыми
  const docs = await dm.get('alerts');

  const toRemove = []; // проверить, что устройство существует. Если нет - нужно удалить алерт
  const activeDocs = []; // Для движка брать только активные алерты
  docs.forEach(doc => {
    if (doc.did) {
      if (!holder.devSet[doc.did]) {
        toRemove.push({ _id: doc._id });
      } else if (!doc.tsStop) {
        activeDocs.push(doc);
      }
    }
  });

  // Список журналов для определения, в какие журналы должен попасть алерт
  const ajDocs = await dm.get('alertjournal', { folder: { $ne: 1 } });

  engine.start(activeDocs, ajDocs);
  mate.start();
};
