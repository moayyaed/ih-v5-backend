/**
 * init.js
 *  Запускается на старте
 *
 *  Загружает и формирует конфигурацию системы
 *  Создает папки, если их нет
 *  Загружает, проверяет и при необходимости выполняет upgrade проекта
 *
 *  Инициализирует хранилище данных jdb
 *  Запускает логгер??
 *  В случае неустранимой ошибки генерируется исключение
 */

// const util = require('util');
// const fs = require('fs');
// const path = require('path');

const appconfig = require('./utils/appconfig');
const jdb = require('./dbs/jstore');
const hut = require('./utils/hut');
const wrappers = require('./utils/wrappers');

const lang = require('./utils/lang');

exports.startP = function startP(appdir) {
  // Папки и файлы проектов общедоступны
  process.umask(0);

  return new Promise((resolve, reject) => {
    // Формировать объект appconfig: конфигурация и проект.
    appconfig
      .startP(appdir)
      .then(() => wrappers.installNodeModulesP(appconfig.config.appdir)) // Проверить  dependences из package.json. Если не установлено - установить
      .then(() => verifyProjectVersion()) // Проверить версию проекта
      .then(() => jdb.start()) // Формировать объект - хранилище динамических данных и настроек
      .catch(e => {
        hut.logErr(e, '', 'INIT');
        reject(e);
      });
  });

  function verifyProjectVersion() {
    return Promise.resolve();
  }
};
