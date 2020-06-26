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

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

class Alertmate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;

    engine.holder.on('start:alert', (aleObj) =>{
      // Проверить, возможно нужно остановить существующий алерт
      // 
      // Создать новый алерт
      const  newdoc = engine.createAlert(aleOb);

      // Формировать запись в БД (добавление, изменение)
      dm.insertDocs('alerts', [newdoc]);
      // dm.updateDocs(table, docs, beforeUpdate);

      // Отправить инф-ю подписчикам алертов
      engine.holder.emit('changed:alert', {});
    });

    engine.holder.on('stop:alert', (aleOb) =>{
      // Остановить существующий алерт
      // Проверить, возможно можно закрыть close = stop&ack
      const  docUpdate = engine.stopAlert(aleOb);

      // Формировать запись в БД (изменение)
      // dm.updateDocs(table, docs, beforeUpdate);

      // Отправить инф-ю подписчикам алертов
      engine.holder.emit('changed:alert', {});
    });

    engine.holder.on('ack:alert', () =>{ 
      // Фиксировать квитирование
      // Проверить, возможно можно закрыть close = stop&ack
      const  docUpdate = engine.ackAlert(aleOb);
     
      // Формировать запись в БД (изменение)
      // dm.updateDocs(table, docs, beforeUpdate);

      // Отправить инф-ю подписчикам алертов
      engine.holder.emit('changed:alert', {});
    });

  }

  async start() {
    

    return this.load();
  }

  async load() {
    
    // Загрузить алерты при старте системы
    return [];
  }
}

module.exports = Alertmate;