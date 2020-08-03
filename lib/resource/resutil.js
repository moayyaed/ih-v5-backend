/**
 * resutil.js
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');

const ROOT = 'imagegroup';
const imageExts = ['png', 'jpg', 'jpeg', 'svg'];

/** syncImages
 *  Синхронизация папки images и таблицы images
 *   - Если в таблице нет - добавить запись
 *   - Если в таблице есть - проверить параметры. Cравнить даты, при необходимости перегенерир
 *   - Если в таблице есть, а файла нет, строка не удаляется, а помечается как отсутствующая ?
 *
 * Результат: массив записей для добавления и измененения в таблице images
 *
 * @param {Array of objects} docs - записи в таблице images
 *
 * @result {Array} массив записей - [{new:true, doc:{}}, {doc:{_id,.. $set:{}}}]
 */
async function syncImages(docs, folder) {
  let changeDocs;
  try {
    // записи в таблице
    const docsObj = hut.arrayToObject(docs, '_id');

    // Файлы в папке
    const fileNames = await fs.promises.readdir(folder);
    const imageNames = fileNames.filter(filename => isImage(filename));

    const promises = imageNames.map(name =>
      !docsObj[name] ? createNewRecord(name) : verifyRecord(name, docsObj[name])
    );
    changeDocs = await Promise.all(promises);

   // Проверить, что для каждой записи таблицы есть файл в папке. Если нет - пометить как miss   
    docs.forEach(doc => {
      if (!imageNames.includes(doc._id)) {
        changeDocs.push(missing(doc._id, doc));
      }
    });

  } catch (e) {
    console.log('ERROR: resutil.syncImages ' + util.inspect(e));
  }
  return changeDocs;
}

function isImage(filename) {
  const ext = hut.getFileExt(filename);
  return ext && imageExts.includes(ext);
}

async function createNewRecord(name) {
  return { new: 1, doc: { _id: name, name, parent: ROOT } };
}

function newImageRecord(name) {
  return{ _id: name, name, parent: ROOT } ;
}

async function verifyRecord(name, doc) {
  if (doc.miss) {
    doc.$set = {miss:0};
    return {doc};
  }
}

function missing(name, doc) {
  if (doc && !doc.miss) {
    doc.$set = {miss:1};
    return {doc};
  }
}

module.exports = {
  syncImages,
  newImageRecord,
  isImage
};
