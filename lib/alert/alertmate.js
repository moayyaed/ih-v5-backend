/**
 * alertmate.js
 *
 *  Таблица alerts содержит записи:
 *   {_id:sceneId,
 *     name:'Текст для показа в дереве и списках', parent:ROOOTPARENT(def),
 *     state:(0-draft, 1-work, 2-blocked),
 *
 *    // Дальше поля служебные, устанавливаются программой
 *    reqts: // Время создания файла req
 *    multi:1/0,
 *    devs:'Список формальных параметров через ,',
 *    triggers:'Список триггеров через ,',
 *    realdevs:'Список реальных устройств через ,',
 *    def: - вложенный объект - соответствие формальный - фактический параметр.
 *
 *       def:{lamp:'LAMP1',..} для обычного сценария. Используется при вызове сценария
 *       def:{lamp:{cl:'SensorD', note:'Свет'}..} для мульти сценария. Используется для таблички параметров и при вызове сценария
 *
 *    err:1/0,
 *    errstr:'',
 *    unset:1/0 - файл сценария не найден
 *   }
 */

// const util = require('util');
// const fs = require('fs');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');

class Alertmate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  start() {

  

  }


  
}

module.exports = Alertmate;