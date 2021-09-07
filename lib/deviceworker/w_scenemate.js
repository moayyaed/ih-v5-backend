/**
 * w_scenemate
 */

const util = require('util');

// const sceneutils = require('./sceneutils');

class W_scenemate {
  constructor(engine) {
    this.engine = engine;
    this.wCore = engine.wCore;
  }

  async start() {
   
    
    // Когда добавляется узел в дереве сценариев - скрипта еще нет!!
    this.wCore.on('add:scenes', data => {
      // console.log('W_SCENEMATE add:scenes data=' + util.inspect(data));
      if (!data || !data.length) return;
      data.forEach(scene => {
        if (scene.id) this.engine.addScene(scene.id, scene);
      });
    });
    

    this.wCore.on('update:scenes', data => {
      console.log('W_SCENEMATE update:scenes data=' + util.inspect(data));
      if (!data || !data.length) return;
      data.forEach(scene => {
        if (scene.id) this.engine.updateScene(scene.id, scene);
      });
    });
    

    this.wCore.on('remove:scenes', data => {
      // console.log('W_SCENEMATE remove:scenes data=' + util.inspect(data));
      if (!data || !data.length) return;
      data.forEach(scene => {
        if (scene.id) this.engine.removeScene(scene.id);
      });
    });
  }
}

module.exports = W_scenemate;
