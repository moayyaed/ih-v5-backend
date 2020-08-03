/**
 * snippetmate.js
 *
 */
const util = require('util');
// const fs = require('fs');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');
// const sceneutils = require('./sceneutils');

class Snippetmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    this.revising = true;
    // await this.dm.reviseTableWithFolder('scene', sceneutils.syncScripts);
    this.revising = false;

    // Загрузить и запустить сниппеты
    loadSnippets();

    function loadSnippets() {
      // const toInstallSet = new Set();
    }
  }
}

module.exports = Snippetmate;
