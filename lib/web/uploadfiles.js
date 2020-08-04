/**
 * uploadfiles.js
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const fut = require('../utils/fileutil');

module.exports = function uploadfiles(req, res) {
  // console.log('WARN: ' + util.inspect(req, null, 5));
  let files;

  try {
    files = req.files.files;
    if (!files || typeof files != 'object') throw { message: 'Expected files.files for upload!' };

    if (!Array.isArray(files)) {
      files = [files];
    }

    let targetFolder = appconfig.getImagePath();

    if (files[0].mimetype == 'application/zip') {
      saveFromZip(files[0], targetFolder);
    } else {
      saveFiles(targetFolder);
    }
  } catch (err) {
    res.status(400).end('Error: ' + util.inspect(err));
  }

  function saveFiles(folder) {
    let count = 0;
    let errcount = 0;

    let promise = Promise.resolve();
    files.forEach(file => {
      promise = promise.then(() => saveOne(file));
    });

    promise.then(() => {
      res.send('Uploaded ' + count + ' files' + (errcount ? ' failed ' + errcount + ' files' : ''));
    });

    function saveOne(file) {
      return new Promise(resolve => {
        const filename = folder + '/' + file.name;
        fs.promises
          .writeFile(filename, file.data)
          .then(() => {
            count++;
            resolve();
          })
          .catch(err => {
            errcount++;
            console.log('ERROR: uploadfiles for item: ' + util.inspect(file) + '. ' + util.inspect(err));
            resolve();
          });
      });
    }
  }

  function saveFromZip(file, targetFolder) {
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
        // Копировать в images текущего проекта - Куда надо??
        console.log('WARN: Copy from ' + tempdir + ' to  ' + targetFolder, 'UPLOAD');
        return wu.cpP({ src: tempdir, dest: targetFolder });
      })
      .then(() => {
        // Удалить исходники
        fut.delFileSync(zipfile);
        fut.delFolderSync(tempdir);
        res.send('OK');
      })
      .catch(e => {
        res.status(500).end('Upload error: ' + hut.shortenErrResponse(e));
      });
  }
};

/** 
  iterate(0);
  function iterate(index) {
    if (index === files.length) {
      res.send('Uploaded ' + count + ' files'+(errcount ? ' failed ' + errcount + ' files' : ''));
      return;
    }
    const file = files[index];
    const filename = folder + '/' + file.name;

    fs.writeFile(filename, file.data, err => {
      if (err) {
        errcount++;
        console.log('ERROR: uploadfiles for item: ' + util.inspect(file) + '. ' + util.inspect(err));
      } else {
        count++;
      }
      iterate(index + 1);
    });
  }
  */

/*
     // const params = JSON.parse(req.body.params);
    switch (params.type) {
      case 'imagelist':
        imagelist(name, data, params, res);
        break;

      case 'image':
        image(name, data, params, res);
        break;
      case 'plugin':
   */

function getFolderName(filename) {
  return hut.allTrim(
    hut
      .getFileNameExtLess(filename)
      .toLowerCase()
      .replace(/[()[\]]/g, '')
  );
}

/*
files: {
    files: {
      name: ' actor_blk.png',
      data: <Buffer 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52 00 00 01 fb 00 00 02 a9 08 02 00 00 00 34 47 12 e4 00 00 00 01 73 52 47 42 00 ae ce 1c e9 00 00 00 09 ... 67305 more bytes>,
      size: 67355,
      encoding: '7bit',
      tempFilePath: '',
      truncated: false,
      mimetype: 'image/png',
      md5: '6a0e5cdee28cc8f58cb9c2481d89a6e8',
      mv: [Function: mv]
    }
  },
*/
