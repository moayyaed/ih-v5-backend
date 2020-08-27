/**
 * uploadfiles.js
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const fut = require('../utils/fileutil');
const postapi = require('../api/postapi');

// module.exports = function uploadfiles(req, res) {
module.exports = function(holder) {
  return async (req, res) => {
    // console.log('WARN: UPLOAD' + util.inspect(req, null, 5));
    let files;
    const body = req.body;

    try {
      if (!req.files || typeof req.files != 'object') throw { error: 'BADREQ', message: 'Expected files for upload!' };

      files = req.files.files;
      if (!files || typeof files != 'object') throw { error: 'BADREQ', message: 'Expected files.files for upload!' };

      if (!Array.isArray(files)) {
        files = [files];
      }

      if (!body.param) throw { error: 'BADREQ', message: 'Expected param for upload!' };
      body.type = 'tree';
      body.id = 'resources';
      body.method = 'insert';

      const targetFolder = getTargetFolder(body.param);
      if (files[0].mimetype == 'application/zip') {
        saveFromZip(files[0], targetFolder);
      } else {
        saveFiles(targetFolder);
      }
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: uploadfiles ' + message);

      res.status(400).end('Error: ' + hut.getShortErrStr(message));
      // res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }

    function getTargetFolder(param) {
      switch (param) {
        case 'image':
          return appconfig.getImagePath();
        default:
          return appconfig.getImagePath();
      }
    }

    function saveFiles(folder) {
      const nodes = [];

      let promise = Promise.resolve();
      files.forEach(file => {
        const fileExists = fs.existsSync(folder + '/' + file.name);
        if (body.replace || !fileExists) {
          promise = promise.then(() => saveOne(file, fileExists));
        }
      });

      promise
        .then(() => {
          body.payload = { images: { nodes } };
          console.log('WARN: BODY=' + util.inspect(body, null, 4));
          return postapi.tree.insert(body, holder);
        })
        .then(dataObj => {
          res.send(JSON.stringify(Object.assign({ response: 1 }, dataObj)));
        });

      function saveOne(file, fileExists) {
        return new Promise(resolve => {
          const filename = folder + '/' + file.name;

          fs.promises
            .writeFile(filename, file.data)
            .then(() => {
              if (!fileExists) {
                nodes.push({ _id: file.name, title: file.name, name: file.name });
              }
              resolve();
            })
            .catch(err => {
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
          // Копировать только файлы, подходящие по расширению и только верхнего уровня вложенности 
          console.log('WARN: Copy from ' + tempdir + ' to  ' + targetFolder, 'UPLOAD');
          // Поместить список файлов в files
          return wu.cpP({ src: tempdir, dest: targetFolder });
        })
        .then(() => {
          // Удалить исходники
          fut.delFileSync(zipfile);
          fut.delFolderSync(tempdir);
          res.send('OK');
        })
        .catch(e => {
          res.status(400).end('Upload error: ' + hut.shortenErrResponse(e));
        });
    }

    async function saveFilesFromZip(tempdir, folder) {
      const nodes = [];
      // Считать папку tempdir - только файлы с подходящими расщирениями
      files = await getFiles(tempdir, body.param);
      let promise = Promise.resolve();
      files.forEach(file => {
        const fileExists = fs.existsSync(folder + '/' + file);
        if (body.replace || !fileExists) {
          promise = promise.then(() => copyOne(file, fileExists));
        }
      });

      promise
        .then(() => {
          body.payload = { images: { nodes } };
          console.log('WARN: BODY=' + util.inspect(body, null, 4));
          return postapi.tree.insert(body, holder);
        })
        .then(dataObj => {
          res.send(JSON.stringify(Object.assign({ response: 1 }, dataObj)));
        });

      function copyOne(file, fileExists) {
        return new Promise(resolve => {
          const from = folder + '/' + file;
          const to = folder + '/' + file;

          fs.promises
            .copyFile(from, to)
            .then(() => {
              if (!fileExists) {
                nodes.push({ _id: file.name, title: file.name, name: file.name });
              }
              resolve();
            })
            .catch(err => {
              console.log('ERROR: uploadfiles for item: ' + util.inspect(file) + '. ' + util.inspect(err));
              resolve();
            });
        });
      }
    }
  };
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
