/**
 * alertengine.js
 * 
 *  - Генерация алертов
 *  - Отслеживание статуса алертов
 *  - Фиксация квитирования
 *  - Закрытие по правилу toClose
 * 
 *  Пишет в таблицу alerts - хранятся только незакрытые алерты (активные | ждущие квитирования)
 * 
 *  Пишет в журналы: devicelog, mainlog в хронологическом порядке (отдельные записи для старт/стоп/квитирование)
 * 
 *  Генерирует событие состояния алертов (добавление, изменение, удаление) по подписке: emit('alertlog', changed);
 * 
 *  Правила генерации алертов хранятся в объекте типа typeObj.alerts[prop]
 *  !Для свойства должен быть установлен флаг ale=1
 *  Идентификаторы типа алерта - list HiLoList: 'Norm' || 'Alert' || 'LoLo',...
 * 
 *  Структура правила typeObj.alerts[prop]:
 *   для дискретных {id, theval, message, level, toClose, info},  id = 'Alert' || 'Norm'
 *   для аналоговых {id, theval, message, level, toClose, info, use}  id = 'Norm' || 'LoLo'|| 'Lo' || 'Hi' || 'HiHi'
 * 
 *  Запись в alerts:
 *    _id - уникальный номер 
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

const hut = require('../utils/hut');

const typestore = require('../device/typestore');
const deviceutil = require('../device/deviceutil');
const alertutil = require('./alertutil');

// const Timerman = require('../utils/timermanager');

class Alertengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;

    // Список для генерации алертов - тип+свойства, алерты свои для каждого свойства
    this.alertsByType = {}; // {t002: new Set('state','temp'}
    // Правила генерации алертов хранятся в объекте типа typeObj.alerts[prop]
    // Для свойства должен быть установлен флаг ale=1
    holder.typeMap.forEach((typeObj, key) => {
      this.formAlertsByTypeFromTypeItem(key);
    });

    // Список журналов тревог с фильтрами, чтобы определить, в какие журналы отправлять алерт по подписке
    this.alertJournals = new Map(); // <key= id журнала>: { tags, location}

    // Экземпляры активных или ждущих (pending) алертов
    this.alertSet = {}; //
    // Если stop - отсюда сразу удаляется
    // При квитировании достать из таблицы alerts
    // TODO Если delay>0 - добавляется в состоянии pre, иначе сразу started
    // TODO Пока pre - могут быть просто удалены без всяких записей

    // Список алертов по владельцам, текущий всегда д б один
    this.ownerMap = new Map(); // <key=did.prop>: uuid - id текущего алерта
    // Его состояние (в alertSet) может быть: pre - взведен таймер, start - активный
  }

  /**
   * Загрузка активных алертов и списка оперативных журналов на старте
   *
   * @param {Array of objects} docs - активные алерты из таблицы 'alerts'
   *         alertsevice проверил, что устройство существует
   * @param {Array of objects} ajDocs - Список журналов из 'alertjournal'
   *        для определения, в какие журналы должен попасть алерт при отработке подписки
   */
  start(docs, ajDocs) {
    // Построить alertSet и ownerMap
    docs.forEach(doc => {
      this.alertSet[doc._id] = doc;
      this.ownerMap.set(doc.owner, doc._id);
    });

    // Подготовить список журналов
    ajDocs.forEach(doc => {
      this.alertJournals.set(doc._id, { tags: doc.tags || '', location: doc.location || '' });
    });

    // TODO Запустить механизм таймеров для pre
    // const tm = new Timerman(1);
    // tm.on('ready', this.onTimerReady);

    // При изменении значений устройств - генерировать алерты
    this.holder.on('changed:device:data', data => {
      this.runAlertsByType(data);
    });

    // При квитировании - Таблица alerts уже отредактирована модулем acknowledgment
    this.holder.on('ack:alert', data => {
      this.ackAlert(data);
    });
    this.holder.on('deack:alert', data => {
      this.deackAlert(data);
    });
  }

  /**
   * Формирование списка  this.alertsByType для type
   * Ориентируемся на флаг ale для свойства
   * Если пока нет type.alerts - при генерации пропустится
   *
   * @param {String} type
   */
  formAlertsByTypeFromTypeItem(type, propArr) {
    const typeObj = typestore.getTypeObj(type);
    if (!typeObj) return;
    // if (!typeObj.alerts) return; // Если есть флаг ale, но таблица дефолтная - она не рабочая??

    if (!this.alertsByType[type]) this.alertsByType[type] = new Set();
    if (!propArr) propArr = Object.keys(typeObj.props);

    propArr.forEach(prop => {
      if (typeObj.props[prop].ale) {
        this.alertsByType[type].add(prop);
      } else {
        this.alertsByType[type].delete(prop);
      }
    });

    // console.log(' formAlertsByTypeFromTypeItem typeObj=' + util.inspect(typeObj, null, 4));
    /*
    Object.keys(typeObj.alerts).forEach(prop => {
      if (typeObj.props[prop].ale) {
        this.alertsByType[type].add(prop);
      } else {
        this.alertsByType[type].delete(prop);
      }
    });
    */
  }

  /**
   * При изменении значений устройств - запускать или останавливать алерты
   * @param {Object} changed - массив изменений [{did, prop, value}, ...]
   */
  runAlertsByType(changed) {
    changed.forEach(item => {
      const type = this.holder.devSet[item.did].type;
      if (this.alertsByType[type] && this.alertsByType[type].has(item.prop)) {
        const typeObj = typestore.getTypeObj(type);
        // Если установлен флаг и добавлены правила - тогда формируем алерты
        if (typeObj.props[item.prop].ale && typeObj.alerts[item.prop]) {
          const vtype = typeObj.props[item.prop].vtype;
          this.processOneDevicePropValue(item, vtype, typeObj.alerts[item.prop]);
          /*
          const { did, prop, value } = item;
          const alerts = typeObj.alerts[prop];
          const vtype = typeObj.props[prop].vtype;
          const res = vtype == 'N' ? alertutil.hiLoAlert(value, alerts) : alertutil.binAlert(value, alerts);
          // res = { aruleId: 'Alert', ...rules.Alert - из правила алерта }  rule={}

          const owner = did + '.' + prop;
          const aleData = { owner, did, prop, ...res };
          if (aleData.level) {
            this.tryStartAlert(aleData);

          } else if (this.ownerMap.has(owner) && this.ownerMap.get(owner)) {
            // Если сейчас level=0 но алерт взведен
            this.tryStopAlert(aleData);
          }
          */
        }
      }
    });
  }

  processOneDevicePropValue({ did, prop, value }, vtype, alertRules) {
    const res = vtype == 'N' ? alertutil.hiLoAlert(value, alertRules) : alertutil.binAlert(value, alertRules);
    // res = { aruleId: 'Alert', ...rules.Alert - из правила алерта }  rule={}

    const owner = did + '.' + prop;
    const aleData = { owner, did, prop, ...res };
    if (aleData.level) {
      this.tryStartAlert(aleData);
    } else if (this.ownerMap.has(owner) && this.ownerMap.get(owner)) {
      // Если сейчас level=0 но алерт взведен
      this.tryStopAlert(aleData);
    }
  }

  /**
   * Попытка создать новый алерт
   * @param {Object} aleData - правило алерта + owner
   * {aruleId:'LoLo', owner, did, prop, "theval":1,"message":"Alarm!!!!","level":1,"delay":"4","toClose":"normAndAck"}
   */
  tryStartAlert(aleData) {
    const { aruleId, did, prop, owner, level } = aleData;

    // Если уже есть алерт
    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      if (this.alertSet[aid]) {
        // Уже взведен или pre, aruleId совпадает
        if (this.alertSet[aid].aruleId == aruleId) return;

        // aruleId отличаются - этот закрыть из за изменения уровня сообщения от данного владельца
        // TODO - это нужно сделать только если started (не pre)  Иначе ??
        this.stopAlert(this.alertSet[aid], getLevelReason(this.alertSet[aid].level, level));
      }
    }

    const dobj = this.holder.devSet[did];
    if (!dobj) {
      console.log('ERROR: tryStartAlert. Not found device ' + did);
      return;
    }

    aleData.location = deviceutil.getLocation(did, this.holder);
    aleData.tags = dobj.tags;
    aleData.propTitle = dobj.getPropTitle(prop);
    aleData.devTitle = dobj.name + ' ' + dobj.dn + '. ';
    aleData.txt = alertutil.formAlertTxt(aleData, aleData.propTitle);
    return this.startAlert(aleData);
  }

  /**
   * Создать новый алерт
   *
   * @param {Object} aleData - информация для генерации алерта
   */
  startAlert(aleData) {
    const _id = getNewAid();
    const { owner, level, devTitle, txt } = aleData;

    const tsStart = Date.now();
    this.alertSet[_id] = { ...aleData, _id, tsStart };
    this.ownerMap.set(owner, _id);

    // Пока без таймера!! Возможно, что start не сразу - тогда не посылать??
    this.holder.dm.insertDocs('alerts', [this.alertSet[_id]]);

    // записать в журналы
    alertutil.addLogs(this.alertSet[_id], 'start', tsStart);

    // генерировать событие изменения алерта
    const longtxt = devTitle + txt;

    this.emitAlertsChanged('add', this.chooseJournals(aleData), [
      { id: _id, ts: tsStart, tsStart, level, txt: longtxt, state: 1 }
    ]);
  }

  getTagsAndLocationForOwner(owner) {
    if (!owner) return {};
    const [did, prop] = owner.split('.');
    const dobj = this.holder.devSet[did];
    if (!dobj) {
      console.log('ERROR: getTagsAndLocationForOwner. Not found device ' + did);
      return {};
    }
    return { location: deviceutil.getLocation(did, this.holder), tags: dobj.tags };
  }

  /**
   * Выбрать журналы, куда нужно передавать алерты по подписке
   * @param {Object} - { tags, location }
   * @return {Array of String}  - массив id оперативных журналов
   */
  chooseJournals({ owner, tags, location }) {
    if (tags == undefined && location == undefined) {
      const res = this.getTagsAndLocationForOwner(owner);
      tags = res.tags;
      location = res.location;
    }

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

  emitAlertsChanged(op, ajarr, payload) {
    // Подставить в payload строки для ts
    payload.forEach(item => {
      if (item.tsStart != undefined) item.tsStartStr = getTsStr(item.tsStart);
      if (item.tsStop != undefined) item.tsStopStr = getTsStr(item.tsStop);
      if (item.tsAck != undefined) item.tsAckStr = getTsStr(item.tsAck);
    });

    this.holder.emit('alertlog', { op, ajarr, payload });
  }

  /**
   * Попытка остановить алерт при переходе в норму (level 0 => stop, reason: norm)
   *  если он еще активен (пока без учета задержки)
   *
   * @param {Object} aleData - правило алерта + owner
   * {aruleId:'LoLo', owner, did, prop, "theval":1,"message":"Alarm!!!!","level":1,"delay":"4","toClose":"normAndAck"}
   */
  tryStopAlert(aleData) {
    console.log('tryStopAlert ' + util.inspect(aleData));
    const { owner } = aleData;
    // Пока без таймера - сразу стоп

    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      if (this.alertSet[aid]) {
        const aleObj = this.alertSet[aid];
        const normtxt = alertutil.formNormTxt(aleData, aleObj.propTitle);
        this.stopAlert(aid, 'norm', normtxt);
      }
      this.ownerMap.set(owner, 0);
    }
  }

  /**
   * Перевести алерт в состояние неактивный (стоп)
   * Записать, попробовать закрыть
   * в this.alertSet сразу удалить, ибо не активный
   *
   * @param {String} aid - id экземпляра алерта
   * @param {String} reason - причина остановки "norm" | "up" | "down"
   * @param {String} normtxt - При нормализации - текст сообщения в журналы
   */
  async stopAlert(aid, reason, normtxt) {
    const aleObj = this.alertSet[aid];
    const tsStop = Date.now();

    aleObj.reason = reason;
    aleObj.tsStop = tsStop;

    if (canCloseAlert(aleObj)) {
      await this.closeAlerts(aleObj, reason == 'norm');
    } else {
      await this.holder.dm.updateDocs('alerts', [{ _id: aid, $set: { tsStop, reason } }]);
      this.emitAlertsChanged('update', this.chooseJournals(aleObj), [
        { id: aid, state: 0, tsStopStr: getTsStr(tsStop) }
      ]);
    }

    if (normtxt) {
      aleObj.txt = normtxt;
      alertutil.addLogs(aleObj, 'stop', tsStop);
    }
    delete this.alertSet[aid];
  }

  // Пришли данные из таблицы alerts с квитированием
  async ackAlert(aleData) {
    const { _id, tsAck, userId } = aleData;
    const username = this.dm.datagetter.getUserTitle(userId);

    // Может и не быть - если уже stopped
    if (this.alertSet[_id]) {
      this.alertSet[_id].tsAck = tsAck;
      this.alertSet[_id].userId = userId;
    }

    // Нужно фиксировать эту операцию в журналах
    alertutil.addLogs({ ...aleData, username }, 'ack', tsAck);

    // Затем попробовать закрыть алерт
    const canClose = canCloseAlert(aleData);
    if (canClose) {
      await this.closeAlerts(aleData);
    } else {
      this.emitAlertsChanged('update', this.chooseJournals(aleData), [{ id: _id, tsAck, userId }]);
    }
  }

  async deackAlert(aleData) {
    const { _id } = aleData;

    // Может и не быть - если уже stopped
    if (this.alertSet[_id]) {
      this.alertSet[_id].tsAck = 0;
      this.alertSet[_id].userId = '';
    }

    // Нужно фиксировать эту операцию в журналах
    alertutil.addLogs(aleData, 'deack', Date.now());

    this.emitAlertsChanged('update', this.chooseJournals(aleData), [{ id: _id, tsAck: 0, userId: '' }]);
  }

  async closeAlerts(aleObj, all) {
    const { _id, owner } = aleObj;
    const docs = [aleObj];

    // И все для этого owner, если reason == 'norm' и не требуется квитирование??
    if (all) {
      const others = await this.holder.dm.get('alerts', { owner });
      if (others) {
        others.forEach(doc => {
          if (doc._id != _id) docs.push(doc);
        });
      }
    }

    await this.holder.dm.removeDocs('alerts', docs);
    this.emitAlertsChanged(
      'delete',
      this.chooseJournals(aleObj),
      docs.map(item => ({ id: item._id }))
    );
  }

  getAid({ aid, owner }) {
    if (aid) return aid;

    if (!owner) throw { err: 'SOFTERR', message: 'Expected aid or owner in alert object' };
    if (!this.ownerMap[owner]) throw { err: 'SOFTERR', message: 'Not found alert by owner: ' + owner };

    return this.ownerMap[owner];
  }

  // Функции при редактировании типов (добавление/удаление флага ale?? для свойств)
  // Тело алерта должно придти из типа

  async removeAlertsForProps(type, propsToRemoveAlerts) {
    if (!type || !propsToRemoveAlerts || !propsToRemoveAlerts.length) return;

    const devDocs = await this.holder.dm.get('device', { type });
    if (!devDocs) return;

    devDocs.forEach(doc => {
      for (let i = 0; i < propsToRemoveAlerts.length; i++) {
        const owner = doc._id + '.' + propsToRemoveAlerts[i];
        if (this.ownerMap.has(owner)) {
          const aid = this.ownerMap.has(owner);
          delete this.alertSet[aid];
          this.ownerMap.set(owner, 0);
        }

        this.closeAlerts({owner}, true);
      }
    });

    // console.log('ownArr TO REMOVE: ' + util.inspect(ownArr));
    // TODO - Удалить не просто - есть подписка и alertSet!! А если ничего нет - то и удалять нечего
    // await this.holder.dm.dbstore.remove('alerts', { owner: { $in: ownArr } }, { multi: true });
  }

  // Функции при редактировании оперативных журналов
  setAlertJournals(id, { tags = '', location = '' }) {
    this.alertJournals.set(id, { tags, location });
  }

  deleteAlertJournals(id) {
    this.alertJournals.delete(id);
  }
}
module.exports = Alertengine;

function getLevelReason(oldlevel, newlevel) {
  if (newlevel == 0) return 'norm';
  return oldlevel < newlevel ? 'up' : 'down';
}

function getNewAid() {
  return shortid.generate();
}

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
