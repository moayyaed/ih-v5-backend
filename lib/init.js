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

const appconfig = require('./appconfig');
const datamanager = require('./datamanager');
const wrappers = require('./utils/wrappers');

module.exports = async function (appdir) {
  // Папки и файлы проектов общедоступны
  process.umask(0);
  appconfig.start(appdir);
  console.log('appdir='+appdir)
  await wrappers.installNodeModulesP(appdir); // Проверить  dependences из package.json. Если не установлено - установить
  await verifyProjectVersion(); // Проверить версию проекта
  await datamanager.start();

  async function verifyProjectVersion() {
    console.log('verifyProjectVersion');
  }
}
