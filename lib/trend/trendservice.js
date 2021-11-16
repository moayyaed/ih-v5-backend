/**
 * trendservice.js
 * - Формирование trendSet, timelineSet
 */

const util = require('util');

const Trendengine = require('./trendengine');
const Trendmate = require('./trendmate');

module.exports = async function(holder) {
  const engine = new Trendengine(holder);
  const mate = new Trendmate(engine);

  // Получить список устройств из таблицы devicedb
  // В процессе формируются trendSet и timelineSet - но без значений
  const docs = await holder.dm.dbstore.get('devicedb', {}, { order: 'did' });
  docs.forEach(doc => engine.addItem(doc));

  // Синхронизировать таймлайны с текущим состоянием устройств. Завершенные сохранить в БД
  await syncTimelineCurrent();

  mate.start();
  engine.start();

  //
  async function syncTimelineCurrent() {
    // Получить активные таймлайны, сопоставить с текущим состоянием.
    // Завершенные сохранить в БД
    const toWriteDB = [];
    const toWriteCurrent = [];
    const toRemove = [];
    const ts = Date.now();
    try {
      const tmcurrentDocs = await holder.dm.dbstore.get('timelinecurrent');
      for (const doc of tmcurrentDocs) {
        const id = doc._id;
        // Если надо сохранять (стоит галка) - есть  this.timelineSet[id]
        if (!id || !holder.timelineSet[id]) {
          // Иначе уже не надо сохранять
          toRemove.push(doc);
          continue;
        }

        // проверить текущее состояние устройства
        const [dn, prop] = id.split('.');
        if (!dn || !prop || !holder.dnSet[dn]) {
          // Неверная запись или нет такого устройства
          toRemove.push(doc);
          continue;
        }

        const dobj = holder.dnSet[dn];

        if (dobj[prop] != doc.state) {
          console.log(dn + ' ' + prop + 'dobj[prop] = ' + dobj[prop]);
          const newState = dobj[prop];

          // Если не совпадает - сохранить завершенный интервал в БД
          toWriteDB.push(holder.timelineSet[id].getCompleted({ dn, prop, state: doc.state, start: doc.start }, ts - 1));

          // Начать новый интервал, если не нулевой
          if (newState > 0) {
            holder.timelineSet[id].start = ts;
            holder.timelineSet[id].state = newState;
            toWriteCurrent.push({ _id: id, start: ts, state: newState });
          } else {
            holder.timelineSet[id].start = 0;
            holder.timelineSet[id].state = 0;
            toRemove.push(doc);
          }
        } else {
          // Если совпадает - добавить сохраненный start в holder.timelineSet[id]
          holder.timelineSet[id].start = doc.start;
          holder.timelineSet[id].state = doc.state;
        }
      }

      if (toRemove.length) {
        await holder.dm.removeThisDocs('timelinecurrent', toRemove);
      }
      engine.saveTimeline(toWriteDB, toWriteCurrent);
    } catch (e) {
      console.log('ERROR: trendservice.syncTimelineCurrent ' + util.inspect(e));
    }
  }
};
