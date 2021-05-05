/**
 * alertengine.js
 *  Генерация алертов
 * 
 *  _id - уникальный номер 
   txt - текст, описывающий событие, готовая константа
   level - уровень 
   owner - владелец (кто сгенерировал + идентификатор внутри): d002.value, scene_scene1_a1 ??

   tsStart - возникновение
   tsStop - завершение
   reason - как было завершено: norm, up, down
   Как только происходит stop алерта, здесь он удаляется

   Дальнейшая работа - квитирование и закрытие (close) алерта выполняется в main потоке
   Цель данного блока - генерация алерта нужного уровня/ stop при изменении уровня или переходе в norm

   TODO Алгоритм перехода в состояния start/stop c учетом временной задержки
   Состояние алерта до сработки таймера - pre
   
 */

const util = require('util');
const shortid = require('shortid');

// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

class Alertengine {
  constructor(wCore) {
    this.wCore = wCore;

    this.alertSet = {}; // Алерты по uuid - уникальные объекты
    // Если delay>0 - добавляется в состоянии pre, иначе сразу started
    // Пока pre - могут быть просто удалены без всяких записей

    this.ownerMap = new Map(); // Алерты по владельцам  key=did.prop: uuid - текущий всегда д б один
    // Его состояние (в alertSet) может быть: pre - взведен таймер, start - активный

    // Запустить механизм таймеров для интервальных таймеров
    // const tm = new Timerman(0.1);
    // tm.on('ready', this.onTimerReady);
  }

  /**
   * TODO Загрузка активных алертов
   * @param {Array of objects} docs
   */
  start(docs) {
    // Построить alertSet и ownerMap

    // Сообщение от своего движка - w_deviceengine по событию onChange
    this.wCore.on('alert:device:call', aleData => {
      // {did, prop, "theval":1,"message":"Alarm!!!!","level":1,"delay":"4","toClose":"stop","needAck":1}
      const owner = aleData.did + '.' + aleData.prop;
      if (aleData.level) {
        this.tryStartAlert({ owner, ...aleData });
      } else {
        this.tryStopAlert({ owner, ...aleData });
      }
    });
  }

  sendStatus(aleObj, status) {
    this.wCore.postMessage('alert:device:status', { ...aleObj, status });
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
        if (this.alertSet[aid].level == level) {
          console.log('EQ LEVEL - SKIP');
          return;
        }

        // Уровни отличаются
        //  - этот закрыть из за изменения уровня сообщения от данного владельца
        // TODO - это нужно сделать только если started (не pre)  Иначе ??
        this.stopAlert(aid, getLevelReason(this.alertSet[aid].level, level));
      }
    }
    return this.addAlert(owner, aleData);
  }

  /**
   *
   * @param {*} owner
   * @param {Object} aleData -
   */
  addAlert(owner, aleData) {
    const _id = getNewAid();

    // Создать текст алерта или взять готовый, если есть message, и записать в txt
    const txt = formAlertTxt(aleData);
    this.alertSet[_id] = { _id, ...aleData, tsStart: Date.now(), txt, owner };

    this.ownerMap.set(owner, _id);
    // Пока без таймера!! Возможно, что start не сразу - тогда не посылать??
    this.sendStatus(this.alertSet[_id], 'start');
  }

  //  Это переход в норму (level 0 => stop, reason: norm)
  tryStopAlert(aleData) {
    const { owner } = aleData;
    const normtxt = formNormTxt(aleData);
    // Пока без таймера - сразу стоп
    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      this.stopAlert(aid, 'norm', normtxt);
      this.ownerMap.set(owner, 0);
    }
  }

  // stop может быть по разным причинам Отправить, у себя сразу удалить
  stopAlert(aid, reason, normtxt) {
    if (!this.alertSet[aid]) {
      console.log('Not FOUND alert ' + aid);
      return;
    }

    this.sendStatus({ ...this.alertSet[aid], reason, tsStop: Date.now(), normtxt }, 'stop');
    delete this.alertSet[aid];
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
}

function getLevelReason(oldlevel, newlevel) {
  return oldlevel < newlevel ? 'up' : 'down';
}

function getNewAid() {
  return shortid.generate();
}

module.exports = Alertengine;

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

function formAlertTxt(aleData) {
  const delayStr = aleData.delay > 0 ? ' в течение ' + aleData.delay + ' сек' : '';
  const propTitle = aleData.propTitle;
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
