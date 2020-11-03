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

module.exports = function(holder) {
  return async (req, res) => {
    console.log('WARN: UPLOAD' + util.inspect(req, null, 5));
    let files;
    let targetFolder;
    const body = req.body;
    const nodes = [];

    try {
      if (!body.param) throw { error: 'BADREQ', message: 'Expected param for upload!' };
      files = getFiles();

      let promises;
      targetFolder = getTargetFolder(body.param);

      if (files[0].mimetype == 'application/zip') {
        const sourceFolder = await extractFromZip(files[0]);

        // Получить список файлов в папке - нужны только изображения
        const imageFiles = await getImageFiles(sourceFolder);
        if (!imageFiles) throw { message: 'Error read folder:' + sourceFolder };
        if (!imageFiles.length) throw { message: 'Image files not found!' };

        promises = saveFilesFromFolder(imageFiles, sourceFolder);
      } else {
        promises = saveFiles();
      }

      await Promise.all(promises);
      body.payload = { images: { nodes } };
      body.type = 'tree';
      body.id = 'resources';
      body.method = 'insert';
      // Удалить исходные файлы и папки

      console.log('WARN: BODY=' + util.inspect(body, null, 4));
      const dataObj = await postapi.tree.insert(body, holder);

      res.send(JSON.stringify(Object.assign({ response: 1 }, dataObj)));
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: uploadfiles ' + message);

      res.status(400).end('Error: ' + hut.getShortErrStr(message)); // 400 - Bad Request
    }

    function getFiles() {
      if (!req.files || typeof req.files != 'object') throw { error: 'BADREQ', message: 'Expected files for upload!' };
      if (!req.files.files || typeof req.files.files != 'object')
        throw { error: 'BADREQ', message: 'Expected files.files for upload!' };

      return !Array.isArray(req.files.files) ? [req.files.files] : req.files.files;
    }

    async function getImageFiles(src) {
      try {
        const arr = await fs.promises.readdir(src); // filenames only
        return arr.filter(item => hut.isImgFile(item));
      } catch (e) {
        console.log('ERROR: readdir ' + src + util.inspect(e));
      }
    }

    function saveFiles() {
      // Файлы из тела запроса
      const arr = [];
      files.forEach(file => {
        const fileExists = fs.existsSync(targetFolder + '/' + file.name);
        if (body.replace || !fileExists) {
          arr.push(saveOne(file.name, file.data, fileExists));
        }
      });
      return arr;
    }

    function saveFilesFromFolder(fileArr, fromFolder) {
      // Файлы из папки - получили список файлов
      const arr = [];
      fileArr.forEach(file_name => {
        const fileExists = fs.existsSync(targetFolder + '/' + file_name);
        if (body.replace || !fileExists) {
          arr.push(copyOne(file_name, fromFolder, fileExists));
        }
      });
      return arr;
    }

    async function copyOne(file_name, fromFolder, fileExists) {
      try {
        const fromFile = fromFolder + '/' + file_name;
        const toFile = targetFolder + '/' + file_name;
        await fs.promises.copyFile(fromFile, toFile);

        if (!fileExists) {
          nodes.push({ _id: file_name, title: file_name, name: file_name });
        }
      } catch (err) {
        console.log('ERROR: uploadfiles for item: ' + file_name + '. ' + util.inspect(err));
      }
    }

    async function saveOne(file_name, file_data, fileExists) {
      try {
        const filename = targetFolder + '/' + file_name;
        await fs.promises.writeFile(filename, file_data);

        if (!fileExists) {
          nodes.push({ _id: file_name, title: file_name, name: file_name });
        }
      } catch (err) {
        console.log('ERROR: uploadfiles for item: ' + file_name + '. ' + util.inspect(err));
      }
    }

    async function extractFromZip(file) {
      const name = file.name;
      const foldername = getFolderName(name);

      const zipfile = appconfig.getTmpZipPath(foldername);
      await fs.promises.writeFile(zipfile, file.data);

      const tempdir = appconfig.getTmpFolder(foldername);
      await wu.unzipP({ src: zipfile, dest: tempdir });
      return tempdir;
    }

    function saveFromZip(file) {
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
    /*
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
    */
  };
};

function getTargetFolder(param) {
  switch (param) {
    case 'image':
      return appconfig.getImagePath();
    default:
      return appconfig.getImagePath();
  }
}

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
