/**
 *
 */
const util = require('util');

const scenefs = require('./scenefs');

class Scenemate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
    dm.on('inserted:scene', docs => {});

    dm.on('updated:scene', docs => {});
  }

  async loadSceneSet() {
    await this.reviseSceneTable();
    return this.createSceneSet();
  }

  /**
   * Синхронизация таблицы сценариев c папками сценариев (script, req)
   */
  async reviseSceneTable() {
    const sceneDocs = await this.dm.dbstore.get('scenes');
    const changeDocs = await scenefs.syncScripts(sceneDocs);
    const insertDocs = [];
    const updateDocs = [];
    changeDocs.forEach(item => {
      if (typeof item == 'object') {
        if (item.new) {
          insertDocs.push(item.doc);
        } else {
          updateDocs.push(item.doc);
        }
      }
    });
    console.log('toInsert ' + util.inspect(insertDocs));
    if (insertDocs.length) {
      await this.dm.insertDocs('scene', insertDocs);
    }
    console.log('toupdateDocs ' + util.inspect(updateDocs));
    if (updateDocs.length) {
      await this.dm.updateDocs('scene', updateDocs);
    }
  }

  // - создать sceneSet из таблицы scenes (экземпляры сценариев)
  async createSceneSet() {
    const sceneDocs = await this.dm.dbstore.get('scenes');
    const ss = new Map();
    sceneDocs.forEach(scene => {
      // Создается экземпляр (несколько для мультисценариев)
      ss.set(scene._id, scene);
    });
    return ss;
  }
}

module.exports = Scenemate;
