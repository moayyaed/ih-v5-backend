/**
 * trendengine.js
 */
// const util = require('util');

const Trendo = require('./trendo');
const dbconnector = require('../dbconnector');
const Timerman = require('../utils/timermanager');

const tm = new Timerman(0.1); // Запустить механизм таймеров c мин интервалом 100 мсек

class Trendengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;

    // key= TrendId: did_prop
    this.trendSet = {}; // Хранит trendo - правила сохранения в БД отдельной метрики (did_prop) и промежуточные данные

    holder.trendSet = this.trendSet;
    tm.on('ready', this.onTimerReady.bind(this));
  }

  start() {
    // Данные, которые пишутся при получении данных независимо от изменения
    this.holder.on('accepted:device:data', data => {
      this.onAcceptDeviceData(data);
    });

    // Данные, которые пишутся при изменении
    this.holder.on('changed:device:data', data => {
      this.onChangeDeviceData(data);
    });
    console.log('INFO: Trend engine has started');
  }

  getDn(doc) {
    const dobj = this.holder.devSet[doc.did];
    return dobj && dobj.dn ? dobj.dn : doc.did;
  }

  addItem(doc) {
    if (doc && doc.did && doc.prop && doc.dbmet) {
      doc.dn = this.getDn(doc);
      const id = getTrendId(doc.did, doc.prop);
      this.trendSet[id] = new Trendo(id, doc);
      this.startTimers(id);
    }
  }

  setItem(doc) {
    const id = getTrendId(doc.did, doc.prop);
    doc.dn = this.getDn(doc);
    // Возможно, уже есть элемент - тогда удалить таймеры и обновить
    if (this.trendSet[id]) {
      this.removeTimers(id);
      this.trendSet[id].update(doc);
      this.startTimers(id);
    } else this.addItem(doc);
  }

  removeItem(id) {
    if (this.trendSet[id]) delete this.trendSet[id];
  }

  startTimers(id) {
    if (!this.trendSet[id]) return;

    const item = this.trendSet[id];
    if (item.dbmet == 3 && item.dbtm > 0) tm.startTimer(item.dbtm, { owner: id, tname: 'save' });
    if (item.dbmet == 1 && item.dbforce > 0) tm.startTimer(item.dbforce, { owner: id, tname: 'force' });
  }

  removeTimers(id) {
    if (!this.trendSet[id]) return;

    tm.deleteAllTimers({ owner: id, tname: 'save' });
    tm.deleteAllTimers({ owner: id, tname: 'force' });
  }

  onAcceptDeviceData(data) {
    const toWrite = [];
    data.forEach(item => {
      // item { did: 'd0024', dn: 'vvv150', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3}
      const trendId = getTrendId(item.did, item.prop);
      if (this.trendSet[trendId]) {
        if (this.trendSet[trendId].dbmet == 2) {
          // 2 = Все значения
          toWrite.push({ dn: item.dn, prop: item.prop, ts: item.ts, val: item.value });
        } else if (this.trendSet[trendId].dbmet == 3) {
          // 3 = Периодически 
          this.trendSet[trendId].calc(item.value, item.ts);
        }
      }
    });
    if (toWrite) dbconnector.write(toWrite);
  }

  onChangeDeviceData(data) {
    const toWrite = [];
    data.forEach(item => {
      // item { did: 'd0024', dn: 'vvv150', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3}
      const trendId = getTrendId(item.did, item.prop);
      if (this.trendSet[trendId]) {
        const wriObj = this.trendSet[trendId].onChange(item.value, item.ts);
        if (wriObj) {
          toWrite.push(wriObj);
          this.trendSet[trendId].lastSavedTs = wriObj.ts;
          this.trendSet[trendId].lastSavedVal = wriObj.val;
        }
      }
    });
    if (toWrite) dbconnector.write(toWrite);
    return toWrite; // for tests
  }

  onTimerReady(timeobj) {
    if (!timeobj || !timeobj.owner || !timeobj.tname) return;
    const trendId = timeobj.owner;
    if (!this.trendSet[trendId]) return; // Удалили

    // Здесь может быть min+max - поэтому массив
    // Сохранить последнее значени
    const toWrite = this.trendSet[trendId].onTimer(timeobj.tname);

    if (toWrite && toWrite.length) {
      const lastIdx = toWrite.length - 1;
      this.trendSet[trendId].lastSavedTs = toWrite[lastIdx].ts;
      this.trendSet[trendId].lastSavedVal = toWrite[lastIdx].val;
      dbconnector.write(toWrite);
    }
    this.startTimers(trendId);

    // Форсированная запись - не реже чем раз в dbforce даже если данные приходят реже
    // Пишется текущее значение, если нет ошибки устройства.
    // TODO  Пишется текущее значение, если нет ошибки устройства. Если ошибка - не писать?? null -??
    /*
    if (timeobj.tname == 'force') {
      let now = Date.now();
      if (devSet[dn].dbforce > 0) {
        //
        // if (!devSet[dn].dbLastSaved || now - devSet[dn].dbLastSaved.ts > devSet[dn].dbforce * 1000) {
        saving([{ dn, val: devSet[dn].getMainVal(), ts: now }]);
        // }

        // Таймер нужно взвести с учетом последней записи в БД
        // let x = Math.round((now - devSet[dn].dbLastSaved.ts) / 1000);
        // tm.startTimer(devSet[dn].dbforce - x, { owner: dn, tname: 'force' });
        tm.startTimer(devSet[dn].dbforce, { owner: dn, tname: 'force' });
      }
    }
    */
  }
}

function getTrendId(did, prop) {
  return did + '_' + prop;
}

module.exports = Trendengine;
