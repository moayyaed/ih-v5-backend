/**
 * import.js
 *
 * Middleware for POST /import
 *
 * Загрузка пакетов (не в дереве)
 */
const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const fut = require('../utils/fileutil');
const auth = require('./auth');

const importPack = require('../utils/importPack');

module.exports = function(holder) {
  return async (req, res) => {
    // console.log('WARN: IMPORT' + util.inspect(req, null, 5));
    const token = req.headers.token;
    const body = req.body;
    const watchid = body.watch && body.uuid ? body.uuid : 'xxx';

    let tempFolder;
    let zipfile;
    let errMsg = '';
    try {
      const files = getFiles(req);
      await checkAccess(token);

      zipfile = files[0];
      tempFolder = await loadFromZip(zipfile);
      if (!tempFolder) throw { message: 'Error zip extract!' };
      // После загрузки - отправляем ответ
      await sleep(1200);
      res.send(JSON.stringify(Object.assign({ response: 1 })));
    } catch (err) {
      errMsg = (err && err.message) ?  err.message : util.inspect(err);
      console.log('ERROR: import ' + errMsg);
      res.status(400).end('Error: ' + hut.getShortErrStr(errMsg)); // Bad request - invalid syntax
      emitWatch(errMsg, 'error');
    } 
    // Удалить исходник
    fut.delFileSync(zipfile);
    if (errMsg) {
      if (tempFolder) fut.delFileOrFolderSync(tempFolder);
      return;
    }


    // console.log('WARN: before install from ' +tempFolder);
    // Дальше сообщения о процессе идут через watch
    try {
      await importPack(tempFolder, watchid, holder);
      emitWatch('', 'complete');
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: import ' + message);
      emitWatch(message, 'error');
    }
    // Здесь можно сразу отписывать watchid, т к он завершен?
    // Удалить временную папку
    fut.delFileOrFolderSync(tempFolder);


    function emitWatch(message, status) {
      console.log('WARN: emitWatch uuid=' + watchid + ' ' + message);
      if (watchid && holder) {
        holder.emit('watch', { uuid: watchid, message, status });
      }
    }
  };
};

function getFiles(req) {
  let files;
  if (!req.files || typeof req.files != 'object') throw { error: 'BADREQ', message: 'Expected files for upload!' };

  files = req.files.files;
  if (!files || typeof files != 'object') throw { error: 'BADREQ', message: 'Expected files.files for upload!' };

  if (!Array.isArray(files)) files = [files];
  return files;
}

async function checkAccess(token) {
  const user = await auth.getUserByToken(token);
  if (!user || !user.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };
  if (user.role != 'admin') throw { message: 'Недостаточно прав! Операция не разрешена!' };
}

async function loadFromZip(file) {
  const name = file.name;

  const foldername = hut.getFolderNameForZip(name);
  const tempdir = appconfig.getTmpFolder(foldername);
  const zipfile = appconfig.getTmpZipPath(foldername);

  try {
    await fs.promises.writeFile(zipfile, file.data);

    // Разархивировать
    console.log('WARN: Uploaded file has saved to ' + zipfile + '. Unzip to  ' + tempdir);
    await wu.unzipP({ src: zipfile, dest: tempdir });

    // Если архив помещен внуть папки, то войти внутрь
    const files = await fs.promises.readdir(tempdir);
    if (!files || !files.length) throw { message: 'Empty content extracted from ' + zipfile };
    if (files.length > 1) return tempdir;

    // Если этот файл - единственная папка - войти внутрь
    const one = path.join(tempdir, files[0]);
    const stats = await fs.promises.stat(one);
    return stats.isDirectory() ? one : tempdir;
  } catch (e) {
    console.log('Upload error: ' + hut.shortenErrResponse(e));
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
