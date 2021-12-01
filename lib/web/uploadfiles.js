/**
 * uploadfiles.js
 * Middleware for /upload
 *
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const postapi = require('../api/postapi');
const syscommand = require('../api/syscommand');

const importutil = require('../utils/importutil');
const importdata = require('../domain/importdata');
const importmethods = require('../domain/importmethods');

/**
 *
 * Загрузка файлов методом POST из дерева (не пакеты)
 *
 * Контент приходит в req.files
 *   mimetype == 'application/zip'| 'image/png' | ...
 *
 *  body.param - идентификатор контента, например
 *    = "image" - загрузка одного или нескольких файлов или ОДИН zip архив
 *    = "plugin" - zip архив плагина
 *    Может быть составным, с указанием формата:
 *   = "channels:csv"
 *
 *  !!zip грузится только один (первый)
 */
module.exports = function(holder) {
  return async (req, res) => {
    const body = req.body;

    let toDelete;
    let sourceFolder;
    let files;
    let systemRestart;
    try {
      if (!body.param) throw { error: 'BADREQ', message: 'Expected param for upload!' };

      files = importutil.getReqFiles(req);
      if (files[0].mimetype == 'application/zip') {
        const xres = await importutil.extractFromZip(files[0]);
        if (!xres.xfolder) throw { message: 'Empty zip archive!' };
        sourceFolder = xres.xfolder;
        toDelete = xres.toDelete;
      }

      if (body.param.indexOf(':') > 0) {
        // Указан формат данных
        const [param, format] = body.param.split(':');
        if (!format || !importmethods[format] || !importmethods[format][param])
          throw { message: 'Unexpected format ' + format };

        const data = files[0].data.toString('utf8');
        const resObj = await importmethods[format][param]({ data, nodeid: body.previd }, holder);

        if (!resObj.response) {
          console.log('ERROR: import ' + param + '\n' + resObj.message);
          throw { message: 'Данные содержат ошибки! См лог системы ' };
        }

        if (param == 'devices') {
          systemRestart = true;
        }

        res.json(resObj);
        console.log('param='+param+' systemRestart='+systemRestart)

      } else if (body.param == 'frontend') {
        uploadFrontend(appconfig.get('projectfrontendpath'));
        res.send({ response: 1 });

      } else {
        let dataObj = await importdata.importByParam(body, sourceFolder, files, holder);
        if (dataObj.treeInsert) {
          dataObj = await postapi.tree.insert(dataObj.treeInsert, holder);
        }
        res.send(JSON.stringify(Object.assign({ response: 1 }, dataObj)));
      }
      
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: uploadfiles ' + util.inspect(err));
      res.status(400).end('Error: ' + hut.getShortErrStr(message)); // 400 - Bad Request
    }
    importutil.deleteIfNeed(toDelete);

    // Если требуется перезагрузка - перезагрузить
    if (systemRestart) {
     //  syscommand.exec({command:'restart'}, holder);
    }

    function uploadFrontend(targetFolder) {
      fut.removeFolderSync(targetFolder);
      if (sourceFolder) {
        // Нужно удалить содержимое папки и копировать все заново
        fut.copySync(sourceFolder, targetFolder);
      } else {
        // Только index.html
        const selectedFiles = files.filter(item => item.name == 'index.html');
        if (!selectedFiles.length) throw { message: body.param + '. ' + appconfig.getMessage('NoFilesOfThisType') };
        const file = selectedFiles[0];
        fs.writeFileSync(targetFolder + '/' + file.name, file.data);
      }
    }
  };
};

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
