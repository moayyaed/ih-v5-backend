/**
 * scenemate.js
 *
 *  - Слушает события изменения таблиц scene, scenecall
 *    При любом изменении скрипта запись в scene перезаписывается
 *     => событие изменения скрипта также отслеживается
 */

const util = require('util');

const sceneutils = require('./sceneutils');

class Scenemate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    this.dm.on('inserted:scene', docs => {
      docs.forEach(doc => this.engine.addScene(doc));
    });

    this.dm.on('updated:scene', async docs => {
      // Если есть не мультисценарии - заново создать списки для мобильного
      let rebuildMobile;
      for (const doc of docs) {
        const sceneId = doc._id;
        if (doc.$set) {
          const upDoc = Object.assign({}, doc, doc.$set);
          delete upDoc.$set;

          if (!upDoc.multi) rebuildMobile = 1;
          const calls = upDoc.multi ? await this.dm.dbstore.get('scenecalls', { sid: sceneId }) : '';
          this.engine.updateScene(upDoc, calls);
        }
      }
      if (rebuildMobile)  this.dm.datagetter.rebuidSceneMobileLists(this.dm);
    });

    this.dm.on('removed:scene', docs => {
      docs.forEach(doc => this.engine.removeScene(doc._id));
      
      this.dm.datagetter.rebuidSceneMobileLists(this.dm);
    });

    this.dm.on('inserted:scenecall', async docs => {
      const oneScene = await this.getSceneStructForCalls(docs);
      docs.forEach(call => this.engine.addSceneCall(oneScene, call));
    });

    this.dm.on('updated:scenecall', async docs => {
      // Для экземпляра нужно тело мультисценария (запись в scene)
      const oneScene = await this.getSceneStructForCalls(docs);
      for (const doc of docs) {
        this.engine.removeSceneCall(doc._id);
        const call = await this.dm.findRecordById('scenecall', doc._id);
        this.engine.addSceneCall(oneScene, call);
      }
    });

    // Удаление экземпляра
    this.dm.on('removed:scenecall', docs => {
      // docs=[ { _id: 'call_004' } ]
      docs.forEach(doc => {
        this.engine.removeSceneCall(doc._id);
      });
    });
  }

  async getSceneStructForCalls(docs) {
    // За один раз редактируются вызовы только одного сценария
    // Получить сценарий из таблицы и формировать экземпляры
    if (!docs || !docs.length) return;
    const sceneId = docs[0].sid;
    if (!sceneId) {
      console.log('WARN: scenecall Not found sid in doc ' + util.inspect(docs[0]));
      return;
    }
    const sceneDoc = await this.dm.findRecordById('scene', sceneId);
    if (!sceneDoc) {
      console.log(
        'WARN: scenecall doc=' + util.inspect(docs[0]) + '. Not found record with id=' + sceneId + ' in scenes!'
      );
      return;
    }

    return sceneutils.createSceneStruct(sceneDoc);
  }
}

module.exports = Scenemate;
