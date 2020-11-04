/**
 * dbagentutil.js
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');

const ROOT = 'dbagentgroup';

/** syncDbagents
 *  Синхронизация папки agents и таблицы dbagents (inMemory)
 *   - Записи добавляются заново
 *
 * Результат: массив записей для добавления в таблицу
 *
 *
 * @result {Array} массив записей - [{new:true, doc:{_id,..}}, ]
 */

async function sync(docs, folder) {
  let changeDocs;

  try {
    // записи в таблице - ничего нет кроме root
    const dbnames = fut.readFolderSync(folder, { dir: 1 });

    const promises = dbnames.map(name => createNewRecord(name));
    changeDocs = await Promise.all(promises);
  } catch (e) {
    console.log('ERROR: sync dbagents ' + util.inspect(e));
  }
  return changeDocs;
}

async function createNewRecord(dbname) {
  return {
    new: 1,
    doc: {
      _id: dbname,
      title: dbname,
      active: getActive(dbname),
      parent: ROOT
    }
  };
}

function getActive(dbname) {
  return dbname == appconfig.get('dbname');
}
async function getProjectProps(projPath) {
  const robj = {};
  try {
    const data = await fut.readFileP(projPath + '/project.json');
    const pobj = JSON.parse(data);
    robj.version = pobj.version;
    if (pobj.title) robj.title = pobj.title;
    if (pobj.txt) robj.txt = pobj.txt;
  } catch (e) {
    // console.log('WARN: Project ' + projPath + '. Project.json missing or invalid: ' + util.inspect(e));
  }

  return robj;
}

async function updateProjectProps(doc) {
  // Сохранить title, txt в project.json и/или переименовать папку проекта
  let projectfolder = doc.projectfolder;

  if (doc.$set.projectfolder && doc.$set.projectfolder != projectfolder) {
    const newName = doc.$set.projectfolder;
    if (!hut.isIdValid(newName)) throw { message: appconfig.getMessage('INVALIDNAME') + ' ' + newName };
    renameProjectFolder(appconfig.getTheProjectPath(projectfolder), appconfig.getTheProjectPath(newName));
    projectfolder = newName;
  }

  if (doc.$set.title) {
    appconfig.setTheProjectProp(projectfolder, 'title', doc.$set.title);
  }

  if (doc.$set.txt != undefined) {
    appconfig.setTheProjectProp(projectfolder, 'txt', doc.$set.txt);
  }
}

module.exports = {
  sync
};
