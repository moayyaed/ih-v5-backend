/**
 * scenemate.js
 * Работает с файлами скриптов и таблицами данных
 *  - Слушает события изменения таблиц scene, scenecall
 *  - генерирует файлы в req???
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

const util = require('util');

const sceneutils = require('./sceneutils');

class Scenemate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    // Событие сохранения кода
    // unreq уже сделан
    this.dm.on('saved:script', sceneId => {
      console.log('saved:script ' + sceneId);
      // this.engine.restart(sceneId);
    });

    this.dm.on('inserted:scene', docs => {
      docs.forEach(doc => this.engine.addScene(doc));
    });

    this.dm.on('updated:scene', docs => {
      console.log('updated:scene ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc.$set) {
          const upDoc = Object.assign({}, doc, doc.$set);
          delete upDoc.$set;
          this.engine.updateScene(upDoc);
        }
      });
    });

    this.dm.on('removed:scene', docs => {
      docs.forEach(doc => this.engine.removeScene(doc._id));
    });

    // scenecall
    this.dm.on('inserted:scenecall', async docs =>  {
      const oneScene = await this.getSceneStructForCalls(docs)
      // console.log('inserted:scenecall oneScene='+util.inspect(oneScene));
      docs.forEach(call => this.engine.addSceneCall( oneScene, call));
    });

    this.dm.on('updated:scenecall', async docs => {
      // console.log('updated:scenecall docs='+util.inspect(docs));
      // Для экземпляра нужно тело мультисценария (запись в scene)
      const oneScene = await this.getSceneStructForCalls(docs);
      for (const doc of docs) {
        // Удалить экземпляр и заново добавить
          this.engine.removeSceneCall(doc._id);
          // считать заново из таблицы  и заново добавить
          const call = await this.dm.findRecordById('scenecall', doc._id);
          this.engine.addSceneCall( oneScene, call);
      }
    });
  
  
    // Удаление экземпляра
    this.dm.on('removed:scenecall', docs => {
      // console.log('removed:scenecall docs='+util.inspect(docs));
      // docs=[ { _id: 'call_004' } ]
      docs.forEach(doc => {
        this.engine.removeSceneCall(doc._id);
      });
      /*
      docs.forEach(doc => {
        const sceneId = this.engine.findSceneIdForCallId(doc._id);
      
        if (sceneId) {
          const id = sceneutils.getOneInstanceId(sceneId, doc._id);
          this.engine.removeScene(id);
        }
      });
      */
    });
  }

 


  async getSceneStructForCalls(docs) {
      // За один раз редактируются вызовы только одного сценария
      // Получить сценарий из таблицы и формировать экземпляры
      if (!docs || !docs.length) return;
      const sceneId = docs[0].sid;
      if (!sceneId) {
        console.log('WARN: scenecall Not found sid in doc '+util.inspect(docs[0]));
        return;
      }
      const sceneDoc = (await this.dm.findRecordById('scene', sceneId));
      if (!sceneDoc) {
        console.log('WARN: scenecall doc='+util.inspect(docs[0])+'. Not found record with id='+sceneId+' in scenes!');
        return;
      }
     
      return sceneutils.createSceneStruct(sceneDoc);
    }

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
}

module.exports = Scenemate;
