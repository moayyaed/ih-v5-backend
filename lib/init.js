/**
 * init.js
 *  Запускается на старте
 *
 *  Загружает и формирует конфигурацию системы
 *  Создает папки, если их нет
 *  Загружает, проверяет и при необходимости выполняет upgrade проекта
 *
 *  Запускает системный логгер, который пишет в файл ih.log (перехват консоли)
 *  В случае неустранимой ошибки генерируется исключение
 */

const util = require('util');
const fs = require('fs');

const wrappers = require('./utils/wrappers');
const logger = require('./utils/logger');
const cleaner = require('./utils/cleaner');
const loadsys = require('./utils/loadsys');

const updateSystemPlugins = require('./sysupdate/updateSystemPlugins');
const upgradeProject = require('./sysupdate/upgradeProject');

const appconfig = require('./appconfig');
const dm = require('./datamanager');
const descriptor = require('./descriptor');

const am = require('./access/accessmanager');
const Accessmate = require('./access/accessmate');

const dbsInit = require('./dbs/init');
const datagetter = require('./domain/datagetter');
const datamaker = require('./domain/datamaker');
const isNoCache = require('./domain/isNocache');

module.exports = async function(appdir) {
  // Папки и файлы проектов общедоступны
  process.umask(0);

  appconfig.start(appdir);
  startLogger(appconfig.get('logpath'));

  const str = `------------------------------------------------------------------------
    Server has started 
    Service folder: ${appconfig.get('appdir')}
    Project folder: ${appconfig.get('projectpath')}
  `;
  console.log('INFO:' + str);

  // Очистить временный директорий
  try {
    const tmpFolder = appconfig.getTmpFolder();
    if (fs.existsSync(tmpFolder)) await wrappers.rmP(tmpFolder);
  } catch (e) {
    console.log('ERROR: tmpFolder remove: '+util.inspect(e));
  }

  await updateSystemPlugins();
  await checkDependences();

  appconfig.checkApiSymlink(appdir);
  await verifyProjectVersion(); // Проверить версию проекта

  await startDescriptor();
  await dm.start({ datagetter, datamaker, isNoCache });
  await dbsInit();

  await am.start(dm);
  new Accessmate(am).start();

  async function checkDependences() {
    try {
      return wrappers.installNodeModulesP(appdir); // Проверить  dependences из package.json. Если не установлено - установить
    } catch (e) {
      console.log('ERROR: checkDependences!');
    }
  }

  async function verifyProjectVersion() {
    let sysver = appconfig.projectVersionFromSystemVersion();
    // const sysver = '5.1';

    const project_version = appconfig.get('project_version') || '5.0'; // ?
    console.log('INFO: Versions System: ' + sysver + ' Project: ' + project_version);

    if (project_version >= sysver) return; // project_version > sysver - это форс-мажор

    await upgradeProject(appconfig.get('project'), project_version, sysver);
  }
};

async function startDescriptor() {
  // Запуск объекта-дескриптора, передать ему описание деревьев, таблиц и списков
  const tables = loadsys.loadAndTranslateJsonFileSync('dbs', 'tables');
  descriptor.start(
    loadsys.loadAndTranslateJsonFileSync('dbs', 'trees'),
    tables,
    loadsys.loadAndTranslateJsonFileSync('dbs', 'lists')
  );

  // Загрузить из каждого файла в папке tree (trees берет все файлы из папки tree)
  descriptor.setTreeDefaultComponents(await loadsys.loadMeta('trees'));
}

function startLogger(logpath) {
  // Запуск логгера
  // if (!result.standardconsole) {
  logger.start({ logfile: logpath + '/ih.log', dubconsole: false });
  // }
  cleaner.removeOldFiles(logpath, 5);
}
