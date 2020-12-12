/**
 * scenemate.js
 * Работает с файлами скриптов и таблицами данных
 *  - Слушает события изменения таблиц scene, multiscene
 *  - Следит за папкой scripts, генерирует файлы в req
 *
 *   Для каждого сценария
 *  - Папка script содержит файл, который редактируется
 *  - Папка req содержит файл, который будут запускаться через require.
 *     Он генерируется из скрипта - делается обертка, подставляются параметры
 *
 *  Таблица scenes содержит записи о сценариях:
 *   {_id:sceneId,
 *     name:'Текст для показа в дереве и списках',
 *     parent:ROOOTPARENT(def),
 *     state:(0-draft, 1-work, 2-blocked),
 *
 *    // Дальше поля служебные, устанавливаются программой
 *    reqts: // Время создания файла req
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
 *    unset:1 - файл сценария не найден
 *   }
 */

// const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const sceneutils = require('./sceneutils');

class Scenemate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {

    this.dm.on('inserted:scene', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onInsertScene(doc));
    });

    this.dm.on('updated:scene', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onUpdateScene(doc));
    });

    this.dm.on('removed:scene', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onRemoveScene(doc));
    });

    /*
    this.dm.on('inserted:scenecall', docs => {
      docs.forEach(doc => this.engine.onInsertSceneCall(doc));
    });

    this.dm.on('updated:scenecall', docs => {
      console.log('WARN: scenemate updated:scenecall ')
      docs.forEach(doc => this.engine.onUpdateSceneCall(doc)); 
    });

    this.dm.on('removed:scenecall', docs => {
      //  Если у сценария есть ext свойства - нужно удалить в устройстве??
      docs.forEach(doc => this.engine.onRemoveSceneCall(doc));
    });
    */

  }

  /*
  async processWatchResult(eventType, filename) {
    if (!filename) {
      console.log(`fs.watch: event type is: ${eventType}, filename not provided!`);
      return;
    }
    if (!filename.endsWith('.js')) return;

    const filepath = appconfig.getScriptPath() + '/' + filename;
    const sceneId = filename.substr(0, filename.length - 3);

    // eventType :'rename' - Скрипт добавлен или удален
    // eventType :'change' - Скрипт изменен
    try {
      if (fs.existsSync(filepath)) {
        // Проверить существование в любом случае
        this.upsertScene(sceneId);
      } else {
        // Скрипт не существует - редактировать запись в таблице, если она есть!!
        this.updateWhenMissingScript(sceneId);
      }
    } catch (e) {
      const mess = `Watch :${filepath}, event type: ${eventType}, filename: ${filename}`;
      console.log('Error updating scene! ' + mess);
    }
  }
  */

  async upsertScene(sceneId) {
    const sceneDocs = await this.dm.dbstore.get('scenes', { _id: sceneId });
    if (!sceneDocs.length) {
      // Добавить новый
      const doc = await sceneutils.createNewSceneFromFile(sceneId);
      if (doc) await this.dm.insertDocs('scene', [doc]);
    } else {
      // Редактировать

      const doc = await sceneutils.updateScene(sceneId, sceneDocs[0]);
      if (doc) await this.dm.updateDocs('scene', [doc]);
    }
  }

  async updateWhenMissingScript(sceneId) {
    const doc = sceneutils.updateWhenMissingScriptFile(sceneId); // Сформировать запись с пустыми полями. Удалить req
    const sceneDocs = await this.dm.dbstore.get('scenes', { _id: sceneId });
    if (sceneDocs.length) {
      await this.dm.updateDocs('scene', [doc]);
    } // записи нет - ничего не делать
  }

  // Загрузить данные из таблиц scenes + scenecall + scenecurrent ?
  // Вернуть массив объектов для построения sceneSet
  /*
  async load() {
    const docs = await this.dm.dbstore.get('scenes');
    const sceneDocs = docs.filter(doc => !doc.folder);

    const sceneCalls = await this.dm.dbstore.get('scenecalls');
    const callObj = {};
    sceneCalls.forEach(item => {
      const sid = item.sid;
      if (!callObj[sid]) callObj[sid] = [];
      callObj[sid].push(item);
    });

    return sceneDocs.map(doc => {
      const sid = doc._id;
      const resObj = hut.clone(doc);
      if (callObj[sid]) {
        resObj.calls = hut.clone(callObj[sid]);
      }
      return resObj;
    });
  }
  */
}

module.exports = Scenemate;
