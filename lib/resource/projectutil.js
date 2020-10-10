/**
 * projectutil.js
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');
const appconfig = require('../appconfig');

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
      !docsObj[name] ? createNewRecord(name, folder + '/' + name) : verifyRecord(docsObj[name], folder + '/' + name)
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
  return { new: 1, doc: { _id: name, folder: name, title: name, parent: ROOT, ...projectProps } };
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

async function createProject(doc) {
  doc._id = '_' + String(Date.now());
  doc.folder = 'project' + doc._id;
  doc.title = doc.folder;

  // Создать папку с проектом
}

async function copyProject(doc) {
  const src = appconfig.get('projectspath') + '/' + doc.folder;
  console.log('WARN: src ' + src);
  if (src && !fs.existsSync(src)) throw { message: appconfig.getMessage('SRCFOLDERNOTEXISTS') };

  doc._id = '_' + String(Date.now());
  doc.folder += doc._id;
  doc.title += ' (copy)';
  const projpath = checkAndMakeNewProjectFolder(doc.folder);

  // Копировать
  try {
    await wu.cpP({ src, dest: projpath });
  } catch (e) {
    throw { message: 'Error copy from ' + src + ' to ' + projpath + util.inspect(e) };
  }
  return doc;
}

function checkAndMakeNewProjectFolder(folder) {
  if (!hut.isIdValid(folder)) throw { message: appconfig.getMessage('INVALIDNAME') };

  let projpath = appconfig.get('projectspath') + '/' + folder;
  if (fs.existsSync(projpath)) throw { message: appconfig.getMessage('FOLDERALREADYEXISTS') };
  console.log('WARN: make Folder projpath=' + projpath);
  // Создаем папку синхронно
  fs.mkdirSync(projpath);
  return projpath;
}

async function updateProjectProps(doc) {
  // Сохранить title, txt в project.json и/или переименовать папку проекта
  let folder = doc.folder;

  if (doc.$set.folder) {
    const from = appconfig.getTheProjectPath(folder);
    if (!fs.existsSync(from)) throw { message: 'Project not found: ' + from };
    const to = appconfig.getTheProjectPath(to);
    fs.renameSync(from, to);
    folder = doc.$set.folder;
  }

  if (doc.$set.title) {
    appconfig.setTheProjectProp(folder, 'title', doc.$set.title);
  }

  if (doc.$set.txt) {
    appconfig.setTheProjectProp(folder, 'txt', doc.$set.txt);
  }
}

async function removeProject(doc, dm) {
  const projDoc = await dm.dbstore.findOne('projects', { _id: doc._id });
  let projpath = appconfig.get('projectspath') + '/' + projDoc.folder;
  if (!fut.delFolderSync(projpath)) throw { message: appconfig.getMessage('ERRDELETEFOLDER') + ' ' + projpath };
}

module.exports = {
  syncProjects,
  createProject,
  copyProject,
  updateProjectProps,
  removeProject
};
