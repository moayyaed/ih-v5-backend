/**
 * loadscenes.js
 * Загрузка данных на старте
 *
 *  - Загружает сценарии
 *  - Формирует анемичный объект - экземпляры сценариев для передачи в worker
 *    ( он же holder.sceneSet )
 *
 *
 */

const util = require('util');

const appconfig = require('../appconfig');

const devicelogger = require('./devicelogger');

module.exports = async function(holder) {
  holder.sceneSet = {};
  const sceneDocs = (await  holder.dm.dbstore.get('scenes')).filter(doc => !doc.folder);
  sceneDocs.forEach(doc => {
    sceneutils.createSceneStruct(doc)
  });

}
