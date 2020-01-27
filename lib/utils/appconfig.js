/**
 * appconfig - Компонент для работы с конфигурацией приложения
 *   - формирует и возвращает пути к папкам приложения и проекта
 *   - возвращает версию
 *   - возвращает параметры из config.json
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const hut = require('./hut');

const REMOTE_SERVER = 'http://intrahouse.io:49770';

const appconfig = exports;


appconfig.projectVersionFromSystemVersion = projectVersionFromSystemVersion;

appconfig.isProjectPath = isProjectPath;
appconfig.getSysPath = getSysPath;
appconfig.getPluginsPath = getPluginsPath;
appconfig.getThePluginPath = getThePluginPath;

appconfig.updateConfigParam = updateConfigParam;
appconfig.saveConfigParam = saveConfigParam;
appconfig.isPluginSystem = isPluginSystem;
appconfig.getUpserver = getUpserver;
appconfig.getNotCrossPluginFilename = getNotCrossPluginFilename;

appconfig.getScriptPath = getScriptPath;
appconfig.getScriptFilename = getScriptFilename;
appconfig.getSnippetFilename = getSnippetFilename;
appconfig.getMethodPath = getMethodPath;
appconfig.getMethodFilename = getMethodFilename;
appconfig.getDiagramPath = getDiagramPath;
appconfig.getDiagramFilename = getDiagramFilename;
appconfig.getReqScriptPath = getReqScriptPath;
appconfig.getReqScriptFilename = getReqScriptFilename;

appconfig.getPrevVersion = getPrevVersion;
appconfig.setPrevVersionAndConf = setPrevVersionAndConf;

appconfig.needSysupScript = needSysupScript;
appconfig.runSysupScript = runSysupScript;
appconfig.getNpmInstallStr = getNpmInstallStr;
appconfig.isWindows = isWindows;
appconfig.getPlatform = getPlatform;


appconfig.startP = function(appdir) {
  appconfig.serverStartTime = Date.now();

  // Получить config параметры из файла config.json + из командной строки
  // Проверить и создать системные папки
  appconfig.config = getConfig(appdir);

  // Проверить папки проекта, при необходимости создать. 
  // Имена внутренних папок проекта также пишутся в appconfig.config
  checkAndMakeProjectFolders();
  
  return Promise.resolve();
};

appconfig.get = function get(param) {
  return param ? appconfig.config[param] || '' : '';
};

/**
 * Временная папка для разворачивания архивов и т д
 * Желательно, чтобы папка была на RAM
 */
appconfig.getTmpFolder = function(name) {
  let tmp;
  if (isWindows()) {
    // Внутри своей локальной папки
    tmp = path.join(appconfig.config.workpath, 'tmp');
    hut.checkAndMakeFolder(tmp);
  } else {
    tmp = os.tmpdir();
  }

  // /tmp/intrahouse-c - должна существовать
  let folder = path.join(tmp, appconfig.config.name_service);
  hut.checkAndMakeFolder(folder);

  // Если конечная папка существует - удаляем и создаем  заново
  if (name) {
    folder = path.join(folder, name);

    if (fs.existsSync(folder)) {
      hut.removeFolderSync(folder);
    }
    hut.checkAndMakeFolder(folder);
  }
  return folder;
};

appconfig.getTmpZipPath = function(name) {
  const zipfile = path.join(appconfig.getTmpFolder(), name + '.zip');
  if (fs.existsSync(zipfile)) fs.unlinkSync(zipfile);
  return zipfile;
};

appconfig.getProjectPath = function() {
  return appconfig.config.projectpath;
};

appconfig.getProjectsPath = function() {
  return appconfig.config.projectspath;
};

appconfig.getTheProjectPath = function(project) {
  return path.join(appconfig.getProjectsPath(), project);
};

appconfig.getTheProjectVersion = function(project) {
  let filename = path.join(appconfig.getTheProjectPath(project), 'project.json');
  return hut.readJsonFileSync(filename, true).version || '4.0';
};

appconfig.setTheProjectVersion = function(project) {
  let filename = path.join(appconfig.getTheProjectPath(project), 'project.json');
  hut.writeValToJsonFileSilent(filename, { version: projectVersionFromSystemVersion() });
};

// Из версии системы берем первые два числа - major.minor
function projectVersionFromSystemVersion() {
  if (appconfig.config.version) {
    return appconfig.config.version
      .split('.')
      .splice(0, 2)
      .join('.');
  }
}

function isProjectPath(projpath) {
  return fs.existsSync(path.join(projpath, 'jbase'));
}

function getSysPath() {
  return appconfig.config.syspath;
}

function getPluginsPath() {
  return appconfig.config.pluginspath;
}

function getThePluginPath(plugin) {
  return path.join(getPluginsPath(), plugin);
}

function isPluginSystem(name) {
  return name == 'system' || name == 'ihpro' || name == 'ihscada';
}

// Изменить без сохранения
function updateConfigParam(prop, value) {
  appconfig.config[prop] = value || '';
}

// Изменить и сохраненить
function saveConfigParam(prop, value) {
  appconfig.config[prop] = value || '';
  hut.writeValToJsonFileSilent(path.join(appconfig.config.workpath, 'config.json'), prop, value);
}

function getUpserver() {
  if (appconfig.config.upserver) return appconfig.config.upserver;

  let result;
  try {
    result = hut.readJsonFileSync(`${appconfig.config.syspath}/${appconfig.config.name_service}.ih`, 'utf8').url;
  } catch (e) {
    console.log('ERR: UPDATE getMainUrl ' + e.message + '. Used default ' + REMOTE_SERVER);
  }
  return result || REMOTE_SERVER;
}


function getScriptPath() {
  return path.join(appconfig.config.scenepath, 'script');
}

function getScriptFilename(sceneId) {
  return path.join(appconfig.config.scenepath, 'script', sceneId + '.js');
}

function getSnippetFilename(dn) {
  return path.join(appconfig.config.snippetpath, dn + '.js');
}

function getMethodPath(plugin) {
  return path.join(appconfig.config.scenepath, plugin);
}

function getMethodFilename(sceneId, plugin) {
  return path.join(appconfig.config.scenepath, plugin, sceneId + '.js');
}

function getDiagramPath() {
  return path.join(appconfig.config.scenepath, 'diagram');
}

function getDiagramFilename(sceneId) {
  return path.join(appconfig.config.scenepath, 'diagram', 'd_' + sceneId + '.json');
}

function getReqScriptPath() {
  return path.join(appconfig.config.scenepath, 'req');
}

function getReqScriptFilename(sceneId) {
  return path.join(appconfig.config.scenepath, 'req', 'scene_' + sceneId + '.js');
}

function getPrevVersion(name) {
  // Хранятся в /var/lib/intrahouse-c/versions/<name>
  // Считаем version из <name>.ih

  let filename = appconfig.config.vardir + '/versions/' + name + '/' + name + '.ih';
  if (fs.existsSync(filename)) {
    return hut.readJsonFileSync(filename, true).version;
  }
}

function setPrevVersionAndConf() {
  appconfig.config.prevversion = '';
  appconfig.config.prevconf = 'lite';

  let prevversion = getPrevVersion(appconfig.config.name_service);
  if (prevversion < appconfig.config.version) {
    appconfig.config.prevversion = prevversion;

    if (appconfig.config.conf != 'lite' && prevversion == getPrevVersion(appconfig.config.conf)) {
      appconfig.config.prevconf = appconfig.config.conf;
    }
  }
}

// {"system":["sys_up_1_2"]}
function needSysupScript() {
  // Массив скриптов системный
  let sysupfile = appconfig.config.sysbasepath + '/sysupversions.json';
  let sysup = hut.readJsonFileSync(sysupfile, true).system;
  if (!util.isArray(sysup)) {
    console.log('ERR: Invalid file ' + sysupfile);
    return;
  }

  // Массив фактически отработанных скриптов
  let up = getFactSysupVersions();

  return sysup.filter(item => up.every(item2 => item != item2));
}

function runSysupScript(script) {
  try {
    // Запустить скрипт
    let filename = `${appconfig.config.appdir}/lib/upgrade_v4/${script}.js`;
    require(filename)(appconfig.config);

    // сохранить в upversion - добавить в массив
    let up = getFactSysupVersions();
    up.push(script);
    hut.writeJsonFileSync(getFactSysupVersionsFilename(), { system: up }, true);
    return true;
  } catch (e) {
    console.log('ERR: Upgrade script ' + script + ' error: ' + e.message);
  }
}

// {"system":["sys_up_1_2"]}
function getFactSysupVersions() {
  let upfile = getFactSysupVersionsFilename();
  let up = fs.existsSync(upfile) ? hut.readJsonFileSync(upfile, true).system : [];
  return util.isArray(up) ? up : [];
}

function getFactSysupVersionsFilename() {
  return appconfig.config.varbasepath + '/sysupversions.json';
}

function getNpmInstallStr() {
  let res;
  if (isWindows()) {
    res = `${appconfig.config.npm} `;
  } else {
    res = 'sudo /opt/intrahouse-c/node/bin/node /opt/intrahouse-c/node/bin/npm ';
  }
  return res + ' --scripts-prepend-node-path=auto install --production';
}

function isWindows() {
  return process.platform.substr(0, 3) == 'win';
}

function getPlatform() {
  return isWindows() ? 'windows' : process.platform;
}

function getNotCrossPluginFilename(pluginid) {
  let platform = getPlatform();
  let res = pluginid + '_' + platform + '_' + hut.getArch();
  if (isWindows()) {
    res += '.exe';
  }
  return res;
}

appconfig.getInitObj = function () {
  return { oem: appconfig.get('oem') || '', header: appconfig.get('header') || 'intraHouse' };
}

/**  Функции модуля */

function getConfig(appdir) {
  let result;
  const workpath = path.resolve(process.cwd());

  // Настройки из файла config.json
  // Стандартно создается при инсталляции
  //  port - порт для http интерфейса
  //  vardir - путь для хранения проектов и плагинов
  //  lang -  язык интерфейса
  //  conf - конфигурация системы
  //  name_service - имя сервиса, также определяет папку в /var/lib, в которой находятся проекты и плагины
  //  project - здесь м.б. путь или имя конечной папки с проектом
  try {
    result = hut.readJsonFileSync(`${workpath}/config.json`);
  } catch (e) {
    result = {};
  }
  result.port = result.port && Number(result.port) > 0 ? Number(result.port) : 80;
  result.name_service = result.name_service || 'intrahouse-c';
  result.lang = result.lang || 'en';

  // Эти папки уже должны быть
  result.workpath = workpath;
  result.appdir = appdir;
  result.langdir = hut.checkFolder(path.join(appdir, 'locale'));
  result.syspath = path.join(appdir, '..'); // appdir = backend, sysdir = intrahouse
  result.sysbasepath = hut.checkFolder(path.join(appdir, 'sysbase')); // внутри папки backend

  // Параметры из командной строки переопределяют определенные в config.json: --project ...  --port ... --conf ...
  Object.assign(result, getProcessArgv());

  // Внутри папки vardir - плагины, проекты, общие изменяемые данные системы
  // Создаем папки, если их нет
  result.vardir = hut.checkAndMakeFolder(path.join(result.vardir || '/var/lib/', result.name_service));
  result.varbasepath = hut.checkAndMakeFolder(path.join(result.vardir, 'base')); // для хранения изменяемых таблиц относящихся в целом к системе
  result.pluginspath = hut.checkAndMakeFolder(path.join(result.vardir, 'plugins'));
  result.projectspath = hut.checkAndMakeFolder(path.join(result.vardir, 'projects'));

  // Папка с плагинами должна иметь папку system
  hut.checkAndMakeFolder(path.join(result.pluginspath, 'system'));

  result.wikiserver = result.wikiserver || 'https://intrahouse.ru';
  return result;
}

// Параметры из командной строки переопределяют определенные в config.json: --project ...  --port ... --conf ...
function getProcessArgv() {
  const argobj = {};
  let i = 1; // [0] - node, [1] - app
  while (i < process.argv.length) {
    if (process.argv[i].length > 2 && process.argv[i].substr(0, 2) == '--') {
      // Ключи с параметрами: --port 8088 --project ./project
      let key = process.argv[i].substr(2);
      i += 1;
      argobj[key] = process.argv[i];
    }
    i += 1;
  }
  return argobj;
}

function checkAndMakeProjectFolders() {

  result.custompath = `${result.projectpath}/custom`;
  hut.checkAndMakeFolder(result.custompath);

  result.imagepath = `${result.projectpath}/images`;
  result.jbasepath = `${result.projectpath}/jbase`;
  result.scenepath = `${result.projectpath}/scenes`;
  result.snippetpath = `${result.projectpath}/snippets`;

  result.privatepath = `${result.projectpath}/private`;
  result.operativepath = `${result.projectpath}/operative`;
  result.temppath = `${result.projectpath}/temp`;

  checkAndMakeScenesFolder();
  checkAndMakeTempFolder();
}

function checkAndMakeScenesFolder() {
  hut.checkAndMakeFolder(result.snippetpath);
  hut.checkAndMakeFolder(result.scenepath);
  hut.checkAndMakeFolder(result.scenepath + '/diagram');
  hut.checkAndMakeFolder(result.scenepath + '/script');
  hut.checkAndMakeFolder(result.scenepath + '/req');
}

function checkAndMakeTempFolder() {
  hut.checkAndMakeFolder(result.temppath);
  hut.checkAndMakeFolder(result.temppath + '/snapshot');
  hut.checkAndMakeFolder(result.temppath + '/sound');
}

function checkAndMakeProjectFolders() {
  try {
    appconfig.config.projectpath = getProjectPath();
  } catch (e) {}

  // Если задан путь к проекту - берем его, иначе папки проекта внутри vardir/projects
  if (result.project && result.project.indexOf('/') > 0) {
    result.projectpath = path.resolve(result.project);
    if (!fs.existsSync(result.projectpath)) {
      // Путь не существует - стартовать с проектом по умолчанию
      hut.logWarn('Project folder not found: ' + result.projectpath, 'INIT');
      result.projectpath = '';
      hut.logWarn(`Standard project folder will be used: ${vardir}/projects/${result.project}`, 'INIT');
    }
    result.project = path.parse(result.project).name;
  }

  if (!result.projectpath) {
    hut.checkAndMakeFolder(`${vardir}/projects`);

    // Если проект не задан - стартуем с проектом project1
    result.project = result.project || 'project1';
    result.projectpath = `${vardir}/projects/${result.project}`;
    hut.checkAndMakeFolder(result.projectpath);
  }
  hut.logMsg('Project folder: ' + result.projectpath, 'INIT');

  // Считать название проекта из project.json: {name:'', description:'', version}
  result.project_name = getProjectProp('name') || result.project;
  result.project_version = getProjectProp('version') || '4.0'; // Если не прописано - значит, старый
}

function specifyProjectPath() {
  // Если задан путь к проекту в config - берем его, иначе папка проекта по имени внутри vardir/projects
  if (appconfig.config.project && appconfig.config.indexOf('/') > 0) {
    appconfig.config.projectpath = path.resolve(appconfig.config.project);
    if (!fs.existsSync(appconfig.config.projectpath)) {
      // Путь не существует - стартовать с проектом по умолчанию
      hut.logWarn('Project folder not found: ' + result.projectpath, 'INIT');
      result.projectpath = '';
      hut.logWarn(`Standard project folder will be used: ${vardir}/projects/${result.project}`, 'INIT');
    }
    result.project = path.parse(result.project).name;
  }
}
