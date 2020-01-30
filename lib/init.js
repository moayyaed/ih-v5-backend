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


const appconfig = require('./utils/appconfig');
const wrappers = require('./utils/wrappers');

// const lang = require('./utils/lang');

exports.startP = function startP(appdir) {
  // Папки и файлы проектов общедоступны
  process.umask(0);
  // return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    // Формировать объект appconfig: конфигурация и проект.
    appconfig
      .startP(appdir)
      .then(() => wrappers.installNodeModulesP(appdir)) // Проверить  dependences из package.json. Если не установлено - установить
      .then(() => {
        verifyProjectVersion(); // Проверить версию проекта
        console.log(appconfig.getMessage('QSURE'))
        resolve();
      }) 
      .catch(e => {
        console.log(e, '', 'INIT');
        reject(e);
      });
  });
  

  function verifyProjectVersion() {
    console.log('verifyProjectVersion')
    return Promise.resolve();
  }
  

};
