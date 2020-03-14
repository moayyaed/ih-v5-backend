/**
 * updatecheck.js
 */


const appconfig = require('../appconfig');

const dbstore = require('./dbstore');
const datautil = require('./datautil');

 /**
 * Проверка, что записи parent существуют
 * @param {Array of Object} docs
 * @param {string} collection
 * @param {string || Bool} nolost
 *
 * throw при ошибке
 */
async function checkParent(docs, collection, nolost) {
  const parentSet = new Set();
  docs.forEach(doc => {
    if (!doc.parent) throw { error: 'SOFTERR', message: 'Expected parent prop!' };
    if (nolost && isNodeLostFolder(doc.parent))
      throw { error: 'ERR', message: appconfig.getMessage('FolderLostInvOper') };

    parentSet.add(doc.parent);
  });
  if (!parentSet.size) return;

  // Проверить, что parents есть в таблице
  // filter сформировать как in, если записей несколько
  const arr = Array.from(parentSet);
  const filter = arr.length > 1 ? datautil.createIdsInFilter(arr) : { _id: arr[0] };
  await checkRecordsExist(collection, filter, parentSet);
}

async function checkRecordsExist(collection, filter, idSet) {
  const result = await dbstore.get(collection, filter);

  // Не найдена ни одна запись
  if (!result) {
    throw {
      error: 'ERRNOTFOUND',
      message: `Record not exists! Not found with filter:${JSON.stringify(filter)} in collection:${collection}`
    };
  }

  // Не найдена одна (несколько) из
  if (result.length != idSet.size) {
    // Найти, каких нет
    result.forEach(record => {
      if (idSet.has(record._id)) idSet.delete(record._id);
    });

    throw {
      error: 'ERRNOTFOUND',
      message: `Record not exists! Not found record with _id:${Array.from(idSet).join(',')} in collection:${collection}`
    };
  }
}

function isNodeLostFolder(node) {
  return node && node.substr(0, 5) == 'lost_';
}

module.exports = {
  checkParent,
  checkRecordsExist,
  isNodeLostFolder
};