const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const ROOT = 'imagegroup';

/** syncImages
 *  Синхронизация папки images и таблицы images
 *   - Если в таблице нет - добавить запись
 *   - Если в таблице есть - проверить параметры. Cравнить даты, при необходимости перегенерир
 *   - Если в таблице есть, а файла нет, строка не удаляется, а помечается как отсутствующая ?
 *
 * Результат: массив записей для добавления и измененения в таблице images
 *
 * @param {Array of objects} docs - записи в таблице images
 * @result {Array} массив записей - [{new:true, doc:{}}, {doc:{_id,.. $set:{}}}]
 */
async function syncImages(docs) {
  let changeDocs;
  try {
    const fileNames = await fs.promises.readdir(appconfig.getImagePath());
    // const scriptNames = fileNames.filter(el => el.endsWith('.js')).map(el => el.substr(0, el.length - 3));
    // "ext":".png,.jpg,.jpeg,.svg"
    const imageNames = fileNames.filter(el => el.endsWith('.svg'));

    const docsObj = hut.arrayToObject(docs, '_id');

    const promises = imageNames.map(name =>
      !docsObj[name] ? createNewRecord(name) : verifyRecord(name, docsObj[name])
    );
    changeDocs = await Promise.all(promises);

    // Проверить наоборот, что записи таблицы есть в папке. Если нет - пометить как отсутствующий сценарий
    /*
    sceneDocs.forEach(doc => {
      if (!scriptNames.includes(doc._id)) {
        // changeDocs.push({ doc: Object.assign(doc, { $set: { unget: 1, errstr: 'Script not found!' } }) });
        changeDocs.push(missingScriptFile(doc._id));
      }
    });
    */

  } catch (e) {
    console.log('Error syncScripts ' + util.inspect(e));
  }
  return changeDocs;
}

async function createNewRecord(name) {
  return { new: 1, _id: name, status: '0', name, parent: ROOT };
}

async function verifyRecord(name, doc) {

}

module.exports = {
  syncImages
};