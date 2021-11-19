/**
 * soundutil.js
 */

const util = require('util');
const fs = require('fs');

const hut = require('./hut');

const ROOT = 'soundgroup';

/** sync
 *  Синхронизация папки sounds и таблицы sounds
 *   - Если в таблице нет - добавить запись
 *   - Если в таблице есть, а файла нет, запись не удаляется, а помечается как отсутствующая - miss?
 *
 * Результат: массив записей для добавления и измененения в таблице images
 *
 * @param {Array of objects} docs - записи в таблице images
 *
 * @result {Array} массив записей - [{new:true, doc:{}}, {doc:{_id,.. $set:{}}}]
 */
async function sync(docs, folder, parent) {
  const changeDocs = [];

  try {
    // записи в таблице
    const docsObj = hut.arrayToObject(docs, '_id');
   

    // Файлы в папке
    const fileNames = await fs.promises.readdir(folder);
    // const fileNames = fileNames.filter(filename => hut.isImgFile(filename));

    console.log('SOUNDS fileNames='+util.inspect(fileNames))

    fileNames.forEach(name => {
      if (!docsObj[name]) {
        changeDocs.push(createNewRecord(name, parent));
      } else if (docsObj[name].miss) {
        // Файл был помечен как отсутствующий

        docsObj[name].$set = { miss: 0 };
        changeDocs.push({doc:docsObj[name]});
      }
    });

    // Проверить, что для каждой записи таблицы есть файл в папке. Если нет - пометить как miss
    docs
      .filter(doc => !doc.folder)
      .forEach(doc => {
        console.log('SOUNDS includes ? '+doc._id)
        if (!fileNames.includes(doc._id)) {
          changeDocs.push(missing(doc._id, doc));
        }
      });
  } catch (e) {
    console.log('ERROR: soundutil.sync ' + util.inspect(e));
  }

  console.log('SOUNDS changeDocs '+util.inspect(changeDocs))
  return changeDocs;
}

function createNewRecord(name, parent = ROOT) {
  return { new: 1, doc: { _id: name, name, parent } };
}

function newFolderRecord(name) {
  return { _id: name, name, parent: ROOT, folder: 1 };
}

function missing(name, doc) {
  if (doc && !doc.miss) {
    doc.$set = { miss: 1 };
    return { doc };
  }
}

module.exports = {
  sync,

  newFolderRecord
};
