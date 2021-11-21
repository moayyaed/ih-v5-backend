/**
 * importdata.js
 *
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const importPack = require('../utils/importPack');

async function importByParam(body, sourceFolder, files, holder) {
  const param = body.param;
  const nodes = [];
  const targetFolder = getTargetFolder(param);
  switch (param) {
    case 'plugin':
      if (!appconfig.isPlugin(sourceFolder)) throw { message: 'Файл не содержит плагин!' };
      return importPack(sourceFolder, '', holder);

    case 'dbagent':
      if (!appconfig.isDbagent(sourceFolder)) throw { message: 'Файл не содержит БД агент!' };
      return importPack(sourceFolder, '', holder);

    default:
      return commonData();
  }

  async function commonData() {
    const promises = await formPromises(sourceFolder);
    await Promise.all(promises);
    return formResponseData();
  }

  function formResponseData() {
    const treeInsert = { ...body };
    switch (param) {
      case 'image':
        treeInsert.payload = { images: { nodes } };
        treeInsert.type = 'tree';
        treeInsert.id = 'vis';
        treeInsert.method = 'insert';
        return { treeInsert };

      case 'sound':
        treeInsert.payload = { sounds: { nodes } };
        treeInsert.type = 'tree';
        treeInsert.id = 'resources';
        treeInsert.method = 'insert';
        return { treeInsert };

      case 'docimage':
        treeInsert.payload = { docimages: { nodes } };
        treeInsert.type = 'tree';
        treeInsert.id = 'documentation';
        treeInsert.method = 'insert';
        return { treeInsert };
      default:
    }
    return {};
  }

  async function formPromises() {
    if (!sourceFolder) return saveFiles(); // Файлы из тела запроса files

    // Пришел zip архив - получить список файлов в папке
    const arr = await fs.promises.readdir(sourceFolder); // filenames only
    if (!arr) throw { message: 'Error read folder:' + sourceFolder };

    // Отобрать только нужные файлы - например, только изображения или index.html для frontend
    const selectedFiles = selectByParam(arr, param);

    if (!selectedFiles.length) throw { message: param + '. ' + appconfig.getMessage('NoFilesOfThisType') };
    return saveFilesFromFolder(selectedFiles, sourceFolder);
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
}

function selectByParam(arr, param) {
  switch (param) {
    case 'image':
    case 'docimage':
      return arr.filter(item => hut.isImgFile(item));

    case 'sound':
      return arr.filter(item => hut.isSoundFile(item));

    default:
      throw { message: 'Unexpected param for zip: ' + param };
  }
}

function getTargetFolder(param) {
  switch (param) {
    case 'image':
      return appconfig.getImagePath();

    case 'sound':
      return appconfig.get('soundpath');

    case 'docimage':
      return appconfig.getDocImagePath();

    default:
      return appconfig.get('worktemppath');
  }
}

module.exports = {
  importByParam
};
