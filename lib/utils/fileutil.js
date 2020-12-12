/**
 *  fileutil.js - утилиты работы с файлами
 *
 *  Асинхронные функции возвращают promise
 *  Синхронные функции возбуждают исключение при ошибке
 */

// const util = require('util');
const fs = require('fs');
const path = require('path');

/**
 * Асинхронные функции возвращают promise
 */
async function readFileP(filename) {
  return fs.promises.readFile(filename, 'utf8');
}

async function writeFileP(filename, data) {
  const str = typeof data == 'object' ? JSON.stringify(data) : data;
  return fs.promises.writeFile(filename, str, 'utf8');
}

async function copyFileP(fromfile, tofile) {
  const str = await fs.promises.readFile(fromfile, 'utf8');
  return fs.promises.writeFile(tofile, str, 'utf8');
}

async function readdirP(dir) {
  return fs.promises.readdir(dir);
}

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
 * Создать пустую папку. Если существует - содержимое удалить
 *  @param {String} folder
 *  @throw при ошибке создания
 */
function createEmptyFolder(folder) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  } else {
    removeFolderContentSync(folder);
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
    console.log('ERROR: fuleutil.getModifyTime error for file: ' + file + '. ' + e.message);
    return 0;
  }
}

/** Получить время модификации файла как timestamp **/
function getModifyTimeMs(file) {
  try {
    return Math.round(fs.statSync(file).mtimeMs);
  } catch (e) {
    console.log('ERROR: fuleutil.getModifyTimeMs error for file: ' + file + '. ' + e.message);
    return 0;
  }
}

/** Получить время модификации файла как timestamp **/
async function getModifyTimeMsP(file) {
  try {
    const stat = await fs.promises.stat(file);

    return stat ? Math.round(stat.mtimeMs) : 0;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.log('ERROR: fuleutil.getModifyTimeMsP error for file: ' + file + '. ' + e.message);
    }
    return 0;
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
    console.log('ERROR: fileutil.delFileSync for  ' + file + ': ' + e.message);
  }
}

/** Удалить папку  рекурсивно, включая поддиректории **/
function delFileOrFolderSync(pathToDelete, onlyContent) {
  try {
    const stats = fs.statSync(pathToDelete);

    return stats.isDirectory() ? delFolderSync(pathToDelete, onlyContent) : delFileSync(pathToDelete);
  } catch (e) {
    return false;
  }
}

/** Удалить папку  рекурсивно, включая поддиректории **/
function delFolderSync(folder, onlyContent) {
  let filelist;

  try {
    filelist = fs.readdirSync(folder);
    if (!Array.isArray(filelist)) {
      throw { name: 'FileError', message: 'Error reading folder ' + folder };
    }

    for (let i = 0; i < filelist.length; i++) {
      let stats = fs.statSync(folder + '/' + filelist[i]);
      if (stats.isDirectory()) {
        delFolderSync(folder + '/' + filelist[i]);
      } else {
        fs.unlinkSync(folder + '/' + filelist[i]);
      }
    }

    if (!onlyContent) {
      fs.rmdirSync(folder); // удалить саму папку
    }
    return true;
  } catch (e) {
    console.log('ERR: Error delFolderSync ' + folder + ': ' + e.message);
    return false;
  }
}

async function readLogTail(file, bytes) {
  const NEW_LINE_CHARACTERS = '\n';
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(file)) return reject({ message: 'File not found: ' + file });

    fs.stat(file, (err, stats) => {
      if (err) return reject(err);
      // if (!stats.size) resolve('File '+file+' is empty.');

      const startByte = stats.size > bytes ? stats.size - bytes : 0;
      fs.createReadStream(file, {
        start: startByte,
        end: stats.size
      }).addListener('data', data => {
        const str = data.toString();
        let result = '';
        if (str) {
          let idx = str.indexOf(NEW_LINE_CHARACTERS);
          result = idx > 0 && idx + 1 < str.length ? str.substr(idx) : str;
        }
        resolve(result);
      });
    });
  });
}

module.exports = {
  readFileP,
  writeFileP,
  readdirP,
  copyFileP,

  checkFolder,
  checkAndMakeFolder,
  createEmptyFolder,
  readFolderSync,
  removeFolderSync,
  removeFolderContentSync,
  copySync,
  checkFileAndChangeModeSync,
  delFileSync,
  delFolderSync,
  delFileOrFolderSync,

  readJsonFileSync,
  writeJsonFileSync,
  writeValToJsonFileSilent,

  getModifyTime,
  getModifyTimeMs,
  getModifyTimeMsP,
  readLogTail
};
