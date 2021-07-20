/**
 * scenemate.js
 * Работает с файлами скриптов и таблицами данных
 *  - Слушает события изменения таблиц scene, scenecall
 *  - генерирует файлы в req
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
      docs.forEach(doc => this.engine.addScene(doc)); // может быть multi, но для нового пока нет scenecall
    });

    this.dm.on('updated:scene', docs => {
      console.log('updated:scene ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc.$set) {
          const upDoc = Object.assign({}, doc, doc.$set);
          delete upDoc.$set;
          // Если мультисценарий - нужно scenecall
          this.engine.updateScene(upDoc);
        }
      });
    });

    this.dm.on('removed:scene', docs => {
      // Если мультисценарий - нужно scenecall
      docs.forEach(doc => this.engine.removeScene(doc));
    });
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
