/**
 * uploadfiles.js
 * Middleware for /upload
 *
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const fut = require('../utils/fileutil');
const postapi = require('../api/postapi');

const importPack = require('../utils/importPack');

/**
 *
 * Загрузка файлов методом POST из дерева (не пакеты)
 *  body.param - тип контента
 *    "image" - загрузка одного или нескольких файлов или ОДИН zip архив
 *    "plugin" - zip архив плагина
 *
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

      files = reqFiles();
      if (files[0].mimetype == 'application/zip') {
        sourceFolder = await extractFromZip(files[0]);
      }

      if (body.param.indexOf(':') > 0) {
        const [param, format] = body.param.split(':');

        if (format != 'csv') throw { error: 'BADREQ', message: 'Unexpected format ' + format }; // Пока только csv

        // if (files[0].mimetype != 'text/csv') throw { error: 'BADREQ', message: 'Expected .csv file for upload!' };

        const data = files[0].data.toString('utf8');
        const resObj = await holder.dm.datamaker.importDocs({ param, format, nodeid: body.previd, data }, holder);
        if (!resObj.response) {
          console.log('ERROR: import ' + param + '\n' + resObj.message);
          throw { error: 'BADREQ', message: 'Данные содержат ошибки! См лог системы ' };
        }
        res.json(resObj);
        // res.json({ response: 1, ...resObj });
      } else {
        let param = body.param;

        targetFolder = getTargetFolder(body.param);

        if (param == 'frontend') {
          uploadFrontend();
          res.send({ response: 1 });
        } else if (param == 'plugin') {
          if (!appconfig.isPlugin(sourceFolder)) throw { message: 'Файл не содержит плагин!' };
          await importPack(sourceFolder, '', holder);
          res.send({ response: 1 });
        } else if (param == 'dbagent') {
          if (!appconfig.isDbagent(sourceFolder)) throw { message: 'Файл не содержит БД агент!' };
          // Если есть файл dbagent.ih - это dbagent
          await importPack(sourceFolder, '', holder);
          res.send({ response: 1 });
        } else {
          const promises = await formPromises(body.param, sourceFolder);
          await Promise.all(promises);
          const dataObj = await formResponseData();
          res.send(JSON.stringify(Object.assign({ response: 1 }, dataObj)));
        }
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

    function formResponseData() {
      switch (body.param) {
        case 'image':
          body.payload = { images: { nodes } };
          body.type = 'tree';
          body.id = 'vis';
          body.method = 'insert';
          return postapi.tree.insert(body, holder);
        default:
      }
      return {};
    }

    async function formPromises(param, sFolder) {
      if (sFolder) {
        // Получить список файлов в папке - из zip архива
        const arr = await fs.promises.readdir(sFolder); // filenames only
        if (!arr) throw { message: 'Error read folder:' + sFolder };

        // Отобрать только нужные файлы - например, только изображения или index.html для frontend
        const selectedFiles = selectByParam(arr, param);
        if (!selectedFiles.length) throw { message: param + '. ' + appconfig.getMessage('NoFilesOfThisType') };

        return saveFilesFromFolder(selectedFiles, sFolder);
      }
      return saveFiles();
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
        fs.writeFileSync(targetFolder + '/' + file.name, file.data);
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

        // Если архив помещен внуть папки, то войти внутрь
        const tfiles = await fs.promises.readdir(tempdir);
        if (!tfiles || !tfiles.length) throw { message: 'Empty content extracted from ' + zipfile };

        if (tfiles.length > 1) return tempdir;

        // Если архив внутри папки - войти внутрь
        const one = tempdir + '/' + tfiles[0];
        const stats = await fs.promises.stat(one);
        return stats.isDirectory() ? one : tempdir;
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
