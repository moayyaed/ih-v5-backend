/**
 * projectutil.js
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');

const hut = require('./hut');
const fut = require('./fileutil');
const transfer = require('../../upgrade2V5/transfer');

const ROOT = 'projectgroup';

/** sync
 *  Синхронизация папки projects и таблицы projects
 *    Таблица inMemory, строится заново по папкам в projects
 *
 * Результат: массив записей для добавления в таблице projects
 *
 * @param {Array of objects} docs - записи в таблице projects - пока ничего нет кроме root
 *
 * @result {Array} массив записей - [{new:true, doc:{}},...]
 */

async function sync(docs) {
  let changeDocs;
  const projectsPath = appconfig.get('projectspath');
  try {
    const projectNames = fut.readFolderSync(projectsPath, { dir: 1 });

    const promises = projectNames.map(name => createNewRecord(name, projectsPath + '/' + name));
    changeDocs = await Promise.all(promises);
  } catch (e) {
    console.log('ERROR: syncProjects ' + util.inspect(e));
  }
  return changeDocs;
}

async function createNewRecord(projectfolder, projPath) {
  const projectProps = await getProjectProps(projPath);

  return {
    new: 1,
    doc: {
      _id: projectfolder,
      projectfolder,
      title: projectfolder,
      active: getActive(projectfolder),
      parent: ROOT,
      ...projectProps
    }
  };
}

function getActive(projectfolder) {
  return projectfolder == appconfig.get('project');
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
    console.log('WARN: Project ' + projPath + '. Project.json missing or invalid: ' + util.inspect(e));
  }

  return robj;
}

async function createProject(doc) {
  doc._id = '_' + String(Date.now());
  doc.projectfolder = 'project' + doc._id;
  doc.title = doc.projectfolder;

  // Создать папку с проектом
  const projpath = checkAndMakeNewProjectFolder(doc.projectfolder);
  console.log('WARN: Created new project folder: ' + projpath);

  // Копировать шаблонный проект, если есть - иначе просто пустой?
  /*
  const patProj = appconfig.getProjectPatternPath();
  if (patProj) {
    await doCopy(patProj, projpath);
    doc.title = patProj.split('/').pop();
  }
  */
  return doc;
}

async function copyProject(doc) {
  try {
    const src = appconfig.get('projectspath') + '/' + doc.projectfolder;

    if (src && !fs.existsSync(src)) throw { message: appconfig.getMessage('SRCFOLDERNOTEXISTS') };

    doc._id = '_' + String(Date.now());
    doc.projectfolder += doc._id;
    doc.title += ' (copy)';
    doc.active = 0;

    // Копировать
    doCopy(src, doc.projectfolder);
    return doc;
  } catch (e) {
    throw { message: appconfig.getMessage('CopyError') + ': ' + hut.getShortErrStr(e) };
  }
}

function formNewProjectId(sourceProjectFolder) {
  let str = sourceProjectFolder && hut.isIdValid(sourceProjectFolder) ? sourceProjectFolder : 'project1';
  if (!fs.existsSync(appconfig.getTheProjectPath(sourceProjectFolder))) return str;

  // Если папка с таким проектом уже есть - создать новую с временной меткой
  // если уже таким образом создано имя - нужно отсечь !!
  const result = /_\d*$/.exec(str);
  if (result && result.index) {
    str = str.substr(0, result.index);
  }
  /* result = ['_1234567890', index: 4, input: 'proj_1234567890']*/

  return str + '_' + String(Date.now());
}

function doCopy(src, newProjectFolder) {
  const dest = getNewProjectFolder(newProjectFolder);
  try {
    fut.copySync(src, dest);
  } catch (e) {
    throw { message: 'Error copy from ' + src + ' to ' + dest + hut.getShortErrStr(e) };
  }
}

function checkAndMakeNewProjectFolder(projectfolder) {
  const projpath = getNewProjectFolder(projectfolder);
  fs.mkdirSync(projpath);
  // Создать project.json с текущей версией
  const version = appconfig.projectVersionFromSystemVersion();
  fut.writeJsonFileSync(projpath + '/project.json', { version }, true);

  return projpath;
}
function getNewProjectFolder(projectfolder) {
  if (!hut.isIdValid(projectfolder)) throw { message: appconfig.getMessage('INVALIDNAME') };

  let projpath = appconfig.get('projectspath') + '/' + projectfolder;
  if (fs.existsSync(projpath)) throw { message: appconfig.getMessage('FOLDERALREADYEXISTS') };
  return projpath;
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

function renameProjectFolder(from, to) {
  if (!fs.existsSync(from)) throw { message: appconfig.getMessage('SRCFOLDERNOTEXISTS') };
  if (fs.existsSync(to)) throw { message: appconfig.getMessage('FOLDERALREADYEXISTS') };
  fs.renameSync(from, to);
}

async function removeProject(doc, dm) {
  const projDoc = await dm.dbstore.findOne('projects', { _id: doc._id });
  let projpath = appconfig.get('projectspath') + '/' + projDoc.projectfolder;
  if (!fut.delFolderSync(projpath)) throw { message: appconfig.getMessage('ERRDELETEFOLDER') + ' ' + projpath };
}

async function transferProject(fromFolder, project, emitMes) {
  const projectpath = appconfig.get('projectspath') + '/' + project;
  // Создать папку проекта и project.json
  checkAndMakeNewProjectFolder(project);

  // Создать папки внутри папки проекта
  appconfig.makeProjectFolders({ projectpath, project });

  // Копировать картинки - из папки в папку
  await copyImages(fromFolder + '/images', projectpath + '/images');

  await transfer(fromFolder, projectpath, emitMes);
}

async function copyImages(sourceFolder, targetFolder) {
  try {
    if (!fs.existsSync(sourceFolder)) throw { message: 'Image source not found: ' + sourceFolder };
    if (!fs.existsSync(targetFolder)) throw { message: 'Image target not found: ' + targetFolder };

    const arr = await fs.promises.readdir(sourceFolder);
    if (!arr) throw { message: 'Error read folder:' + sourceFolder };
    const selectedFiles = arr.filter(item => hut.isImgFile(item));
    if (!selectedFiles.length) throw { message: 'Not found images in folder: ' + sourceFolder };

    const promises = selectedFiles.map(file =>
      fs.promises.copyFile(sourceFolder + '/' + file, targetFolder + '/' + file)
    );
    await Promise.all(promises);
    return 'Transfer images: ' + promises.length + ' files';
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return hut.getShortErrStr(e);
  }
}

module.exports = {
  sync,
  createProject,
  copyProject,
  updateProjectProps,
  removeProject,
  doCopy,
  formNewProjectId,
  transferProject
};
