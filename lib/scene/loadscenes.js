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

// const appconfig = require('../appconfig');

const sceneutils = require('../scene/sceneutils');

module.exports = async function(holder) {
  holder.sceneSet = {};
  const sceneDocs = (await  holder.dm.dbstore.get('scenes')).filter(doc => !doc.folder);
  sceneDocs.forEach(doc => {
    const oneScene = sceneutils.createSceneStruct(doc);
    if (oneScene.multi) {
      // Нужно создавать экземпляры для каждого набора
    } else {
      holder.sceneSet[doc.sceneId] = oneScene;
    }
  });
}
