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

const wrappers = require('./utils/wrappers');
// const hut = require('./utils/hut');
const logger = require('./utils/logger');
const cleaner = require('./utils/cleaner');
const loadsys = require('./utils/loadsys');

const appconfig = require('./appconfig');
const dm = require('./datamanager');
const descriptor = require('./descriptor');

const dbsInit = require('./dbs/init');

module.exports = async function(appdir) {
  // Папки и файлы проектов общедоступны
  process.umask(0);
  appconfig.start(appdir);
  console.log('appdir=' + appdir);

  // startLogger(appconfig.get('logpath'));
  // console.log('INFO:');
  // console.log('INFO:');
  console.log('INFO: IntraHouse has started ');

  await wrappers.installNodeModulesP(appdir); // Проверить  dependences из package.json. Если не установлено - установить
  appconfig.checkApiSymlink(appdir);
  await verifyProjectVersion(); // Проверить версию проекта

  await descriptorInit();
  await dm.start();
  await dbsInit();

  async function verifyProjectVersion() {
    console.log('verifyProjectVersion');
  }
};

async function descriptorInit() {
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
