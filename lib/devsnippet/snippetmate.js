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

    // Загрузить список сниппетов - файлы в папке snippets
    loadSnippets();

    function loadSnippets() {
      // const toInstallSet = new Set();  - ПОКА ЗАВИСИМОСТИ НЕ УЧИТЫВАЮТСЯ

      // По всем устройствам и глобальным переменным - - если есть сниппет - найти его и запустить
     
    }
  }
}


module.exports = Snippetmate;
