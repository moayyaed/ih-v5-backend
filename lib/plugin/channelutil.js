/**
 * channelutil.js
 */

// const util = require('util');

const hut = require('../utils/hut');


 /** addShareFields
 * Добавить к каналам поля из родительской папки типа 'node'
 *  Добавляется parentname = chan  папки
 *  + по списку полей share_fields (из манифеста)
 *
 * @param {Array of Objects} charr - массив каналов - документы,
 *       считанные из devhard для этого экземпляра плагина. Включают папки
 * @param {Array of Strings} share_fields - массив имен полей
 *
 * @return  {Array of Objects} charr - тот же массив с добавленными полями
 */
function addShareFields(charr, share_fields) {
  if (!share_fields) return;

  // Выделить узлы - это папки с foldertype='node'
  const nodeFolders = charr.filter(item => item.folder && item.foldertype == 'node');
  if (!nodeFolders.length) return charr;

  const nodeFolderObj = hut.arrayToObject(nodeFolders, '_id');
  charr.forEach(item => {
    if (item.parent && nodeFolderObj[item.parent]) {
      item.parentname = nodeFolderObj[item.parent].chan;
      share_fields.forEach(field => {
        item[field] = nodeFolderObj[item.parent][field] || 0;
      });
    }
  });
  return charr;
}


module.exports = {
  addShareFields
}