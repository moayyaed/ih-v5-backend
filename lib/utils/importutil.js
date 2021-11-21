/**
 * importutil.js
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('./hut');
const fut = require('./fileutil');
const wu = require('./wrappers');

/**
 *
 * @param {Object} file
 *         - name
 *         - data
 * @return {xfolder:'имя папки с извлеченными данными',toDelete:[]}
 */
async function extractFromZip(file) {
  let xfolder;
  const toDelete = [];
  try {
    const name = file.name;
    const foldername = hut.getFolderNameForZip(name);

    const tempdir = appconfig.getTmpFolder(foldername);
    const zipfile = appconfig.getTmpZipPath(foldername);

    await fs.promises.writeFile(zipfile, file.data);
    await wu.unzipP({ src: zipfile, dest: tempdir });
    toDelete.push(zipfile);
    toDelete.push(tempdir);

    // Если архив помещен внуть папки, то войти внутрь
    let tfiles = await fs.promises.readdir(tempdir);
    if (!tfiles || !tfiles.length) throw { message: 'Empty content extracted from ' + zipfile };

    let innerfolder;
    let fileCount = 0;
    for (const xfile of tfiles) {
      // Не берем скрытые файлы
      if (!xfile.startsWith('.')) {
        const stats = await fs.promises.stat(tempdir + '/' + xfile);
        if (stats.isDirectory()) {
          // Если папка начинается на __ - это служебная '__MACOSX'
          if (!xfile.startsWith('__')) innerfolder = xfile;
        } else fileCount++;
      }
    }
    xfolder = fileCount > 0 ? tempdir : innerfolder ? tempdir + '/' + innerfolder : '';
  } catch (e) {
    console.log('ERROR: extractFromZip ' + util.inspect(e));
  }
  return { toDelete, xfolder };
}

function deleteIfNeed(toDelete) {
  // Удалить исходные файлы и папки. Результат только логируется
  if (!toDelete || !toDelete.length) return;

  for (const pathToDelete of toDelete) {
    const result = fut.delFileOrFolderSync(pathToDelete);
    if (!result) console.log('ERROR: ' + pathToDelete + ' remove Failed!');
  }
}

/**
 *
 * @param {Object} req - request object from middleware
 * @return {Array}
 * @throw
 */
function getReqFiles(req) {
  if (!req || !req.files || typeof req.files != 'object') throw { message: 'Expected files for upload!' };
  if (!req.files.files || typeof req.files.files != 'object') throw { message: 'Expected files.files for upload!' };
  return !Array.isArray(req.files.files) ? [req.files.files] : req.files.files;
}

module.exports = {
  getReqFiles,
  extractFromZip,
  deleteIfNeed
};
