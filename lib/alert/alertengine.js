/**
 * alertengine.js
 *  Генерация алертов
 *  Отслеживание статуса алертов
 *  Отрабатывает квитирование
 *  Закрывает алерты по правилу toClose
 *  Пишет в журналы: alerts, devicelog, mainlog
 * 
 *  - генерирует событие состояния алертов (добавление, изменение, удаление)
 * 
 *  _id - уникальный номер 
   txt - текст, описывающий событие
   level - уровень 
   owner - владелец (кто сгенерировал ): d002.value, scene_scene1_a1 ??

   tsStart - возникновение
   tsStop - завершение
   tsAck - квитирование
   reason - как было завершено: norm, up, down

   TODO Алгоритм перехода в состояния start/stop c учетом временной задержки
   Состояние алерта до сработки таймера - pre
   
 */

const util = require('util');
const shortid = require('shortid');
const deviceutil = require('../device/deviceutil');

const devicelogger = require('../device/devicelogger');
const logconnector = require('../log/logconnector');

const typestore = require('../device/typestore');

const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

class Alertengine {
  constructor(holder) {
    this.holder = holder;

    // Правила генерации алертов, хранятся в объекте типа устройства
    this.alertsByType = {}; // {t002: new Set('state','temp'} - алерты свои для каждого свойства
    holder.typeMap.forEach((typeObj, key) => {
      this.formAlertsByTypeFromTypeItem(key);
    });

    this.alertJournals = new Map(); // Содержит журналы тревог с фильтрами, чтобы определить, в какие журналы попадает алерт

    // Сущности активных или ждущих (pending) алертов
    this.alertSet = {}; // Алерты по uuid
    // Если stop - отсюда сразу удаляется
    // При квитировании достать из таблицы alerts
    // Если delay>0 - добавляется в состоянии pre, иначе сразу started
    // Пока pre - могут быть просто удалены без всяких записей

    this.ownerMap = new Map(); // Алерты по владельцам  key=did.prop: uuid - текущий всегда д б один
    // Его состояние (в alertSet) может быть: pre - взведен таймер, start - активный
  }

  /**
   * Загрузка активных алертов
   * @param {Array of objects} docs - документы уже проверены - устройство существует
   */
  start(docs, ajDocs) {
    // Подготовить список журналов
    ajDocs.forEach(doc => {
      this.alertJournals.set(doc._id, { tags: doc.tags || '', location: doc.location || '' });
    });

    // Построить alertSet и ownerMap
    docs.forEach(doc => {
      this.alertSet[doc._id] = doc;
      this.ownerMap.set(doc.owner, doc._id);
    });

    // Запустить механизм таймеров для pre
    // const tm = new Timerman(1);
    // tm.on('ready', this.onTimerReady);

    // При изменении значений - генерировать алерты
    this.holder.on('changed:device:data', data => {
      this.runAlertsByType(data);
    });

    // При квитировании - Таблица alerts уже отредактирована
    this.holder.on('ack:alert', data => {
      this.ackAlert(data);
    });
    this.holder.on('deack:alert', data => {
      this.deackAlert(data);
    });

    
    // При изменении тревог в типе
    this.holder.on('add:type:alerts', (type, props) => {
      // Добавить в списки this.alertsByType

      // Пытаться генерировать тревоги без изменения значений для устройств этого типа
    });

    this.holder.on('update:type:alerts', (type, prop) => {
      // Изменилось тело алерта для свойства prop
      // Перегенерировать - удалить, потом добавить
    });

    this.holder.on('remove:type:alerts', (type, props) => {
      // TODO Удалить из списка this.alertsByType

      // Удалить все текущие алерты для устройств этого типа по заданным свойствам
      this.removeAlertsForProps(type, props) 
    });
    
  }

  formAlertsByTypeFromTypeItem(type) {
    const typeObj = typestore.getTypeObj(type);
    if (!typeObj) return;
    if (!typeObj.alerts) return; // Если есть флаг ale, но таблица дефолтная - она не рабочая??

    if (!this.alertsByType[type]) this.alertsByType[type] = new Set();
    // console.log(' formAlertsByTypeFromTypeItem typeObj=' + util.inspect(typeObj, null, 4));

    Object.keys(typeObj.alerts).forEach(prop => {
      if (typeObj.props[prop].ale) {
        // Только если флаг установлен
        this.alertsByType[type].add(prop);
      } else {
        this.alertsByType[type].delete(prop);
      }
    });
  }

  runAlertsByType(changed) {
    changed.forEach(item => {
      const type = this.holder.devSet[item.did].type;
      if (this.alertsByType[type] && this.alertsByType[type].has(item.prop)) {
        const typeObj = typestore.getTypeObj(type);
        if (typeObj.props[item.prop].ale && typeObj.alerts[item.prop]) {
          const alerts = typeObj.alerts[item.prop];
          const vtype = typeObj.props[item.prop].vtype;
          const res = vtype == 'N' ? hiLoAlert(item.value, alerts) : binAlert(item.value, alerts);

          const { did, prop } = item;
          const owner = did + '.' + prop;
          const aleData = { owner, did, prop, ...res };
          if (aleData.level) {
            this.tryStartAlert(aleData);
          } else if (this.ownerMap.has(owner) && this.ownerMap.get(owner)) {
            this.tryStopAlert(aleData);
          }
        }
      }
    });
  }

  /**
   *
   * @param {Object} aleData - что пришло из таблицы настройки + owner +aruleId
   *      {owner, did, prop, "theval":1,"message":"Alarm!!!!","level":1,"delay":"4","toClose":"stop","needAck":1}
   */
  tryStartAlert(aleData) {
    const { aruleId, owner, level } = aleData;

    // Если уже есть алерт
    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      if (this.alertSet[aid]) {
        // Уже взведен или pre, уровень совпадает
        if (this.alertSet[aid].aruleId == aruleId) return;

        // Уровни отличаются
        //  - этот закрыть из за изменения уровня сообщения от данного владельца
        // TODO - это нужно сделать только если started (не pre)  Иначе ??
        this.stopAlert(aid, getLevelReason(this.alertSet[aid].level, level));
      }
    }
    return this.addAlert(aleData);
  }

  /**
   *
   * @param {*} owner
   * @param {Object} aleData -
   */
  addAlert(aleData) {
    const _id = getNewAid();
    const { owner, did, prop, toClose, level } = aleData;

    const dobj = this.holder.devSet[did];
    if (!dobj) {
      console.log('ERROR: saveAlertDeviceStatus. Not found device ' + did);
      return;
    }

    // Создать текст алерта или взять готовый, если есть message, и записать в txt
    const tsStart = Date.now();
    const propTitle = dobj.getPropTitle(aleData.prop);
    const txt = formAlertTxt(aleData, propTitle);
    const longtxt = dobj.name + ' ' + dobj.dn + '. ' + txt;

    const location = deviceutil.getLocation(did, this.holder);
    const tags = dobj.tags;
    const ajarr = this.chooseJournals({ tags, location });

    // Подобрать журналы по tags и location??

    this.alertSet[_id] = { _id, ...aleData, tsStart, txt, longtxt, propTitle, tags, location, ajarr };

    this.ownerMap.set(owner, _id);

    // Пока без таймера!! Возможно, что start не сразу - тогда не посылать??

    this.holder.dm.insertDocs('alerts', [
      { _id, owner, toClose, did, prop, txt: longtxt, level, tsStart, tags, location, ajarr }
    ]);

    // также нужно записать в журналы
    // console.log('BEFORE devicelogger did='+did+' txt='+txt)
    devicelogger.addLog(did, { did, prop, ts: tsStart, txt, level });
    logconnector.addLog('mainlog', { did, prop, ts: tsStart, txt: longtxt, level });

    // и генерировать событие изменения алерта
    // const changed = { id: _id, state: 'add', payload: { ts: tsStart, tsStart, level, txt: longtxt } };
    // this.holder.emit('alerts', changed);
    this.emitAlertsChanged('add', [{ id: _id, ts: tsStart, tsStart, level, txt: longtxt, state: 1 }]);
  }

  chooseJournals({ tags, location }) {
    const arrTag = tags ? tags.split('#').filter(item => item) : '';
    const ajournals = [];
    this.alertJournals.forEach((filter, key) => {
      let byTag = true; // Если Фильтра по tags нет
      let byLoc = true;
      if (location && filter.location) {
        byLoc = location.startsWith(filter.location);
      }

      if (byLoc && arrTag && filter.tags) {
        // Это массивы
        byTag = arrTag.every(elem => filter.tags.includes(elem));
      }

      if (byTag && byLoc) ajournals.push(key);
    });
    return ajournals;
  }

  emitAlertsChanged(op, payload) {
    // Подставить в payload строки для ts
    payload.forEach(item => {
      if (item.tsStart != undefined) item.tsStartStr = getTsStr(item.tsStart);
      if (item.tsStop != undefined) item.tsStopStr = getTsStr(item.tsStop);
      if (item.tsAck != undefined) item.tsAckStr = getTsStr(item.tsAck);
    });

    const changed = { op, payload };
    console.log('EMIT alertlog ' + util.inspect(changed));
    this.holder.emit('alertlog', changed);
  }

  //  Это переход в норму (level 0 => stop, reason: norm)
  tryStopAlert(aleData) {
    // console.log('tryStopAlert '+util.inspect(aleData))
    const { owner } = aleData;
    const normtxt = formNormTxt(aleData);
    // Пока без таймера - сразу стоп
    // console.log('tryStopAlert owner=' + owner);
    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      console.log('stopAlert owner=' + owner + ' aid=' + aid + ' before STOP');
      this.stopAlert(aid, 'norm', normtxt);
      this.ownerMap.set(owner, 0);
    } else {
      console.log('tryStopAlert Missing in this.ownerMap ' + util.inspect(this.ownerMap));
    }
  }

  // stop может быть по разным причинам Отправить, у себя сразу удалить
  async stopAlert(aid, reason, normtxt) {
    if (!this.alertSet[aid]) {
      console.log('Not FOUND alert ' + aid);
      return;
    }

    const aleObj = this.alertSet[aid];
    const tsStop = Date.now();
    aleObj.tsStop = tsStop;
    aleObj.reason = reason;

    if (canCloseAlert(aleObj)) {
      await this.closeAlerts(aleObj, reason == 'norm');
    } else {
      await this.holder.dm.updateDocs('alerts', [{ _id: aid, $set: { tsStop, reason } }]);
      this.emitAlertsChanged('update', [{ id: aid, state: 0, tsStopStr: getTsStr(tsStop) }]);
    }

    delete this.alertSet[aid];
  }

  // Пришли данные из таблицы alerts с квитированием
  async ackAlert(aleData) {
    const { _id, tsAck, userId } = aleData;

    // Может и не быть - если уже stopped
    if (this.alertSet[_id]) {
      this.alertSet[_id].tsAck = tsAck;
      this.alertSet[_id].userId = userId;
    }

    // Нужно фиксировать эту операцию в журналах

    // Затем попробовать закрыть алерт
    const canClose = canCloseAlert(aleData);
    console.log('!!!canClose =' + canClose);
    if (canClose) {
      await this.closeAlerts(aleData);
    } else {
      this.emitAlertsChanged('update', [{ id: _id, tsAck, userId }]);
    }
  }

  async closeAlerts({ _id, owner }, all) {
    const docs = [{ _id }];
    // И все для этого owner, если reason == 'norm' и не требуется квитирование??
    if (all) {
      const others = await this.holder.dm.get('alerts', { owner });
      if (others) {
        others.forEach(doc => {
          if (doc._id != _id) docs.push({ _id: doc._id });
        });
      }
    }

    await this.holder.dm.removeDocs('alerts', docs);
    this.emitAlertsChanged(
      'delete',
      docs.map(item => ({ id: item._id }))
    );
  }

  async deackAlert(aleData) {
    const { _id } = aleData;

    // Может и не быть - если уже stopped
    if (this.alertSet[_id]) {
      this.alertSet[_id].tsAck = 0;
      this.alertSet[_id].userId = '';
    }

    // Нужно фиксировать эту операцию в журналах

    this.emitAlertsChanged('update', [{ id: _id, tsAck: 0, userId: '' }]);
  }

  showAlert(aid) {
    if (!this.alertSet[aid]) return '';
    const aleObj = this.alertSet[aid];
    return aleObj.owner + ' LEVEL ' + aleObj.level;
  }

  getAid({ aid, owner }) {
    if (aid) return aid;

    if (!owner) throw { err: 'SOFTERR', message: 'Expected aid or owner in alert object' };
    if (!this.ownerMap[owner]) throw { err: 'SOFTERR', message: 'Not found alert by owner: ' + owner };

    return this.ownerMap[owner];
  }


  async removeAlertsForProps(type, propsToRemoveAlerts) {
    if (!type || !propsToRemoveAlerts || !propsToRemoveAlerts.length) return;
    const ownArr = [];
    const devDocs = await this.holder.dm.get('device', { type });
    if (!devDocs) return;

    devDocs.forEach(doc => {
      for (let i = 0; i < propsToRemoveAlerts.length; i++) {
        ownArr.push(doc._id + '.' + propsToRemoveAlerts[i]);
      }
    });
    console.log('ownArr TO REMOVE: '+util.inspect(ownArr))
    // TODO - Удалить не просто - есть подписка и alertSet!! А если ничего нет - то и удалять нечего
    await this.holder.dm.dbstore.remove('alerts', { owner: { $in: ownArr } }, { multi: true });
  }

  // this.alertJournals
  setAlertJournals(id, {tags='', location=''}) {
    this.alertJournals.set(id, { tags, location});
  }

  deleteAlertJournals(id) {
    this.alertJournals.delete(id);
  }
}
module.exports = Alertengine;

function getLevelReason(oldlevel, newlevel) {
  return oldlevel < newlevel ? 'up' : 'down';
}

function getNewAid() {
  return shortid.generate();
}

function binAlert(val, rules) {
  return rules.Alert && val == rules.Alert.theval
    ? { aruleId: 'Alert', ...rules.Alert }
    : { aruleId: 'Norm', ...rules.Norm };
}

function hiLoAlert(val, rules) {
  const LoRule = rid => rules[rid] && rules[rid].use && val <= rules[rid].theval;
  const HiRule = rid => rules[rid] && rules[rid].use && val >= rules[rid].theval;

  if (LoRule('LoLo')) return { aruleId: 'LoLo', ...rules.LoLo };
  if (HiRule('HiHi')) return { aruleId: 'HiHi', ...rules.HiHi };
  if (LoRule('Lo')) return { aruleId: 'Lo', ...rules.Lo };
  if (HiRule('Hi')) return { aruleId: 'Hi', ...rules.Hi };
  return { aruleId: 'Norm', ...rules.Norm };
  /*
  if (rules.LoLo && rules.LoLo.use && val < Number(rules.LoLo.theval))
    return { aruleId: 'LoLo', ...rules.LoLo };
  if (rules.HiHi && rules.HiHi.use && val > Number(rules.HiHi.theval))
    return { aruleId: 'HiHi', ...rules.N_HiHi };
  if (rules.N_Lo && rules.N_Lo.use && val < Number(rules.N_Lo.theval)) return { aruleId: 'N_Lo', ...rules.N_Lo };
  if (rules.N_Hi && rules.N_Hi.use && val > Number(rules.N_Hi.theval)) return { aruleId: 'N_Hi', ...rules.N_Hi };
  return { aruleId: 'Norm', ...rules.Norm };
  */
}

//
function getTsStr(ts) {
  return hut.isTs(ts) ? hut.getDateTimeFor(new Date(ts), 'dtms') : '';
}

function canCloseAlert(aleObj) {
  const { toClose, tsAck, tsStop, reason } = aleObj;
  console.log('canCloseAlert =' + util.inspect(aleObj));
  switch (toClose) {
    case 'norm':
      return !!(tsStop > 0 && reason == 'norm');
    case 'ack':
      return !!(tsAck > 0);
    case 'normAndAck':
      return !!(tsAck > 0 && tsStop > 0 && reason == 'norm');
    default:
  }
}

function formNormTxt(aleData) {
  if (aleData.message) return aleData.message;
  const propTitle = aleData.propTitle;
  switch (aleData.aruleId) {
    case 'Norm':
      return propTitle + ': норма';

    default:
  }
}

function formAlertTxt(aleData, propTitle) {
  const delayStr = aleData.delay > 0 ? ' в течение ' + aleData.delay + ' сек' : '';
  if (aleData.message) return aleData.message + delayStr;

  switch (aleData.aruleId) {
    case 'Alert':
      return propTitle + ': cработка' + delayStr;

    case 'LoLo':
      return propTitle + ': нижний аварийный уровень' + delayStr;
    case 'Lo':
      return propTitle + ': нижний предупредительный уровень ' + delayStr;
    case 'Hi':
      return propTitle + ': верхний предупредительный уровень ' + delayStr;
    case 'HiHi':
      return propTitle + ': верхний аварийный уровень' + delayStr;
    case 'Norm':
      return propTitle + ': норма ' + delayStr;

    default:
  }
}
