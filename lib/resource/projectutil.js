/**
 * projectutil.js
 */

const util = require('util');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');

const ROOT = 'projectgroup';

/** syncProjects
 *  Синхронизация папки projects и таблицы projects
 *   - Если в таблице нет - добавить запись
 *   - Если в таблице есть - проверить название
 *   - Если в таблице есть, а папки нет, строка удаляется
 *
 * Результат: массив записей для добавления и измененения в таблице projects
 *
 * @param {Array of objects} docs - записи в таблице projects
 *
 * @result {Array} массив записей - [{new:true, doc:{}}, {doc:{_id,.. $set:{}}}]
 */
async function syncProjects(docs, folder) {
  let changeDocs;
  try {
    // записи в таблице
    const docsObj = hut.arrayToObject(docs, '_id');

    // Папки проектов в папке projects
    const projectNames = fut.readFolderSync(folder, { dir: 1 });

    const promises = projectNames.map(name =>
      !docsObj[name] ? createNewRecord(name, folder+'/'+name) : verifyRecord(docsObj[name], folder+'/'+name)
    );
    changeDocs = await Promise.all(promises);

    // Проверить, что для каждой записи таблицы есть папка проекта. Если нет - удалить
    docs.forEach(doc => {
      if (!projectNames.includes(doc._id)) {
        changeDocs.push({ del: 1, doc });
      }
    });
  } catch (e) {
    console.log('ERROR: syncProjects ' + util.inspect(e));
  }
  return changeDocs;
}

async function createNewRecord(name, projPath) {
  const projectProps = await getProjectProps(projPath);
  return { new: 1, doc: { _id: name, folder:name, title:name, parent: ROOT, ...projectProps } };
}

async function getProjectProps(projPath) {
  const robj = {};
  try {
    const data = await fut.readFileP(projPath + '/project.json');
    const dobj = JSON.parse(data);
    robj.version = dobj.version;
    if (robj.title) robj.title = dobj.title;
  } catch (e) {
    console.log('WARN: Project ' + projPath + '. Project.json missing or invalid: ' + util.inspect(e));
  }
  return robj;
}

async function verifyRecord(doc, folder) {
  const projectProps = await getProjectProps(folder);
  Object.keys(projectProps).forEach(prop => {
    if (doc[prop] != projectProps[prop]) {
      if (!doc.$set) doc.$set = {};
      doc.$set[prop] = projectProps[prop];
    }
  });
  return doc.$set ? doc : '';
}

module.exports = {
  syncProjects
};
