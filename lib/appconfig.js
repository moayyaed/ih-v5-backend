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

const config = { name_service: 'ih-v5', lang: 'en', npm: '', header: 'intraHouse', oem: '', port: 8088 };
const dict = {};
let noimage = '';
let appcrypto;

const defProjectProps = {
  version: '5.0',
  title: '',
  txt: '',
  deps: 0,
  prefix: 'user',
  deviceloglines: 100,
  maxdevicelogrecords: 100000,
  location: 'Moscow',
  lat: 55.45,
  lng: 37.35
};

module.exports = {
  start(appdir) {
    // Получить config параметры из файла config.json + из командной строки
    // Проверить и создать системные папки
    Object.assign(config, getConfig(appdir));
    config.version = getSystemVersion(); // Версия системы

    // Проверить папки проекта, при необходимости создать.
    specifyProjectPath();

    // Проверить и создать внутренние папок проекта
    checkAndMakeProjectFolders(config);

    // Уточнить язык и загрузить словари
    // this.setLang();
    loadDicts();
  },

  encryptPublic(buffer) {
    appcrypto.encryptPublic(buffer);
  },

  get(param) {
    return param ? config[param] || '' : '';
  },

  set(param, val) {
    config[param] = val;
  },

  makeProjectFolders(configObj) {
    checkAndMakeProjectFolders(configObj);
    return configObj;
  },

  getIndex(url) {
    let folder = url && url.startsWith('/admin') ? 'admin' : 'user';
    let frontendPath = config.syspath + '/frontend/' + folder;

    if (config.project_frontend && folder != 'admin') {
      frontendPath = config.projectfrontendpath;
    }

    const filename = frontendPath + '/index.html';
    try {
      return fs.readFileSync(filename);
    } catch (e) {
      console.log('ERROR: webserver.getIndex ' + hut.getShortErrStr(e));
      return 'Not found ' + filename;
    }
  },

  setProjectProp(prop, value) {
    if (!prop || value == undefined) return;

    config['project_' + prop] = value;
    const filename = path.join(config.projectpath, 'project.json');
    fut.writeValToJsonFileSilent(filename, { [prop]: value });
  },

  getProjectJson() {
    return fut.readJsonFileSync(`${config.projectpath}/project.json`, true);
  },

  getTheProjectPath(project) {
    return path.join(config.projectspath, project);
  },

  getIntegrationPath(app) {
    const folder = path.join(config.integrationspath, app);
    if (!fs.existsSync(folder)) {
      fut.checkAndMakeFolder(folder);
    }
    return folder;
  },

  getTheProjectProp(project, propname) {
    const filename = path.join(config.projectspath, project, 'project.json');
    return fut.readJsonFileSync(filename, true)[propname];
  },

  getProjectPatternPath() {
    // Путь к шаблонному проекту, но его может не быть
    // def - в папке системы sysdir = /opt/intrahouse-d + pattern/basicproject?
    const patpath = path.join(config.syspath, 'pattern/basicproject');
    if (fs.existsSync(patpath)) {
      // Проверить, что это папка проекта - там д б jbase
      const jpath = path.join(patpath, 'jbase');
      return fs.existsSync(jpath) ? patpath : '';
    }
  },

  getTheProjectVersion(project) {
    let filename = path.join(this.getTheProjectPath(project), 'project.json');
    return fut.readJsonFileSync(filename, true).version || '5.0';
  },

  setTheProjectVersion(project) {
    let filename = path.join(this.getTheProjectPath(project), 'project.json');
    fut.writeValToJsonFileSilent(filename, { version: this.projectVersionFromSystemVersion() });
  },

  setTheProjectProp(project, prop, value) {
    let filename = path.join(this.getTheProjectPath(project), 'project.json');
    fut.writeValToJsonFileSilent(filename, { [prop]: value });
  },

  saveTheProjectProps(project, newprops) {
    let filename = path.join(this.getTheProjectPath(project), 'project.json');
    const props = fut.readJsonFileSync(filename, true) || {};
    fut.writeValToJsonFileSilent(filename, { ...props, ...newprops });
  },

  isProjectPath(projpath) {
    return fs.existsSync(path.join(projpath, 'jbase'));
  },

  isV5Project(projpath) {
    return fs.existsSync(path.join(projpath, 'jbase', 'devices.db'));
  },

  isPlugin(pluginpath) {
    // Должен иметь файл <имя плагина>.ih
    const files = fut.readFolderSync(pluginpath, { ext: 'ih' });
    return files.length > 0;
  },

  getPluginInfo(pluginpath) {
    const files = fut.readFolderSync(pluginpath, { ext: 'ih' });
    if (!files.length) throw { message: 'Not found file .ih in ' + pluginpath };

    const filename = path.join(pluginpath, files[0]);
    return fut.readJsonFileSync(filename);
  },

  getPluginManifestProp(plugin, prop) {
    if (!plugin) return null;
    const ppath = this.getThePluginPath(plugin);
    let filename = path.resolve(ppath, 'manifest.json');
    if (!fs.existsSync(filename)) {
      filename = path.resolve(ppath, plugin + '.json');
    }
    // const filename = `${ppath}/${plugin}.json`;
    if (!fs.existsSync(filename)) return null; // Нет манифеста

    const data = fut.readJsonFileSync(filename, true); // nothrow
    return data[prop] || '';
  },

  getThePluginPath(plugin) {
    return path.join(config.pluginspath, plugin);
  },

  isThePluginInstalled(plugin) {
    return fs.existsSync(this.getThePluginPath(plugin));
  },

  isPluginSystem(name) {
    return name == 'system' || name == 'ihpro' || name == 'ihscada';
  },

  getPluginAdapterObj(plugin) {
    const apath = path.join(config.pluginspath, plugin, 'adapter.js');
    if (fs.existsSync(apath)) {
      return require(apath);
    }
  },

  isDbagent(folder) {
    return fs.existsSync(path.join(folder, 'dbagent.ih'));
  },

  getDbagentInfo(folder) {
    const filename = path.join(folder, 'dbagent.ih');
    return fut.readJsonFileSync(filename, true) || {};
  },

  getTheDbagentPath(agent) {
    return path.join(config.agentspath, agent);
  },

  getIhFilePath(type, name) {
    const folder = type == 'dbagent' ? this.getTheDbagentPath(name) : this.getThePluginPath(name);
    return path.join(folder, type == 'dbagent' ? 'dbagent.ih' : name + '.ih');
  },

  getDbagentModule(agent) {
    return path.join(config.agentspath, agent, 'dbagent.js');
  },

  getLogagentModule(agent) {
    return path.join(config.agentspath, agent, 'logagent.js');
  },

  getV5FormPath(unit, formId) {
    const plugin = hut.removeLastNumFromStr(unit);
    let folder = formId.indexOf('Dbagent') > 0 ? this.getTheDbagentPath(unit) : this.getThePluginPath(plugin);
    return path.resolve(folder, 'v5', formId + '.json');
  },

  getPluginIdFromUnitId(unit) {
    return hut.removeLastNumFromStr(unit);
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

  getConfigObject() {
    const filename = path.join(config.workpath, 'config.json');
    return fut.readJsonFileSync(filename, true) || {};
  },

  saveConfigObject(newObj) {
    const filename = path.join(config.workpath, 'config.json');
    const cObj = fut.readJsonFileSync(filename, true) || {};
    fut.writeJsonFileSync(filename, Object.assign(cObj, newObj), true);
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

  getImagePath() {
    return config.imagepath;
  },

  getScriptPath() {
    return path.join(config.scenepath, 'script');
  },

  getScriptFilename(sceneId) {
    return path.join(config.scenepath, 'script', sceneId + '.js');
  },

  getSnippetFilename(id) {
    return path.join(config.snippetpath, id + '.js');
  },

  getRestapihandlerFilename(id) {
    const filename = id.startsWith('restapi') ? 'apiboot.js' : id + '.js';

    return path.join(config.restapihandlerpath, filename);
  },

  getDocImagePath() {
    return config.docimagepath;
  },

  getDocPageFilename(id, lang) {
    const filename = id + '.md';

    // Если папки с языком нет - создать!
    const langfolder = path.join(config.docpagepath, lang);
    if (!fs.existsSync(langfolder)) {
      fut.checkAndMakeFolder(langfolder);
    }
    return path.join(langfolder, filename);
  },

  getDocPublicPageFilename(id, lang) {
    const filename = id + '.md';

    // Если папки с языком нет - создать!
    const langfolder = path.join(config.docpublicpagepath, lang);
    if (!fs.existsSync(langfolder)) {
      fut.checkAndMakeFolder(langfolder);
    }
    return path.join(langfolder, filename);
  },

  getHandlerPath() {
    return path.join(config.handlerpath);
  },

  // id = t003.state
  getHandlerFilename(id) {
    if (!id || id == '-') return '';
    const name = id.indexOf('.') > 0 ? id.split('.').join('_') : id;
    return path.join(config.handlerpath, name + '.js');
  },

  getHandlerFilenameIfExists(id) {
    const filename = this.getHandlerFilename(id);
    return filename && fs.existsSync(filename) ? filename : '';
  },

  getVisScriptFilename(id) {
    return path.join(config.visscriptpath, id + '.js');
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

  getDbagentModulePath() {
    // return config.dbagent;
    return '';
  },

  getDbagentOptions() {
    /*
    if (fs.existsSync(filename)) {
      return fut.readJsonFileSync(filename, true).version;
    }
    */
  },

  getPrevVersion(name) {
    // Хранятся в /var/lib/intrahouse-c/versions/<name>
    // Считаем version из <name>.ih

    let filename = config.vardir + '/versions/' + name + '/' + name + '.ih';
    if (fs.existsSync(filename)) {
      return fut.readJsonFileSync(filename, true).version;
    }
  },

  getNpmInstallStr() {
    let res;
    if (sysinfo.isWindows() || config.npm) {
      res = `${config.npm} `;
    } else {
      res = 'sudo /opt/' + config.name_service + '/node/bin/node /opt/' + config.name_service + '/node/bin/npm ';
    }
    // return res + ' --scripts-prepend-node-path=auto install --production';
    return res + ' --scripts-prepend-node-path=auto install';

    // --unsafe-perm=true --allow-root
  },

  // 'sudo /opt/intrahouse-c/node/bin/node /opt/intrahouse-c/node/bin/npm --scripts-prepend-node-path=auto install --unsafe-perm=true --allow-root'
  getNpmListStr() {
    let res;
    if (sysinfo.isWindows() || config.npm) {
      res = `${config.npm} `;
    } else {
      res = 'sudo /opt/' + config.name_service + '/node/bin/node /opt/' + config.name_service + '/node/bin/npm ';
    }
    return res + ' ls --depth=0 --json';
  },

  getInitObj() {
    return { oem: this.get('oem'), header: this.get('header') };
  },

  getNewversion(id) {
    if (!id || id == 'newversion') id = 'system';
    const filename = path.join(config.mainbasepath, 'newversions.json');
    const newversion = fut.readJsonFileSync(filename, true)[id] || '';
    return hut.compareSemVer(newversion, config.version) ? newversion : '';
  },

  getNewbetaversion(id) {
    id = 'betasystem';
    const filename = path.join(config.mainbasepath, 'newversions.json');

    const newversion = fut.readJsonFileSync(filename, true)[id] || '';

    // const res = config.version < newversion ? newversion : ''
    return hut.compareSemVer(newversion, config.version) ? newversion : '';
  },

  setNewversion(id, version) {
    if (!id) return;
    const filename = path.join(config.mainbasepath, 'newversions.json');
    fut.writeValToJsonFileSilent(filename, { [id]: version });
  },

  getRegistry() {
    if (!config.hwid) return 'EAgain'; // Не успел рассчитаться ключ

    const filename = path.join(config.mainbasepath, 'registry.json');
    const regObj = fut.readJsonFileSync(filename, true);
    // {"status":1,"payload":{"deviceid":"EaLucbjRr","token":"DVp7weMKX2"},"hwid":"13582c8df904a9beaa3635b48333ed5ae2e07b7624f69e65b87dfc1f94078d7d-0110"}

    if (!regObj || !regObj.payload || !regObj.hwid) {
      return 'NeedReg';
    }

    // if (regObj.hwid != config.hwid) return 'InvalidHwid';
    return regObj;
  },

  setRegistry(registryObj) {
    if (!registryObj) return;
    const filename = path.join(config.mainbasepath, 'registry.json');
    fut.writeJsonFileSync(filename, Object.assign(registryObj, { hwid: config.hwid }), true);
  },

  // Сохранить данные в файл лицензии
  async saveLicense(key, data) {
    if (!key || !data) throw { message: 'Empty key or data!!' };

    const filename = path.join(config.mainbasepath, 'l_' + key + '.lih');
    return fs.promises.writeFile(filename, data);
  },

  removeLicense(key) {
    if (!key) throw { message: 'removeLicense: Empty key !' };

    const filename = path.join(config.mainbasepath, 'l_' + key + '.lih');
    fs.unlinkSync(filename);
  },

  // Возвращает содержимое файлов-лицензий
  getLicenses() {
    const lpath = config.mainbasepath;
    const files = fut.readFolderSync(lpath, { ext: 'lih' });
    if (!files || !files.length) return [];

    const res = [];
    files.forEach(file => {
      const filename = path.join(lpath, file);
      try {
        const str = fs.readFileSync(filename, 'utf8');
        res.push(str);
      } catch (e) {
        console.log('ERROR: Reading license file, skipped: ' + util.inspect(e));
      }
    });
    return res;
  },

  // Возвращает список плагинов, закаченных по кнопке Проверить Обновления плагинов
  // Список общий для платформы: intrahouse_v5_plugins
  getV5Plugins() {
    try {
      const filename = path.join(config.mainbasepath, this.getConfName() + '_plugins.json');

      const arr = fut.readJsonFileSync(filename);
      return arr && Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  saveV5Plugins(data) {
    let filename;
    try {
      filename = path.join(config.mainbasepath, this.getConfName() + '_plugins.json');
      fut.writeJsonFileSync(filename, data);
    } catch (e) {
      console.log('ERROR: saveV5Plugins to ' + filename + ' ' + util.inspect(e));
    }
  },

  // ВРЕМЕННО, пока не получаю список плагинов с сервера - скопировать из системы
  checkV5PluginsFile() {
    const plugins = this.getV5Plugins();
    if (plugins.length) return;

    this.copyV5PluginsFile();
  },

  copyV5PluginsFile() {
    try {
      const jsonname = this.getConfName() + '_plugins.json';
      const filename = path.join(config.appdir, 'upgrade', jsonname);
      if (fs.existsSync(filename)) {
        fs.promises.copyFile(filename, path.join(config.mainbasepath, jsonname));
      }
    } catch (e) {
      console.log('ERROR: appconfig.checkV5PluginsFile ' + util.inspect(e));
    }
  },

  getTmpFolder(name) {
    const osTmp = os.tmpdir();
    let tmp;
    if (sysinfo.isWindows() || !osTmp) {
      // Внутри своей локальной папки
      tmp = path.join(config.workpath, 'tmp');
    } else {
      // /tmp/intrahouse-d
      tmp = path.join(osTmp, config.name_service);
    }
    fut.checkAndMakeFolder(tmp);

    let folder = tmp;
    // Если конечная папка существует - удаляем и создаем  заново
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
    return dict.messages[id] || id;
  },

  setLang() {
    // Если язык выбран - должна быть соотв папка! Если нет - то сбросить
    // if (!isLangExists(this.get('lang'))) this.updateConfigParam('lang', 'en');
  },

  getLocation() {
    return { lat: config.project_lat, lng: config.project_lng };
  },

  translateSys(data) {
    return translate.translateIt(data, dict.pmmessages, config);
  },

  setNoImage() {
    const filename = config.sysbasepath + '/noimage.svg';
    if (fs.existsSync(filename)) {
      noimage = fs.readFileSync(filename);
    }
    return noimage;
  },

  getNoImage() {
    return noimage || this.setNoImage();
  },

  getPluginModulePath(plugin, module) {
    const pluginfolder = this.getThePluginPath(plugin);

    return path.join(pluginfolder, module);
  },

  getPluginDictFilename(plugin) {
    const pluginfolder = this.getThePluginPath(plugin);
    const langfolder = `${pluginfolder}/locale`;
    if (!fs.existsSync(langfolder)) return;

    let langx = this.get('lang');
    let mesfile = `${pluginfolder}/locale/${langx}.json`;
    let mesfile_en = `${pluginfolder}/locale/en.json`;

    return fs.existsSync(mesfile) ? mesfile : mesfile_en;
  },

  getDict(dictname) {
    console.log('getDict '+dictname+'  dict[dictname]='+util.inspect( dict[dictname]))
    return dict[dictname];
  },

  checkApiSymlink(appdir) {
    // В папке /var/lib/intrahouse-c создать папку node_modules
    const nmpath = `${this.get('vardir')}/node_modules`;
    fut.checkAndMakeFolder(nmpath);

    // Проверить, что есть ссылка на api плагинов, если нет - создать
    const papipath = `${nmpath}/ih-plugin-api`;

    if (!fs.existsSync(papipath)) {
      const target = `${appdir}/lib/ih-plugin-api`; // Если папка в backend/lib - как обычный модуль (не пакет)
      console.log('CREATE SYMLINK ' + papipath + ' ' + target);
      fs.symlink(target, papipath, 'dir', err => {
        if (err) {
          console.log('API plugin symlink  ' + papipath + ' creation error: ' + util.inspect(err));
        }
      });
    }
  },

  getConf() {
    return this.get('conf') || 0;
  },

  getConfName() {
    switch (this.getConf()) {
      case 2:
        return 'intrascada_v5';
      default:
        return 'intrahouse_v5';
    }
  },

  getConfTitle() {
    return this.getMessage(this.getConfName());
  },

  getConfInfoMessage() {
    const msg = 'info_' + this.getConf();
    return this.getMessage(msg) || '';
  },

  // Из версии системы берем первые два числа - major.minor
  projectVersionFromSystemVersion() {
    if (config.version) {
      return config.version
        .split('.')
        .splice(0, 2)
        .join('.');
    }
  },

  getChannelPropsFromV5Form(unit) {
    const fiedtypes = ['number', 'cb', 'input', 'droplist'];
    const filename = this.getV5FormPath(unit, 'channelform');
    try {
      const data = fut.readJsonFileSync(filename);
      if (!data.grid || !Array.isArray(data.grid)) throw { message: 'Invalid form. Exected "grid" aray!' };

      const res = {};
      const pArray = data.grid.map(gridItem => gridItem.id);
      pArray.forEach(p => {
        if (data[p] && Array.isArray(data[p])) {
          data[p].forEach(item => {
            if (item.prop && fiedtypes.includes(item.type)) {
              res[item.prop] = item.type;
            }
          });
        }
      });
      return res;
    } catch (e) {
      console.log('ERROR: getChannelPropsFromV5Form ' + filename + ': ' + hut.getShortErrStr(e));
    }
  },

  getSystemplugins() {
    const filename = `${config.appdir}/upgrade/systemplugins.json`;
    let systemPlugins = [];
    try {
      systemPlugins = fut.readJsonFileSync(filename);
      if (!Array.isArray(systemPlugins)) throw { message: 'Expected array: ' + filename };
    } catch (e) {
      console.log('ERROR: ' + hut.getShortErrStr(e) + ' System plugins updating was skipped..');
    }
    return systemPlugins;
  },

  getDefProjectProps() {
    return defProjectProps;
  },

  // Возвращает TRUE если пункт д б DISABLE
  disSection(section) {
    if (config.docs) {
     return !["datasource", "documentation","access"].includes(section);
   } 

   if (section == 'documentation') return true;
    const conf = this.getConf();
    if (conf > 1) return;
    if (section == 'analytics') {
      return !this.isModuleEnabled('multichart');
    }
  },

  // при наличии лицензии - из confmanager
  isModuleEnabled(name) {
    return this.get('module_' + name);
  },

  getAddons() {
    const conf = this.getConf();
    return {
      multichart: conf > 1 || this.isModuleEnabled('multichart') ? 1 : 0,
      dbgate: conf > 1 || this.isModuleEnabled('dbgate') ? 1 : 0
    };
  },

  disableAllModules() {
    Object.keys(config).forEach(prop => {
      if (prop.startsWith('module_')) {
        this.set(prop, 0);
      }
    });
  }
};

/**  Функции модуля */
/*
function isLangExists(lang) {
  return lang && fs.existsSync(config.langdir + '/' + lang);
}
*/

function getLangPath(lang) {
  return config.langdir + '/' + lang;
}

function loadDicts() {
  loadOneDict('messages');
  loadOneDict('pmmessages');
  loadOneDict('frontmessages');
  loadOneDict('month');
  loadOneDict('daysofweek');
}

function loadOneDict(dictname) {
  const filename = getLangPath(config.lang) + '/' + dictname + '.json';
  try {
    const data = fut.readJsonFileSync(filename);
    dict[dictname] = Array.isArray(data) ? hut.arrayToDict(data, 'id', 'note') : data;
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
  //  projdir - здесь м.б. путь отличный от vardir для проектов, иначе = vardir
  //  lang -  язык интерфейса
  //  name_service - имя сервиса, также определяет папку в /var/lib, в которой находятся проекты и плагины
  //  project - имя конечной папки с проектом

  const filename = configdir ? `${configdir}/config.json` : `${workpath}/config.json`;
  try {
    result = fut.readJsonFileSync(filename);
  } catch (e) {
    console.log('File ' + filename + ' not found, create default config.');
    result = config;
    fut.writeJsonFileSync(filename, config);
  }
  result.port = result.port && Number(result.port) > 0 ? Number(result.port) : 8088;
  result.apiport = result.apiport && Number(result.apiport) > 0 ? Number(result.apiport) : 8099;
  result.name_service = result.name_service || 'ih-v5';

  // Эти папки уже должны быть
  result.workpath = workpath;
  result.appdir = appdir;
  result.syspath = path.join(appdir, '..'); // appdir = backend, sysdir = intrahouse

  // внутри папки backend
  result.langdir = path.join(appdir, 'locale');
  fut.checkFolder(result.langdir);

  result.sysbasepath = path.join(appdir, 'sysbase');
  fut.checkFolder(result.sysbasepath);

  // Параметры из командной строки переопределяют определенные в config.json: --project ...  --port ...
  Object.assign(result, getProcessArgv());

  // Логи
  result.logpath = `${result.workpath}/log`;
  fut.checkAndMakeFolder(result.logpath);

  result.worktemppath = `${result.workpath}/temp`;
  fut.checkAndMakeFolder(result.worktemppath);

  // Внутри папки vardir - плагины, проекты. Создаем папки, если их нет
  result.vardir = path.join(result.vardir || '/var/lib/', result.name_service);
  fut.checkAndMakeFolder(result.vardir);

  // Папка для хранения изменяемых таблиц относящихся в целом к системе - ключи, версии
  result.mainbasepath = path.join(result.vardir, 'base');
  fut.checkAndMakeFolder(result.mainbasepath);

  result.pluginspath = path.join(result.vardir, 'plugins');
  fut.checkAndMakeFolder(result.pluginspath);

  result.projectspath = path.join(result.vardir, 'projects');
  fut.checkAndMakeFolder(result.projectspath);

  result.agentspath = path.join(result.vardir, 'agents');
  fut.checkAndMakeFolder(result.agentspath);

  return result;
}

// Параметры из командной строки переопределяют определенные в config.json: --project ...  --port ...
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

function checkAndMakeProjectFolders(xconfig) {
  // xconfig.logbasepath = `${xconfig.projectpath}/logbase`;
  xconfig.logbasepath = `${xconfig.projectpath}/logdb`;
  fut.checkAndMakeFolder(xconfig.logbasepath);

  xconfig.dbpath = `${xconfig.projectpath}/db`;
  fut.checkAndMakeFolder(xconfig.dbpath);

  xconfig.custombasepath = `${xconfig.projectpath}/custombase`;
  fut.checkAndMakeFolder(xconfig.custombasepath);

  xconfig.imagepath = `${xconfig.projectpath}/images`;
  fut.checkAndMakeFolder(xconfig.imagepath);

  xconfig.jbasepath = `${xconfig.projectpath}/jbase`;
  fut.checkAndMakeFolder(xconfig.jbasepath);
  fut.checkAndMakeFolder(xconfig.jbasepath + '/layout');
  fut.checkAndMakeFolder(xconfig.jbasepath + '/container');
  fut.checkAndMakeFolder(xconfig.jbasepath + '/template');
  fut.checkAndMakeFolder(xconfig.jbasepath + '/dialog');

  xconfig.scenepath = `${xconfig.projectpath}/scenes`;
  fut.checkAndMakeFolder(xconfig.scenepath);
  fut.checkAndMakeFolder(xconfig.scenepath + '/diagram');
  fut.checkAndMakeFolder(xconfig.scenepath + '/script');
  fut.checkAndMakeFolder(xconfig.scenepath + '/req');

  xconfig.snippetpath = `${xconfig.projectpath}/snippets`;
  fut.checkAndMakeFolder(xconfig.snippetpath);
  xconfig.visscriptpath = `${xconfig.projectpath}/visscripts`;
  fut.checkAndMakeFolder(xconfig.visscriptpath);

  xconfig.restapihandlerpath = `${xconfig.projectpath}/restapi`;
  fut.checkAndMakeFolder(xconfig.restapihandlerpath);
  createApibootScriptIfNotExists(xconfig.restapihandlerpath);

  xconfig.handlerpath = `${xconfig.projectpath}/handlers`;
  fut.checkAndMakeFolder(xconfig.handlerpath);

  xconfig.privatepath = `${xconfig.projectpath}/private`;
  fut.checkAndMakeFolder(xconfig.privatepath);

  xconfig.operativepath = `${xconfig.projectpath}/operative`;
  fut.checkAndMakeFolder(xconfig.operativepath);

  /*
  xconfig.hdbpath = `${xconfig.projectpath}/history`;
  fut.checkAndMakeFolder(xconfig.hdbpath);
  */

  xconfig.temppath = `${xconfig.projectpath}/temp`;
  fut.checkAndMakeFolder(xconfig.temppath);

  xconfig.projectfrontendpath = `${xconfig.projectpath}/frontend`;
  fut.checkAndMakeFolder(xconfig.projectfrontendpath);

  fut.checkAndMakeFolder(xconfig.temppath + '/snapshot');
  fut.checkAndMakeFolder(xconfig.temppath + '/sound');

  // Считать название проекта из project.json: {name:'', description:'', version}
  const projectJson = fut.readJsonFileSync(`${xconfig.projectpath}/project.json`, true);

  xconfig.project_title = projectJson.title || xconfig.project;
  xconfig.project_version = projectJson.version || defProjectProps.version; // Если не прописано - значит, старый
  xconfig.project_prefix = projectJson.prefix || defProjectProps.prefix;
  xconfig.project_frontend = projectJson.frontend || '';

  xconfig.project_deviceloglines = projectJson.deviceloglines || defProjectProps.deviceloglines;
  xconfig.project_maxdevicelogrecords = projectJson.maxdevicelogrecords || defProjectProps.maxdevicelogrecords;
  xconfig.project_lat = projectJson.lat || defProjectProps.lat;
  xconfig.project_lng = projectJson.lng || defProjectProps.lng;

  xconfig.docimagepath = `${xconfig.projectpath}/docimages`;
  fut.checkAndMakeFolder(xconfig.docimagepath);

  xconfig.docpagepath = `${xconfig.projectpath}/docpages`;
  fut.checkAndMakeFolder(xconfig.docpagepath);

  xconfig.docpublicpagepath = `${xconfig.projectpath}/docpublicpages`;
  fut.checkAndMakeFolder(xconfig.docpublicpagepath);

  xconfig.integrationspath = `${xconfig.projectpath}/integrations`;
  fut.checkAndMakeFolder(xconfig.integrationspath);
}

// function getProjectProp(propname) {
//  return fut.readJsonFileSync(`${config.projectpath}/project.json`, true)[propname];
// }

function specifyProjectPath() {
  // Для изменения папки проектов - указать projdir - внутри создадим projects
  if (config.projdir) {
    fut.checkAndMakeFolder(config.projdir);
    config.projectspath = `${config.projdir}/projects`;
  } else {
    config.projectspath = `${config.vardir}/projects`;
  }
  fut.checkAndMakeFolder(config.projectspath);

  // Если проект не задан - стартуем с проектом project1
  config.project = config.project || 'project1';
  config.projectpath = `${config.projectspath}/${config.project}`;
  fut.checkAndMakeFolder(config.projectpath);

  console.log('INFO: Project folder: ' + config.projectpath);
}

function createApibootScriptIfNotExists(restapihandlerpath) {
  const filename = restapihandlerpath + '/apiboot.js';
  if (!fs.existsSync(filename)) {
    const script = `
  module.exports = async (holder) => { 
    console.log('INFO: Start apiboot')
  };
  `;
    return fs.writeFileSync(filename, script);
  }
}

function getSystemVersion() {
  return '5.5.114';
}
