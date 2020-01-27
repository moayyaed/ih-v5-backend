/**
 *  fileutil.js - утилиты работы с файлами
 */

// const util = require('util');
const fs = require('fs');
const path = require('path');

/**
 * Синхронные функции чтения и записи. Возбуждают исключение при ошибке!
 */

/**
 * Проверка папки
 *  @param {String} folder
 *  @throw если папки не существует
 */
function checkFolder(folder) {
  if (!fs.existsSync(folder)) throw new Error(`Folder not found: ${folder}`);
}

/**
 * Проверка папки, создать если не существует
 *  @param {String} folder
 *  @throw при ошибке создания
 */
function checkAndMakeFolder(folder) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
  return folder;
}

/**
 * Чтение файлов из папки
 *    @param {String} folder
 *    @param {Object} opt: {ext:'json', dir:1}
 *              .ext - выбрать файлы с расширением
 *              .dir - выбрать только папки
 *    @return {Array} - массив имен файлов
 *
 *    При ошибке чтения возвращает пустой массив
 */
function readFolderSync(folder, opt) {
  try {
    if (!folder) throw new Error('Folder not defined!');
    if (!fs.existsSync(folder)) throw new Error('Folder not found!');

    const result = fs.readdirSync(folder);

    // Выбрать по расширению
    if (opt && opt.ext) return result.filter(file => file.endsWith(opt.ext));
    // Выбрать только папки
    if (opt && opt.dir) return result.filter(file => fs.statSync(folder + '/' + file).isDirectory());
    return result;
  } catch (e) {
    console.log('ERR: readFolderSync ' + folder + '. ' + e.message);
    return [];
  }
}

/** Удалить содержимое папки  рекурсивно, включая поддиректории
 *  @param {String} folder
 *  @throw при ошибке удаления
 */
function removeFolderContentSync(folder) {
  if (fs.existsSync(folder)) {
    fs.readdirSync(folder).forEach(file => {
      const f = folder + '/' + file;
      const stats = fs.lstatSync(f);
      if (stats.isDirectory(f)) {
        removeFolderSync(f);
      } else {
        fs.unlinkSync(f);
      }
    });
  }
}

/** Удалить папку  рекурсивно, включая поддиректории
 *  @param {String} folder
 *  @throw при ошибке удаления
 */
function removeFolderSync(folder) {
  if (fs.existsSync(folder)) {
    removeFolderContentSync(folder);
    fs.rmdirSync(folder); // удалить саму папку
  }
}

/**
 * Копирование папки рекурсивно или файла
 *  @param {String} src - имя источника (папка или файл)
 *  @param {String} dest- имя приемника
 *  @throw при ошибке копирования
 */
function copySync(src, dest) {
  if (fs.existsSync(src)) {
    let stats = fs.statSync(src);

    if (stats.isDirectory()) {
      fs.mkdirSync(dest);
      fs.readdirSync(src).forEach(childItemName => {
        copySync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      fs.writeFileSync(dest, fs.readFileSync(src));
    }
  }
}

function readJsonFileSync(filename, nothrow) {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (e) {
    if (!nothrow) throw { message: 'readJsonFileSync:' + filename + '. ' + e.message };
    console.log('WARN: Reading ' + filename + '. ' + e.message);
    return {};
  }
}

function writeJsonFileSync(filename, data, nothrow) {
  try {
    data = JSON.stringify(data);
    fs.writeFileSync(filename, data, 'utf8');
  } catch (e) {
    if (!nothrow) throw { message: 'writeJsonFileSync:' + filename + '. ' + e.message };
    console.log('ERR: Writing ' + filename + '. ' + e.message);
  }
}

function writeValToJsonFileSilent(filename, prop, val) {
  if (!prop) return;

  let data = readJsonFileSync(filename, true);
  if (typeof prop == 'object') {
    Object.keys(prop).forEach(key => {
      data[key] = prop[key];
    });
  } else {
    data[prop] = val;
  }
  writeJsonFileSync(filename, data, true);
}

/** Получить время модификации файла
 *
 * 2019-06-22T03:36:54.584Z
 */
function getModifyTime(file) {
  try {
    return fs.statSync(file).mtime;
  } catch (e) {
    console.log('Error read file ' + file + '. ' + e.message);
    return -1;
  }
}

/** Получить время модификации файла как timestamp **/
function getModifyTimeMs(file) {
  try {
    return Math.round(fs.statSync(file).mtimeMs);
  } catch (e) {
    console.log('Error read file ' + file + '. ' + e.message);
    return -1;
  }
}

/**
 *
 *  @param {*} file
 *  @param {*} mode
 * Возбуждает исключение при ошибке!!
 */
function checkFileAndChangeModeSync(file, mode) {
  if (!file) return;
  if (!fs.existsSync(file)) throw { message: 'File not found ' + file };
  let stat = fs.statSync(file);
  if (stat.mode != mode) {
    fs.chmodSync(file, mode);
  }
}

function delFileSync(file) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
  } catch (e) {
    console.log('ERR: Error delFileSync for  ' + file + ': ' + e.message);
  }
}

module.exports = {
  checkFolder,
  checkAndMakeFolder,
  readFolderSync,
  removeFolderSync,
  removeFolderContentSync,
  copySync,

  readJsonFileSync,
  writeJsonFileSync,
  writeValToJsonFileSilent,

  getModifyTime,
  getModifyTimeMs,
  checkFileAndChangeModeSync,
  delFileSync
};
