/**
 * init.js
 *  Запускается на старте
 *
 *  Загружает и формирует конфигурацию системы
 *  Создает папки, если их нет
 *  Загружает, проверяет и при необходимости выполняет upgrade проекта
 *
 *  Запускает логгер??
 *  В случае неустранимой ошибки генерируется исключение
 */

// const util = require('util');
const fs = require('fs');
const child = require('child_process');

const wrappers = require('./utils/wrappers');
const hut = require('./utils/hut');
const logger = require('./utils/logger');
const cleaner = require('./utils/cleaner');
const loadsys = require('./utils/loadsys');

const updateutil = require('./utils/updateutil');

const appconfig = require('./appconfig');
const dm = require('./datamanager');
const descriptor = require('./descriptor');

const dbsInit = require('./dbs/init');
const appcrypto = require('./utils/appcrypto');
const hwid = require('./utils/hwid');

const datagetter = require('./appspec/datagetter');
const datamaker = require('./appspec/datamaker');
const isNoCache = require('./domain/isNocache');
const logconnector = require('./logconnector');

module.exports = async function(appdir) {
  // Папки и файлы проектов общедоступны
  process.umask(0);
  appconfig.start(appdir);
  startLogger(appconfig.get('logpath'));

  const str = `------------------------------------------------------------------------
    IH has started 
    Service folder: ${appconfig.get('appdir')}
    Project folder: ${appconfig.get('projectpath')}
  `;
  console.log('INFO:' + str);

  await checkDependences();

  appconfig.checkApiSymlink(appdir);
  await verifyProjectVersion(); // Проверить версию проекта

  logconnector.start(forkLogagent('sqlite'));

  await startDescriptor();
  await dm.start({ datagetter, datamaker, isNoCache, logconnector });
  await dbsInit();

  dm.insertToLog('pluginlog', { unit: 'system', txt: 'Start IH system' });

  hwid().then(res => {
    appconfig.set('hwid', res);
    appcrypto.start(appconfig.get('sysbasepath') + '/keys/publicAuth.pem', res);
  });


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

    await updateutil.projectUpgrade(appconfig.get('project'), project_version, sysver);
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

function forkLogagent(agent) {
  try {
    const modulepath = appconfig.getLogagentModule(agent);
    if  (!fs.existsSync(modulepath)) throw { message: 'Not found ' + modulepath };

    const options = {
      dbPath: appconfig.get('logbasepath')+'/log.db',
      logfile: appconfig.get('logpath') + '/ih_' + agent + '_logagent.log',
      loglevel: 1
    };

    const ps = child.fork(modulepath, [JSON.stringify(options)]);
    if (!ps) throw { message: 'Fork error: ' + modulepath };
    return ps;
  } catch (e) {
    console.log('ERROR: Logagent: ' + hut.getShortErrStr(e) + ' User logs will be unavailable!');
  }
}

function startLogger(logpath) {
  // Запуск логгера
  // if (!result.standardconsole) {
  logger.start({ logfile: logpath + '/ih.log', dubconsole: false });
  // }
  cleaner.removeOldFiles(logpath, 5);
}
