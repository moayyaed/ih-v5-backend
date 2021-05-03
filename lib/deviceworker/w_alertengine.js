/**
 * alertengine.js
 * 
 * 
 *  _id - уникальный номер 
   txt - текст, описывающий событие, готовая константа
   level - уровень (info, warn, avar, ...)
   owner - владелец (кто сгенерировал + идентификатор внутри): dev_d002_value, scene_scene1_a1
   ???? Target - получатель информации о событии ?? (Первый, кто будет проинформирован по каналам - emal, telegram, ...)
   param:{ объект, содержит условия, по которым можно группировать, подписываться???} 
   
   - условие закрытия: stop&ack, ack, stop - где настраиваются?

   tsStart - возникновение
   tsAck - подтверждение
   userId - кто подтвердил
   tsStop - завершение
   reason - как было завершено ?
         [stopped - выполнен stopAlert, suppressed - завершено без снятия условия, uplevel, dnlevel ]
   tsClose - закрытие 
 */

const util = require('util');
const shortid = require('shortid');



// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

class Alertengine {
  constructor(wCore) {
    this.wCore = wCore;

    this.alertSet = {}; // Алерты по uuid
    this.ownerMap = new Map(); // Алерты по владельцам  key=did_prop: uuid

    // Запустить механизм таймеров для интервальных таймеров 
    // const tm = new Timerman(0.1);
    // tm.on('ready', this.onTimerReady);
  }


  
  /**
   * Загрузка активных алертов
   * @param {Array of objects} docs
   */
  start(docs) {
    // Построить alertSet
  }

  /**
   *
   * @param {Object} aleObj = {owner:'LAMP1_state', txt, level, filter:{}}
   */
  createAlert(aleObj) {
    const { owner,  level } = aleObj;
    console.log('createAlert '+util.inspect(aleObj));
    if (this.ownerMap.has(owner)) {
      const aid = this.ownerMap.get(owner);
      if (this.alertSet[aid] && !this.alertSet[aid].stop) {
        if (this.alertSet[aid].level == level) {
          return;
        }

        // Если уровни отличаются - этот остановить из за изменения уровня сообщения от данного владельца
        this.stopAlert({aid, reason: getLevelReason(this.alertSet[aid].level, level)});
      }
    }
    return this.addAlert(aleObj);
  }
  
  addAlert(aleObj) {
    let { owner, txt, level, filter } = aleObj;
    if (!owner || !txt) return;
    level = level || 1;

    const _id = getNewAid();
    this.alertSet[_id] = {_id, owner, txt, level, filter};
    this.ownerMap.set(owner, _id);
    return {}; // aleDoc для записи в БД
  }



  stopAlert(aleObj) {
    if (!aleObj.aid) {
      // Найти по owner
    }
    if (!this.alertSet[aleObj.aid]) {
      console.log('Not FOUND alert '+aleObj.aid);
      return;
    }
    const doc = this.alertSet[aleObj.aid];

    doc.$set = {};
    this.alertSet[aleObj.aid].stop = true;
    this.alertSet[aleObj.aid].reason = aleObj.reason;
    this.alertSet[aleObj.aid].tsStop = Date.now();
    this.alertSet[aleObj.aid].close = true; // Проверить, когда можно закрыть - если ack&stop, то д б ack

    // Эти же изменения записать в БД!!
    // Если close - нужно удалить
    return doc;
  }

  ackAlert(aleObj) {
    // 

  }

  closeAlert(aleObj) {
    // Если close - записать что close и удалить из this.alertSet - здесь только текущие!!
  }

  getAid({aid, owner}) {
    if (aid) return aid;

    if (!owner) throw {err:'SOFTERR', message:'Expected aid or owner in alert object'};
    if (!this.ownerMap[owner]) throw {err:'SOFTERR', message:'Not found alert by owner: '+owner};
   
    return this.ownerMap[owner];
  }
}


function getLevelReason(oldlevel, newlevel) {
  return oldlevel > newlevel ? 'uplevel' : 'downlevel';
}

function getNewAid() {
  return shortid.generate();
}

module.exports = Alertengine;


