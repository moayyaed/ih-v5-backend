/**
 * logger.js  
 *  Подменяет функцию консоли console.log 
 *  Сообщения пишутся в файл и (опционально) на консоль с помощью console.info
 * 
 *  Берутся только сообщения заданного формата - в первых 6 символах д.б. двоеточие  INFO: ERR: WARN: DEBUG: 
 *  Другие сообщения на console.log игнорируются
 *  Добавляется дата время с мс. 
 *   
 *  При превышении размера создается новый файл, к старому названию добавляется .ts (ih.log.147989672567)
 *  Удаление файлов должно выполняться отдельной утилитой  
 */

const fs = require('fs');

const hut = require('./hut');

const logger = exports;

logger.start = start;
logger.stop = stop;
logger.log = log;

/**
 * Старт логгера: 
 *  - получает параметры
 *  - открывает writeStream
 *  - подменяет  console.log 
 * 
 * @param {Object}
 *   logfile {String} - полный путь к файлу  
 *   sizeKB  {Number} - размер в Кб
 *   dubconsole {Boolean || 1|0} - выводить копию сообщений параллельно на консоль  
 */
function start({ logfile, sizeKB, dubconsole }) {

  logger.active = false;
  logger.logfile = logfile;
  logger.dubconsole = dubconsole;
  logger.fileSize = (Number(sizeKB) > 0 ? Number(sizeKB) : 128) * 1024;
  logger.currentFileSize = currentFileSize(logfile);
  logger.stream = createStream(logger.logfile);

  if (logger.stream) {
    replaceConsole(logger);
    logger.active = true;
  } else {
    console.log('Error stream creation for ' + logger.logfile + '! Logging to standard console.');
  }
}

/**
 * Приостановить работу логгера
 *  - восстановить консоль
 *  - закрыть поток
 */
function stop() {
  if (logger.stream) logger.stream.end();
  restoreConsole();
  logger.active = false;
}

/**
 * Функция, которая заменяет console.log
 * 
 * @param {String} str - сообщение для вывода
 */
function log(str) {

  // Отсечь консольные сообщения, не имеющие формата INFO:
  if (!str || typeof str != 'string') return;
  
  let levelname = str.split(':').shift();
  if (levelname.length > 7 || levelname.length < 4) return;

  str = hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + str;

  if (logger.dubconsole) console.info(str);
  if (logger.stream) write(str);
}

/**
 * Вывод в файл
 * Если размер превышен - записать в новый файл
 * @param {String} str - сообщение для вывода 
 */
function write(str) {
  logger.currentFileSize += str.length;

  if (logger.currentFileSize <= logger.fileSize) {
    logger.stream.write(str + '\r\n');
  } else {
    writeToNewFile(str);
  }
}

function writeToNewFile(str) {
  let dt = String(Date.now());
  logger.stream.end();
  logger.stream = null;
  logger.currentFileSize = 0;

  fs.rename(logger.logfile, logger.logfile + '.' + dt, (err) => {
    if (err) {
      stop();
      console.warn('ERR: Log file ' + logger.logfile + ' rename error!!!  Restored standard console.');
      return;
    }

    logger.stream = createStream(logger.logfile);
    logger.stream.write(str);
  });
}

function createStream(logfile) {
  return fs.createWriteStream(logfile, { flags: 'a', encoding: 'utf-8', mode: 0o666 });
}


function currentFileSize(file) {
  let fileSize = 0;
  try {
    fileSize = fs.statSync(file).size;
  } catch (e) {
    // file does not exist
    fs.appendFileSync(file, '');
  }
  return fileSize;
}


/**
 * Замена и восстановление консоли
 */
let originalConsoleFunctions = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
};

function replaceConsole() {
  console.log = logger.log;
}

function restoreConsole() {
  ['log', 'debug', 'info', 'warn', 'error'].forEach(item => {
    console[item] = originalConsoleFunctions[item];
  });
}

process.on('exit', () => {
    if (logger.stream) logger.stream.end(hut.getDateTimeFor(new Date(), 'shortdtms') + '  IH IntraHouse has stopped.\n\n');  
});