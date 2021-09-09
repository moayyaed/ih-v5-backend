/**
 * w_scenemate
 *  Слушает события:
 *  'add:scenes' - добавление экземпляров сценариев
 *  'remove:scenes' - удаление экземпляров сценариев
 *    Здесь неважно, это экземпляр мультисценария или простой сценарий
 *    Экземпляры формирует main процесс
 *    При изменении скрипта экземпляр всегда удаляется, затем добавляется
 * 
 * 'unrequire:scene'- делается unreq по команде от main процесса
 * 
 */

const util = require('util');

const hut = require('../utils/hut');

class W_scenemate {
  constructor(engine) {
    this.engine = engine;
    this.wCore = engine.wCore;
  }

  async start() {

    this.wCore.on('add:scenes', data => {
      // console.log('W_SCENEMATE add:scenes data=' + util.inspect(data));
      if (!data || !data.length) return;
      data.forEach(scene => {
        if (scene.id) this.engine.addScene(scene.id, scene);
      });
    });

    this.wCore.on('remove:scenes', data => {
      // console.log('W_SCENEMATE remove:scenes data=' + util.inspect(data));
      if (!data || !data.length) return;
      data.forEach(scene => {
        if (scene.id) this.engine.removeScene(scene.id);
      });
    });

    this.wCore.on('unrequire:scene', data => {
      // console.log('W_SCENEMATE unrequire:scene data=' + util.inspect(data));
      if (data.filename) hut.unrequire(data.filename);
    });
  }
}

module.exports = W_scenemate;
