/**
 * Служебные функции по удалению файлов
 */
const util = require('util');
const fs = require('fs');

const hut = require('./hut');

const moduleName = 'Cleaner';

/** Удалить файлы c расширением .7657576576 (архивные), если их стало больше count **/
async function removeOldFiles(path, count) {
  const warnMsg = 'WARN: ' + moduleName + '.removeOldFiles ERROR! ';
  try {
    const arr = await fs.promises.readdir(path);
    if (!arr || !util.isArray(arr)) {
      console.log(warnMsg);
      return;
    }

    const res = arr.filter(file => hut.isStringMatch(hut.getFileExt(file), /[0-9]/));
    if (res.length <= 0) return;

    // Упорядочить по расширению - по времени
    res.sort();

    // Оставить count самых последних файлов, остальные удалить
    if (res.length > count) {
      for (let i = 0; i < res.length - count; i++) {
        fs.unlink(path + '/' + res[i], err => {
          // Результата не ждем, но в случае ошибки запишем в Лог
          if (err) console.log(warnMsg + util.inspect(err) + ' File: ' + path + '/' + res[i]);
        });
      }
    }
  } catch (e) {
    console.log(warnMsg + util.inspect(e));
  }
}

module.exports = {
  removeOldFiles
};
