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
const devicelogger = require('../device/devicelogger');
const typestore = require('../device/typestore');

// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

class Alertengine {
  constructor(holder) {
    this.holder = holder;

    // Правила генерации алертов, хранятся в объекте типа устройства
    this.alertsByType = {}; // {t002::new Set('state','temp'} - алерты свои для каждого свойства
    holder.typeMap.forEach((typeObj, key) => {
      this.formAlertsByTypeFromTypeItem(key);
    });

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
  start(docs) {
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
      if (this.alertsByType[type]) {
        if (this.alertsByType[type].has(item.prop)) {
          const typeObj = typestore.getTypeObj(type);
          if (typeObj.props[item.prop].ale && typeObj.alerts[item.prop]) {
            const alerts = typeObj.alerts[item.prop];
            let res;
            if (typeObj.props[item.prop].vtype == 'B') {
              res = this.boolAlert(item.value, alerts);
            } else if (typeObj.props[item.prop].vtype == 'N') {
              res = this.hiLoAlert(item.value, alerts);
            }
            // console.log('alerts RES = ' + util.inspect(res));
            if (res) {
              const owner = item.did + '.' + item.prop;
              const aleData = { owner, did: item.did, prop: item.prop, ...res };

              if (aleData.level) {
                this.tryStartAlert(aleData);
              } else {
                this.tryStopAlert(aleData);
              }
              // this.wCore.emit('alert:device:call', aleObj); // Отправляется в свой движок w_alertengine
            }
          }
        }
      }
    });
  }

  boolAlert(val, rules) {
    return rules.B_1 && val == Number(rules.B_1.theval)
      ? { aruleId: 'B_1', ...rules.B_1 }
      : { aruleId: 'B_0', ...rules.B_0 };
  }

  hiLoAlert(val, rules) {
    if (rules.N_LoLo && rules.N_LoLo.use && val < Number(rules.N_LoLo.theval))
      return { aruleId: 'N_LoLo', ...rules.N_LoLo };
    if (rules.N_HiHi && rules.N_HiHi.use && val > Number(rules.N_HiHi.theval))
      return { aruleId: 'N_HiHi', ...rules.N_HiHi };
    if (rules.N_Lo && rules.N_Lo.use && val < Number(rules.N_Lo.theval)) return { aruleId: 'N_Lo', ...rules.N_Lo };
    if (rules.N_Hi && rules.N_Hi.use && val > Number(rules.N_Hi.theval)) return { aruleId: 'N_Hi', ...rules.N_Hi };
    return { aruleId: 'N_0', ...rules.N_0 };
  }

  /**
   *
   * @param {Object} aleData - что пришло из таблицы настройки + owner +aruleId
   *      {owner, did, prop, "theval":1,"message":"Alarm!!!!","level":1,"delay":"4","toClose":"stop","needAck":1}
   */
  tryStartAlert(aleData) {
    const { owner, level } = aleData;

    // Если уже есть алерт
    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      if (this.alertSet[aid]) {
        // Уже взведен или pre, уровень совпадает
        if (this.alertSet[aid].level == level) return;

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
    const txt = formAlertTxt(aleData, dobj.getPropTitle(aleData.prop));
    const longtxt = dobj.name + ' ' + dobj.dn + '. ' + txt;

    this.alertSet[_id] = { _id, ...aleData, tsStart, txt, longtxt };
    this.ownerMap.set(owner, _id);

    // Пока без таймера!! Возможно, что start не сразу - тогда не посылать??

    this.holder.dm.insertDocs('alerts', [{ _id, owner, toClose, did, prop, txt: longtxt, level, tsStart }]);

    // также нужно записать в журналы
    devicelogger.addLog(did, { did, prop, ts: tsStart, txt, level });
    this.holder.logconnector.addLog('mainlog', { did, prop, ts: tsStart, txt: longtxt, level });

    // и генерировать событие изменения алерта
    // const changed = { id: _id, state: 'add', payload: { ts: tsStart, tsStart, level, txt: longtxt } };
    // this.holder.emit('alerts', changed);
    this.emitAlertsChanged('add', [{ id: _id, ts: tsStart, tsStart, level, txt: longtxt }]);
  }

  emitAlertsChanged(state, payload) {
    const changed = { state, payload };
    this.holder.emit('alertlog', changed);
  }

  //  Это переход в норму (level 0 => stop, reason: norm)
  tryStopAlert(aleData) {
    // console.log('tryStopAlert '+util.inspect(aleData))
    const { owner } = aleData;
    const normtxt = formNormTxt(aleData);
    // Пока без таймера - сразу стоп
    console.log('tryStopAlert owner=' + owner);
    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      console.log('tryStopAlert owner=' + owner + ' aid=' + aid + ' before STOP');
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
      console.log('CAN ');
    } else {
      console.log('CAN NOT');
      await this.holder.dm.updateDocs('alerts', [{ _id: aid, $set: { tsStop, reason } }]);
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
    if (canCloseAlert(aleData)) {
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
    this.emitAlertsChanged('remove', docs);
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
    const devDocs = await this.dm.get('device', { type });
    if (!devDocs) return;
    devDocs.forEach(doc => {
      for (let i = 0; i < propsToRemoveAlerts.length; i++) {
        ownArr.push(doc._id + '.' + propsToRemoveAlerts[i]);
      }
    });
    console.log('ownArr TO REMOVE: '+util.inspect(ownArr))
    this.holder.dm.dbstore.remove('alerts', { owner: { $in: ownArr } }, { multi: true });
  }
}
module.exports = Alertengine;

function getLevelReason(oldlevel, newlevel) {
  return oldlevel < newlevel ? 'up' : 'down';
}

function getNewAid() {
  return shortid.generate();
}

//
function canCloseAlert(aleObj) {
  const { toClose, tsAck, tsStop, reason } = aleObj;
  // console.log('canCloseAlert =' + util.inspect(aleObj));
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
    case 'B_0':
      return propTitle + ': норма';
    case 'N_0':
      return propTitle + ': значение в пределах нормы';
    default:
  }
}

function formAlertTxt(aleData, propTitle) {
  const delayStr = aleData.delay > 0 ? ' в течение ' + aleData.delay + ' сек' : '';
  if (aleData.message) return aleData.message + delayStr;

  switch (aleData.aruleId) {
    case 'B_1':
      return propTitle + ': cработка' + delayStr;
    case 'B_0':
      return propTitle + ': норма' + delayStr;
    case 'N_LoLo':
      return propTitle + ': фиксируется значение нижнего аварийного уровня' + delayStr;
    case 'N_Lo':
      return propTitle + ': фиксируется значение нижнего предупредительного уровня' + delayStr;
    case 'N_Hi':
      return propTitle + ': фиксируется значение верхнего предупредительного уровня' + delayStr;
    case 'N_HiHi':
      return propTitle + ': фиксируется значение верхнего аварийного уровня' + delayStr;
    case 'N_0':
      return propTitle + ': значение в пределах нормы' + delayStr;

    default:
  }
}
