/**
 * appconfig - Компонент для работы с конфигурацией приложения
 *   - загружает параметры из config.json и командной строки
 *   - формирует пути, создает несуществующие папки проекта
 *   - загружает словари для выбранного языка
 * 
 *   - хранит и возвращает:
 *      - пути к папкам приложения и проекта
 *      - версию
 *      - параметры из config.json
 *      - переводы для выбранного языка
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const hut = require('./utils/hut');
const fut = require('./utils/fileutil');
const sysinfo = require('./utils/sysinfo');
const translate = require('./utils/translate');

const REMOTE_SERVER = 'http://intrahouse.io:49770';

const config = { name_service: 'intrahouse-d', lang: 'en', npm: '', header: 'intraHouse', oem: '' };
const dict = {}; 

module.exports = {
  start(appdir, configdir, project) {
    // Получить config параметры из файла config.json + из командной строки
    // Проверить и создать системные папки
    Object.assign(config, getConfig(appdir, configdir));
    
    if (project) {
      config.project = project;
    }
    // Проверить папки проекта, при необходимости создать.
    specifyProjectPath();

    // Проверить и создать внутренние папок проекта
    checkAndMakeProjectFolders();

    // Уточнить язык и загрузить словари
    // this.setLang();
    loadDicts();

  },

  get(param) {
    return param ? config[param] || '' : '';
  },

  getTheProjectPath(project) {
    return path.join(config.projectspath, project);
  },

  getTheProjectVersion(project) {
    let filename = path.join(this.getTheProjectPath(project), 'project.json');
    return fut.readJsonFileSync(filename, true).version || '4.0';
  },

  setTheProjectVersion(project) {
    let filename = path.join(this.getTheProjectPath(project), 'project.json');
    fut.writeValToJsonFileSilent(filename, { version: projectVersionFromSystemVersion() });
  },

  isProjectPath(projpath) {
    return fs.existsSync(path.join(projpath, 'jbase'));
  },

  getThePluginPath(plugin) {
    return path.join(config.pluginspath, plugin);
  },

  isPluginSystem(name) {
    return name == 'system' || name == 'ihpro' || name == 'ihscada';
  },

  // Изменить без сохранения
  updateConfigParam(prop, value) {
    config[prop] = value || '';
  },

  // Изменить и сохраненить
  saveConfigParam(prop, value) {
    config[prop] = value || '';
    fut.writeValToJsonFileSilent(path.join(config.workpath, 'config.json'), prop, value);
  },

  getUpserver() {
    if (config.upserver) return config.upserver;

    let result;
    try {
      result = fut.readJsonFileSync(`${config.syspath}/${config.name_service}.ih`, 'utf8').url;
    } catch (e) {
      console.log('ERR: UPDATE getMainUrl ' + e.message + '. Used default ' + REMOTE_SERVER);
    }
    return result || REMOTE_SERVER;
  },

  getScriptPath() {
    return path.join(config.scenepath, 'script');
  },

  getScriptFilename(sceneId) {
    return path.join(config.scenepath, 'script', sceneId + '.js');
  },

  getSnippetFilename(dn) {
    return path.join(config.snippetpath, dn + '.js');
  },

  getMethodPath(plugin) {
    return path.join(config.scenepath, plugin);
  },

  getMethodFilename(sceneId, plugin) {
    return path.join(config.scenepath, plugin, sceneId + '.js');
  },

  getDiagramPath() {
    return path.join(config.scenepath, 'diagram');
  },

  getDiagramFilename(sceneId) {
    return path.join(config.scenepath, 'diagram', 'd_' + sceneId + '.json');
  },

  getReqScriptPath() {
    return path.join(config.scenepath, 'req');
  },

  getReqScriptFilename(sceneId) {
    return path.join(config.scenepath, 'req', 'scene_' + sceneId + '.js');
  },

  getPrevVersion(name) {
    // Хранятся в /var/lib/intrahouse-c/versions/<name>
    // Считаем version из <name>.ih

    let filename = config.vardir + '/versions/' + name + '/' + name + '.ih';
    if (fs.existsSync(filename)) {
      return fut.readJsonFileSync(filename, true).version;
    }
  },

  setPrevVersionAndConf() {
    config.prevversion = '';
    config.prevconf = 'lite';

    let prevversion = this.getPrevVersion(config.name_service);
    if (prevversion < config.version) {
      config.prevversion = prevversion;

      if (config.conf != 'lite' && prevversion == this.getPrevVersion(config.conf)) {
        config.prevconf = config.conf;
      }
    }
  },

  getNpmInstallStr() {
    let res;
    if (sysinfo.isWindows() || config.npm) {
      res = `${config.npm} `;
    } else {
      res = 'sudo /opt/intrahouse-c/node/bin/node /opt/intrahouse-c/node/bin/npm ';
    }
    return res + ' --scripts-prepend-node-path=auto install --production';
  },

  getInitObj() {
    return { oem: this.get('oem'), header: this.get('header') };
  },

  getTmpFolder(name) {
    let tmp;
    if (sysinfo.isWindows()) {
      // Внутри своей локальной папки
      tmp = path.join(config.workpath, 'tmp');
    } else {
      // /tmp/intrahouse-d
      tmp = path.join(os.tmpdir(), config.name_service);
    }
    fut.checkAndMakeFolder(tmp);

    // Если конечная папка существует - удаляем и создаем  заново
    let folder;
    if (name) {
      folder = path.join(tmp, name);

      if (fs.existsSync(folder)) {
        fut.removeFolderSync(folder);
      }
      fut.checkAndMakeFolder(folder);
    }
    return folder;
  },

  getTmpZipPath(name) {
    const zipfile = path.join(this.getTmpFolder(), name + '.zip');
    if (fs.existsSync(zipfile)) fs.unlinkSync(zipfile);
    return zipfile;
  },

  getMessage(id) {
    console.log('getMessage '+id)
    return dict.messages[id] || id;
  },

  setLang() {
    // Если язык выбран - должна быть соотв папка! Если нет - то сбросить
    // if (!isLangExists(this.get('lang'))) this.updateConfigParam('lang', 'en');
  },

  translateSys(data) {
    translate.translateIt(data, dict.pmmessages, config);
  },

  getPluginDictFilename(plugin) {
    const pluginfolder = this.getThePluginPath(plugin);
    const langfolder = `${pluginfolder}/locale`;
    if (!fs.existsSync(langfolder)) return;

    let langx = this.get('lang');
    let mesfile = `${pluginfolder}/locale/${langx}.json`;
    let mesfile_en = `${pluginfolder}/locale/en.json`;

    return fs.existsSync(mesfile) ? mesfile : mesfile_en;

  }
  
};

/**  Функции модуля */

function isLangExists(lang) {
  return lang && fs.existsSync(config.langdir + '/' + lang);
}

  
function getLangPath(lang) {
  return  config.langdir + '/' + lang;
}

function loadDicts() {
  loadOneDict('messages');
  loadOneDict('pmmessages');
  loadOneDict('month');
  loadOneDict('daysofweek');
}

function loadOneDict(dictname) {

  const filename = getLangPath(config.lang)+'/'+dictname+'.json';
  try {
    dict[dictname] = hut.arrayToDict(fut.readJsonFileSync(filename), 'id', 'note');
  } catch (e) {
    console.log(util.inspect(e));
    dict[dictname] = {};
  }
}

function getConfig(appdir, configdir) {
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
  const filename = configdir ? `${configdir}/config.json` : `${workpath}/config.json`;
  try {
    result = fut.readJsonFileSync(filename);
  
  } catch (e) {
    console.log('File '+filename+' not found, use default config.')
    result = config;
  }
  result.port = result.port && Number(result.port) > 0 ? Number(result.port) : 80;

  // Эти папки уже должны быть
  result.workpath = workpath;
  result.appdir = appdir;
  result.syspath = path.join(appdir, '..'); // appdir = backend, sysdir = intrahouse

  // внутри папки backend
  result.langdir = path.join(appdir, 'locale');
  fut.checkFolder(result.langdir);
  
  result.sysbasepath = path.join(appdir, 'sysbase'); 
  fut.checkFolder(result.sysbasepath);

  // Параметры из командной строки переопределяют определенные в config.json: --project ...  --port ... --conf ...
  Object.assign(result, getProcessArgv());

  // Внутри папки vardir - плагины, проекты, общие изменяемые данные системы
  // Создаем папки, если их нет
  result.vardir = path.join(result.vardir || '/var/lib/', result.name_service);
  fut.checkAndMakeFolder(result.vardir);

  result.varbasepath = path.join(result.vardir, 'base'); // для хранения изменяемых таблиц относящихся в целом к системе
  fut.checkAndMakeFolder(result.varbasepath);

  result.pluginspath = path.join(result.vardir, 'plugins');
  fut.checkAndMakeFolder(result.pluginspath);

  result.projectspath = path.join(result.vardir, 'projects');
  fut.checkAndMakeFolder(result.projectspath);

  // Папка с плагинами должна иметь папку system
  fut.checkAndMakeFolder(path.join(result.pluginspath, 'system'));

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
  config.custompath = `${config.projectpath}/custom`;
  fut.checkAndMakeFolder(config.custompath);

  config.imagepath = `${config.projectpath}/images`;
  fut.checkAndMakeFolder(config.imagepath);

  config.jbasepath = `${config.projectpath}/jbase`;
  fut.checkAndMakeFolder(config.jbasepath);
  fut.checkAndMakeFolder(config.jbasepath+ '/layout');
  fut.checkAndMakeFolder(config.jbasepath+ '/container');

  config.scenepath = `${config.projectpath}/scenes`;
  fut.checkAndMakeFolder(config.scenepath);
  fut.checkAndMakeFolder(config.scenepath + '/diagram');
  fut.checkAndMakeFolder(config.scenepath + '/script');
  fut.checkAndMakeFolder(config.scenepath + '/req');

  config.snippetpath = `${config.projectpath}/snippets`;
  fut.checkAndMakeFolder(config.snippetpath);

  config.privatepath = `${config.projectpath}/private`;
  fut.checkAndMakeFolder(config.privatepath);

  config.operativepath = `${config.projectpath}/operative`;
  fut.checkAndMakeFolder(config.operativepath);

  config.temppath = `${config.projectpath}/temp`;
  fut.checkAndMakeFolder(config.temppath);

  fut.checkAndMakeFolder(config.temppath + '/snapshot');
  fut.checkAndMakeFolder(config.temppath + '/sound');

  // Считать название проекта из project.json: {name:'', description:'', version}
  config.project_name = getProjectProp('name') || config.project;
  config.project_version = getProjectProp('version') || '5.0'; // Если не прописано - значит, старый
}

function getProjectProp(propname) {
  return fut.readJsonFileSync(`${config.projectpath}/project.json`, true)[propname];
}

function specifyProjectPath() {
  // Если задан путь к проекту в config - берем его, иначе папка проекта по имени внутри vardir/projects
  if (config.project && config.project.indexOf('/') > 0) {
    config.projectpath = path.resolve(config.project);
    config.project = path.parse(config.project).name;

    if (!fs.existsSync(config.projectpath)) {
      // Путь не существует - стартовать с проектом по умолчанию
      console.log('Project folder not found: ' + config.projectpath, 'INIT');
      config.projectpath = '';
      console.log(`Standard project folder will be used: ${config.vardir}/projects/${config.project}`, 'INIT');
    }
  }

  if (!config.projectpath) {
    config.projectspath = `${config.vardir}/projects`;
    fut.checkAndMakeFolder(config.projectspath);

    // Если проект не задан - стартуем с проектом project1
    config.project = config.project || 'project1';
    config.projectpath = `${config.vardir}/projects/${config.project}`;
  }
  fut.checkAndMakeFolder(config.projectpath);

  console.log('Project folder: ' + config.projectpath, 'INIT');
}

// Из версии системы берем первые два числа - major.minor
function projectVersionFromSystemVersion() {
  if (config.version) {
    return config.version
      .split('.')
      .splice(0, 2)
      .join('.');
  }
}

