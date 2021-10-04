/**
 * receivechannels.js
 * Функция обработки каналов от плагина
 * 
 * Сравнить текущие каналы и присланные
    - Если уже есть - замена свойств (не затрагивая привязку!)
    - Если нет - добавить
    - Если был и пропал
       - если нет привязки - удалить
       - если есть привязка - не удалять, генерировать ошибку ?? но канал оставить как есть
   Сделать запись в devhard напрямую без генерации события updated:devhard
   Вернуть статистику - 
 */

const util = require('util');
const hut = require('../utils/hut');

module.exports = async function(data, uobj, holder) {
  const unit = uobj.id;
  const newchanSet = hut.arrayToObject(data, 'id');

  const toAdd = [];
  const toUpdate = [];
  const toRemove = [];
  let marked = 0; // Помечены как отсутствующие, но не удалены, так как есть привязка
  let changes = 0; // 1 - есть изменения

  // Папки не трогаю, беру только каналы
  const docs = await holder.dm.dbstore.get('devhard', { unit });
  docs
    .filter(doc => !doc.folder)
    .forEach(doc => {
      if (newchanSet[doc.chan]) {
        // Есть такой канал
        // TODO возможно, нужно проверить и обновить свойства от плагина?? hut.doObjPlainPropsEqual
        if (doc.missing) {
          // Был missing - нашелся
          toUpdate.push({ _id: doc._id, $set: { missing: 0 } });
        }
        delete newchanSet[doc.chan];
      } else if (doc.did && doc.prop) {
        // Нет канала - проверяем, есть ли привязка
        // Есть привязка - удалить нельзя, пометить как отсутствующий
        toUpdate.push({ _id: doc._id, $set: { missing: 1 } });
        marked += 1;
      } else {
        // Нет канала, нет привязки - просто удалить
        toRemove.push({ _id: doc._id });
      }
    });

  // Остались новые каналы - добавить
  Object.keys(newchanSet).forEach(id => {
    delete newchanSet[id].id;
    const r = newchanSet[id] != undefined ? newchanSet[id] : 1;
    toAdd.push({ ...newchanSet[id], unit, chan: id, r });
  });

  // Сделать изменения в devhard напрямую без генерации события updated:devhard
  if (toUpdate.length) {
    for (const doc of toUpdate) {
      await holder.dm.dbstore.update('devhard', { _id: doc._id }, { $set: doc.$set });
    }
    changes = 1;
  }

  if (toRemove.length) {
    await holder.dm.removeThisDocs('devhard', toRemove);
    changes = 1;
  }

  if (toAdd.length) {
    await holder.dm.dbstore.insert('devhard', toAdd);
    changes = 1;
  }
  return { changes, added: toAdd.length, updated: toUpdate.length - marked, deleted: toRemove.length, marked };
};
