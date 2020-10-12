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
    // const body = req.body;
    // console.log('WARN: UPLOAD' + util.inspect(req, null, 5));

    let files;
    try {
      if (!req.files || typeof req.files != 'object') throw { error: 'BADREQ', message: 'Expected files for upload!' };

      files = req.files.files;
      if (!files || typeof files != 'object') throw { error: 'BADREQ', message: 'Expected files.files for upload!' };

      if (!Array.isArray(files)) {
        files = [files];
      }

      // if (files[0].mimetype != 'application/zip') {
      const tempFolder = await loadFromZip(files[0]);
      if (!tempFolder) throw { message: 'Error zip extract!' };

      await importPack();

    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: uploadfiles ' + message);

      res.status(400).end('Error: ' + hut.getShortErrStr(message));
      // res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };
};


async function loadFromZip(file, targetFolder) {
  // if (!name.endsWith('.zip')) return Promise.reject({ message: 'Expected .zip file!' });
  const name = file.name;

  const foldername = hut.getFolderName(name);

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
      // Удалить исходник
      fut.delFileSync(zipfile);
      fut.delFolderSync(tempdir);
    })
    .catch(e => {
      // res.status(400).end('Upload error: ' + hut.shortenErrResponse(e));
    });
}
