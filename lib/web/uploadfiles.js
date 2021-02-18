/**
 * uploadfiles.js
 *
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const fut = require('../utils/fileutil');
const postapi = require('../api/postapi');
const {importCSV}  = require('../utils/csvutil');

/**
 *  Middleware for /upload
 *
 * Загрузка файлов методом POST из дерева (не пакеты)
 *  body.param - тип контента
 *    "image" - загрузка одного или нескольких файлов или ОДИН zip архив
 *    "plugin" - zip архив плагина??
 *  zip грузится только первый!!
 *
 *
 *
 */
module.exports = function(holder) {
  return async (req, res) => {
    const body = req.body;
    const nodes = [];
    const toDelete = [];

    let sourceFolder;
    let targetFolder;
    let files;
    try {
      if (!body.param) throw { error: 'BADREQ', message: 'Expected param for upload!' };

      targetFolder = getTargetFolder(body.param);

      files = reqFiles();
      if (files[0].mimetype == 'application/zip') {
        sourceFolder = await extractFromZip(files[0]);
      }

      if (body.param == 'frontend') {
        uploadFrontend();
        res.send({ response: 1 });
      } if (body.param == 'channels') {
        // Загрузить каналы 
        // console.log('FILES='+util.inspect(files))
       
        if (files[0].mimetype != 'text/csv') throw { error: 'BADREQ', message: 'Expected .csv file for upload!' };
          await uploadCSV(files[0]);
          res.send({ response: 1 });
      } else {
        let promises;
        if (sourceFolder) {
          // Получить список файлов в папке
          const arr = await fs.promises.readdir(sourceFolder); // filenames only
          if (!arr) throw { message: 'Error read folder:' + sourceFolder };

          // Отобрать только нужные файлы - например, только изображения или index.html для frontend 
          const selectedFiles = selectByParam(arr, body.param);
          if (!selectedFiles.length) throw { message: body.param + '. ' + appconfig.getMessage('NoFilesOfThisType') };

          promises = saveFilesFromFolder(selectedFiles, sourceFolder);
        } else {
          promises = saveFiles();
        }

        await Promise.all(promises);
        body.payload = { images: { nodes } };
        body.type = 'tree';
        // body.id = 'resources';
        body.id = 'vis';
        body.method = 'insert';

        const dataObj = await postapi.tree.insert(body, holder);

        res.send(JSON.stringify(Object.assign({ response: 1 }, dataObj)));
      }
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: uploadfiles ' + message);
      res.status(400).end('Error: ' + hut.getShortErrStr(message)); // 400 - Bad Request
    }

    // Удалить исходные файлы и папки. Результат только логируется
    if (toDelete.length) {
      for (const pathToDelete of toDelete) {
        console.log('WARN: remove ' + pathToDelete);
        const result = fut.delFileOrFolderSync(pathToDelete);
        if (!result) console.log('ERROR: ' + pathToDelete + ' remove Failed!');
      }
    }


    function reqFiles() {
      if (!req.files || typeof req.files != 'object') throw { error: 'BADREQ', message: 'Expected files for upload!' };
      if (!req.files.files || typeof req.files.files != 'object')
        throw { error: 'BADREQ', message: 'Expected files.files for upload!' };

      return !Array.isArray(req.files.files) ? [req.files.files] : req.files.files;
    }

    function selectByParam(arr, param) {
      console.log(' selectByParam ' + param + ' arr=' + util.inspect(arr));

      switch (param) {
        case 'image':
          return arr.filter(item => hut.isImgFile(item));

        case 'frontend':
            return arr.filter(item => item.name == 'index.html');
  
        default:
          throw { message: 'Unexpected param for zip: ' + param };
      }
    }

    
    async function uploadCSV(file) {
      const param = body.param;
      const nodeid = body.previd;
      const data = file.data.toString('utf8');
      console.log('uploadCSV nodeid='+nodeid+' data='+data)
      switch (body.param) {
        case 'channels': 
             return importCSV({param, nodeid}, data, holder);
        default: throw {message:'Unknown param '+body.param+' for csv upload!'}
      }
    }

    function uploadFrontend() {
      fut.removeFolderSync(targetFolder);
      if (sourceFolder) {
        // Нужно удалить содержимое папки и копировать все заново
        fut.copySync(sourceFolder, targetFolder);
      } else {
        // Только index.html
        const selectedFiles = selectByParam(files, 'frontend');
        if (!selectedFiles.length) throw { message: body.param + '. ' + appconfig.getMessage('NoFilesOfThisType') };
        const file = selectedFiles[0]; 
        fs.writeFileSync(targetFolder+'/'+file.name, file.data);
      }
    }

    // Файлы из тела запроса files
    function saveFiles() {
      const arr = [];
      files.forEach(file => {
        const fileExists = fs.existsSync(targetFolder + '/' + file.name);
        if (body.replace || !fileExists) {
          arr.push(saveOne(file.name, file.data, fileExists));
        }
      });
      return arr;
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

    // Файлы из zip - получили список файлов
    function saveFilesFromFolder(fileArr, fromFolder) {
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

    async function extractFromZip(file) {
      try {
        const name = file.name;
        const foldername = getFolderName(name);

        const tempdir = appconfig.getTmpFolder(foldername);
        const zipfile = appconfig.getTmpZipPath(foldername);

        await fs.promises.writeFile(zipfile, file.data);
        await wu.unzipP({ src: zipfile, dest: tempdir });
        toDelete.push(zipfile);
        toDelete.push(tempdir);

        return tempdir;
      } catch (e) {
        console.log('ERROR: extractFromZip ' + util.inspect(e));
      }
    }
  };
};

function getTargetFolder(param) {
  let folder;
  switch (param) {
    case 'image':
      return appconfig.getImagePath();

    case 'frontend':
      folder = appconfig.get('projectfrontendpath');

      return folder;
    default:
      return appconfig.get('worktemppath');
  }
}

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
