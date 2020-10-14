/**
 * import.js
 *
 * Middleware for POST /import
 *
 * Загрузка пакетов (не в дереве)
 */
const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const fut = require('../utils/fileutil');

const importPack = require('../utils/importPack');

module.exports = function(holder) {
  return async (req, res) => {

    const body = req.body;
    // console.log('WARN: IMPORT' + util.inspect(req, null, 5));
    const watchid = body.watch && body.uuid ? body.uuid : 'xxx';
   
    let files;
    let tempFolder;
    try {
      if (!req.files || typeof req.files != 'object') throw { error: 'BADREQ', message: 'Expected files for upload!' };

      files = req.files.files;
      if (!files || typeof files != 'object') throw { error: 'BADREQ', message: 'Expected files.files for upload!' };

      if (!Array.isArray(files)) files = [files];
  
      tempFolder = await loadFromZip(files[0]);
      if (!tempFolder) throw { message: 'Error zip extract!' };
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: uploadfiles ' + message);
      emitWatch(message, 'error');
      res.status(400).end('Error: ' + hut.getShortErrStr(message)); // Bad request - invalid syntax
      return;
    }

    let dataObj;
    try {
      dataObj = await importPack(tempFolder, watchid, holder);
      emitWatch('', 'complete');
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: uploadfiles ' + message);
      dataObj = { message };
      emitWatch(message, 'error');
    }
    // Здесь можно сразу отписывать watchid, т к он завершен??
    res.send(JSON.stringify(Object.assign({ response: 1 }, dataObj)));

    function emitWatch(message, status) {
      console.log('WARN: emitWatch uuid=' + watchid + ' ' + message);
      if (watchid && holder) {
        holder.emit('watch', { uuid: watchid, message, status });
      }
    }
  };
};

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

    // Удалить исходник
    fut.delFileSync(zipfile);
    return tempdir;
  } catch (e) {
    console.log('Upload error: ' + hut.shortenErrResponse(e));
  }
}
