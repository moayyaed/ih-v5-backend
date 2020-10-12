/**
 * importPack.js
 *  Модуль извлекает из пакета элементы и добавляет в проект
 *  Возвращает массив добавленных файлов и идентификаторов ??
 *  Если не удалось извлечь - ???
 */

const util = require('util');
const fs = require('fs');
// const path = require('path');

const appconfig = require('../appconfig');
// const hut = require('./hut');
const wu = require('./wrappers');
const fut = require('./fileutil');
// const loadsys = require('./loadsys');

module.exports = async function(query, options) {
  if (!query || !query.nodeid || !query.param) return '';
}

function loadFromZip(file, targetFolder) {
  // if (!name.endsWith('.zip')) return Promise.reject({ message: 'Expected .zip file!' });
  const name = file.name;

  const foldername = getFolderName(name);

  const tempdir = appconfig.getTmpFolder(foldername);
  const zipfile = appconfig.getTmpZipPath(foldername);

  fs.promises
    .writeFile(zipfile, file.data)
    .then(() => {
      // Разархивировать
      console.log('WARN: Uploaded file has saved to ' + zipfile + '. Unzip to  ' + tempdir);
      return wu.unzipP({ src: zipfile, dest: tempdir });
    })
    .then(() => {
      // Копировать только файлы, подходящие по расширению и только верхнего уровня вложенности 
      console.log('WARN: Copy from ' + tempdir + ' to  ' + targetFolder, 'UPLOAD');
      // Поместить список файлов в files
      return wu.cpP({ src: tempdir, dest: targetFolder });
    })
    .then(() => {
      // Удалить исходники
      fut.delFileSync(zipfile);
      fut.delFolderSync(tempdir);
     
    })
    .catch(e => {
      res.status(400).end('Upload error: ' + hut.shortenErrResponse(e));
    });
}

