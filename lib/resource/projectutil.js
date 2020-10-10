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
async function syncProjects(docs, projectsPath) {
  let changeDocs;
  try {
    // записи в таблице
    const docsObj = hut.arrayToObject(docs, '_id');

    // Папки проектов в папке projects
    const projectNames = fut.readFolderSync(projectsPath, { dir: 1 });

    const promises = projectNames.map(name =>
      !docsObj[name] ? createNewRecord(name, projectsPath + '/' + name) : verifyRecord(docsObj[name], folder + '/' + name)
    );
    changeDocs = await Promise.all(promises);

    // Проверить, что для каждой записи таблицы есть папка проекта. Если нет - удалить
    docs.filter(doc => !doc.folder).forEach(doc => {
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
  return { new: 1, doc: { _id: name, projectfolder: name, title: name, parent: ROOT, ...projectProps } };
}

async function getProjectProps(projPath) {
  const robj = {};
  try {
    const data = await fut.readFileP(projPath + '/project.json');
    const pobj = JSON.parse(data);
    robj.version = pobj.version;
    if (robj.title) robj.title = pobj.title;
    if (robj.txt) robj.txt = pobj.txt;
  } catch (e) {
    console.log('WARN: Project ' + projPath + '. Project.json missing or invalid: ' + util.inspect(e));
  }
  return robj;
}

async function verifyRecord(doc, projectfolder) {
  const projectProps = await getProjectProps(projectfolder);
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
  doc.projectfolder = 'project' + doc._id;
  doc.title = doc.projectfolder;

  // Создать папку с проектом
  const projpath = checkAndMakeNewProjectFolder(doc.projectfolder);

  // Копировать шаблонный проект, если есть - иначе просто пустой?
  const patProj = appconfig.getProjectPatternPath();
  console.log('patProj = '+patProj);
  if (patProj) {
    await doCopy(patProj, projpath);
    doc.title = patProj.split('/').pop();
  }
  return doc;
}

async function copyProject(doc) {
  const src = appconfig.get('projectspath') + '/' + doc.projectfolder;
  console.log('WARN: src ' + src);
  if (src && !fs.existsSync(src)) throw { message: appconfig.getMessage('SRCFOLDERNOTEXISTS') };

  doc._id = '_' + String(Date.now());
  doc.projectfolder += doc._id;
  doc.title += ' (copy)';
  const projpath = checkAndMakeNewProjectFolder(doc.projectfolder);

  // Копировать
  await doCopy(src, projpath);
  return doc;
}

async function doCopy(src, dest) {
   try {
    await wu.cpP({ src, dest});
  } catch (e) {
    throw { message: 'Error copy from ' + src + ' to ' + dest + util.inspect(e) };
  }
}

function checkAndMakeNewProjectFolder(projectfolder) {
  if (!hut.isIdValid(projectfolder)) throw { message: appconfig.getMessage('INVALIDNAME') };

  let projpath = appconfig.get('projectspath') + '/' + projectfolder;
  if (fs.existsSync(projpath)) throw { message: appconfig.getMessage('FOLDERALREADYEXISTS') };
  // Создаем папку синхронно
  fs.mkdirSync(projpath);
  return projpath;
}

async function updateProjectProps(doc) {
  // Сохранить title, txt в project.json и/или переименовать папку проекта
  let projectfolder = doc.projectfolder;

  if (doc.$set.projectfolder) {
    const from = appconfig.getTheProjectPath(projectfolder);
    if (!fs.existsSync(from)) throw { message: 'Project not found: ' + from };
    const to = appconfig.getTheProjectPath(to);
    fs.renameSync(from, to);
    projectfolder = doc.$set.projectfolder;
  }

  if (doc.$set.title) {
    appconfig.setTheProjectProp(projectfolder, 'title', doc.$set.title);
  }

  if (doc.$set.txt) {
    appconfig.setTheProjectProp(projectfolder, 'txt', doc.$set.txt);
  }
}

async function removeProject(doc, dm) {
  const projDoc = await dm.dbstore.findOne('projects', { _id: doc._id });
  let projpath = appconfig.get('projectspath') + '/' + projDoc.projectfolder;
  if (!fut.delFolderSync(projpath)) throw { message: appconfig.getMessage('ERRDELETEFOLDER') + ' ' + projpath };
}

module.exports = {
  syncProjects,
  createProject,
  copyProject,
  updateProjectProps,
  removeProject
};
