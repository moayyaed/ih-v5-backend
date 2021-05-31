/**
 * projectutil.js
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');

const hut = require('./hut');
const fut = require('./fileutil');
const wu = require('./wrappers');
const transfer = require('../../upgrade2V5/transfer');

const ROOT = 'projectgroup';
/*
const defProjectProps = {
  version: '5.0',
  title: '',
  txt: '',
  deps: 0,
  deviceloglines: 100,
  location: 'Moscow',
  lat: 55.45,
  lng: 37.35
};
*/

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

    const promises = projectNames.filter(isProjectFolder).map(name => createNewRecord(name, projectsPath + '/' + name));
    changeDocs = await Promise.all(promises);
  } catch (e) {
    console.log('ERROR: syncProjects ' + util.inspect(e));
  }
  return changeDocs;
}

function isProjectFolder(name) {
  return name != 'node_modules';
}

async function createNewRecord(projectfolder, projPath) {
  const projectProps = await getProjectProps(projPath);
  if (!projectProps.title) projectProps.title = projectfolder;

  return {
    new: 1,
    doc: {
      _id: projectfolder,
      projectfolder,
      active: isActive(projectfolder),
      parent: ROOT,
      ...projectProps
    }
  };
}

function isActive(projectfolder) {
  return projectfolder == appconfig.get('project');
}

async function getProjectProps(projPath) {
  let pobj = {};
  try {
    const data = await fut.readFileP(projPath + '/project.json');
    pobj = JSON.parse(data);
  } catch (e) {
    /*
    console.log(
      'ERROR: Use default project props. ' + projPath + '/project.json missing or invalid: ' + util.inspect(e)
    );
    */
  }
  const defProjectProps = appconfig.getDefProjectProps();
  return { ...defProjectProps, ...pobj };
}

async function createProject(doc) {
  doc._id = '_' + String(Date.now());
  doc.projectfolder = 'project' + doc._id;
  doc.title = doc.projectfolder;

  // Создать папку с проектом
  const projpath = checkAndMakeNewProjectFolder(doc.projectfolder);
  console.log('WARN: Created new project folder: ' + projpath);
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

/**
 * Редактирование свойств проекта - имя папки и title
 *
 * @param {*} doc - отредактированный документ имеет doc.$set
 *  - Если меняют projectfolder - папку проекта - то переименовать папку проекта
 *  - Если добавляется модуль newmodule - установить модуль
 *  - Другие свойства записать в project.json (по списку defProjectProps)
 *
 * На выходе doc.$set, который сохраняется в таблицу projects (inMemory)!!
 */
async function updateProjectProps(doc) {
  if (!doc || !doc.$set) return;

  const newProps = {};
  const defProjectProps = appconfig.getDefProjectProps();
  Object.keys(doc.$set).forEach(prop => {
    if (defProjectProps[prop] != undefined) {
      newProps[prop] = doc.$set[prop];
      appconfig.set('project_' + prop, doc.$set[prop]);
    }
  });

  let projectfolder = doc.projectfolder; // Текущая папка

  // переименовать папку проекта?
  if (doc.$set.projectfolder && doc.$set.projectfolder != projectfolder) {
    if (isActive(projectfolder)) throw { message: 'Невозможно изменить папку активного проекта!' };

    if (!hut.isIdValid(doc.$set.projectfolder))
      throw { message: appconfig.getMessage('INVALIDNAME') + ' ' + doc.$set.projectfolder };

    renameProjectFolder(
      appconfig.getTheProjectPath(doc.projectfolder),
      appconfig.getTheProjectPath(doc.$set.projectfolder)
    );
    projectfolder = doc.$set.projectfolder;
  }

  if (!hut.isObjIdle(newProps)) {
    appconfig.saveTheProjectProps(projectfolder, newProps);
  }

  if (doc.$set.newmodule != undefined) {
    // Здесь нужно установить модуль!!!
    await installDeps(doc._id, doc.$set.newmodule);
    doc.$set.newmodule = '';
  }
}

function createPackageJsonIfNotExists(project_id) {
  const filename = appconfig.getTheProjectPath(project_id) + '/package.json';
  if (fs.existsSync(filename)) return;

  const data = {
    name: project_id,
    version: '5.0.0',
    dependencies: {}
  };
  fut.writeJsonFileSync(filename, data);
}

function renameProjectFolder(from, to) {
  if (!fs.existsSync(from)) throw { message: appconfig.getMessage('SRCFOLDERNOTEXISTS') };
  if (fs.existsSync(to)) throw { message: appconfig.getMessage('FOLDERALREADYEXISTS') };
  fs.rename(from, to, err => {
    if (err) {
      console.log('ERROR: Rename from ' + from + ' to ' + to + ': ' + util.inspect(err));
    }
  });
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

async function installDeps(project_id, newmodule) {
  try {
    createPackageJsonIfNotExists(project_id);
    await wu.installOneNodeModule(appconfig.getTheProjectPath(project_id), newmodule);
  } catch (e) {
    console.log('ERROR: Npm install ' + newmodule + ': ' + util.inspect(e));
    throw { message: 'Fail install module ' + newmodule };
  }
}

async function updateCurrentProjectDeps(dm) {
  const project_id = appconfig.get('project');
  await dm.dbstore.removeAll('projectdeps');
  return dm.dbstore.insert('projectdeps', await getNpmList(project_id));
}

async function getNpmList(project_id) {
  const res = [];
  try {
    createPackageJsonIfNotExists(project_id);
    const folder = appconfig.getTheProjectPath(project_id);

    let stdoutStr = await wu.tryRunCmdP(appconfig.getNpmListStr(), { cwd: folder }, true); // IgnoreExitCode
    // Возвращает json+еще тексты - нужно найти конец json - последний }
    const j = stdoutStr.lastIndexOf('}');
    if (j > 0) stdoutStr = stdoutStr.substr(0, j + 1);

    const resObj = JSON.parse(stdoutStr);
    if (resObj) {
      if (resObj.dependencies) {
        Object.keys(resObj.dependencies).forEach(name => {
          res.push({ name, version: resObj.dependencies[name].version, from: resObj.dependencies[name].from });
        });
      }

      if (resObj.problems) {
        if (!Array.isArray(resObj.problems)) resObj.problems = [resObj.problems];
        resObj.problems.forEach(el => {
          res.push({ name: 'PROBLEM: ' + el });
        });
      }
    }
  } catch (e) {
    console.log('ERROR: Npm ls: ' + util.inspect(e));
  }
  return res;
}

module.exports = {
  sync,
  createProject,
  copyProject,
  updateProjectProps,
  removeProject,
  doCopy,
  formNewProjectId,
  transferProject,
  getNpmList,
  installDeps,
  updateCurrentProjectDeps,
  renameProjectFolder
};
