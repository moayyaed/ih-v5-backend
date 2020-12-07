/**
 * Project upgrade 5.0 => 5.1
 *
 */

const util = require('util');
const fs = require('fs');

const hut = require('../lib/utils/hut');

function getFileList(path) {
  if (fs.existsSync(path)) {
    return fs
      .readdirSync(path)
      .filter(file => fs.lstatSync(`${path}/${file}`).isFile())
      .map(item => `${path}/${item}`);
  }
  return [];
}

function saveFile(path, data) {
  fs.writeFileSync(path, JSON.stringify(data), 'utf8');
}

function getFile(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function getToTransfer(data, parentProp, propArr) {
  const res = {};
  if (!data[parentProp]) throw { message: 'Not found parentProp ' + parentProp + '!' };

  const parentObj = data[parentProp];
  propArr.forEach(prop => {
    if (parentObj[prop]) {
      res[prop] = hut.clone(parentObj[prop]);
    }
  });
  return res;
}

function removeTransfered(data, parentProp, propArr) {
  propArr.forEach(prop => {
    if (data[parentProp][prop]) {
      delete data[parentProp][prop];
    }
  });
  return data;
}

function getId(pathStr) {
  return pathStr
    .split('/')
    .pop()
    .split('.')[0];
}

function updateLayout(data, transferObj) {
  if (!data || !data.elements) throw { message: 'Not found elements!' };

  Object.keys(data.elements).forEach(name => {
    const d = data.elements[name];
    if (d.type && d.type == 'container' && d.containerId) {
      if (d.containerId.id) {
        const id = d.containerId.id;
        const title = d.title || 'Container ' + id;
        d.widgetlinks = { link: { id, title } };

        // Добавить объекты transferObj по id
        Object.assign(d, transferObj[id]);
      }
      // Удалить containerId
      delete d.containerId;
      console.log('Layout element '+name+util.inspect(data.elements[name]))
    }
  });
  return data;
}

module.exports = async function(projectPath) {
  const list_l = getFileList(`${projectPath}/jbase/layout`);
  const list_c = getFileList(`${projectPath}/jbase/container`);

  // container - выбрать из setting свойства fitW, fitH, alignW, alignH, scrollX, scrollY и здесь удалить
  //   (сохранить и перенести в layout - соотв контейнер)
  const props = ['fitW', 'fitH', 'alignW', 'alignH', 'scrollX', 'scrollY'];
  const toTransfer = {}; // <cont_id:{fitW, fitH, alignW, alignH, scrollX, scrollY }
  list_c.forEach(path => {
    try {
      const old = getFile(path);
      const id = getId(path);
      toTransfer[id] = getToTransfer(old, 'settings', props);
      const data = removeTransfered(old, 'settings', props);
      saveFile(path, data);
    } catch (e) {
      const errStr = typeof e == 'object' && e.message ? e.message : util.inspect(e);
      console.log('ERROR: Upgrade project, file ' + path + ': ' + errStr + '. Skipped');
    }
  });

  console.log('toTransfer =' + util.inspect(toTransfer, null, 4));

  // layout
  //  - найти elements.type=container
  //  - добавить элементы из settings по containerId
  //  - добавить widgetlinks: {link: {id: <containerId> , title: <title>}}
  //  - containerId и title верхнего уровня удалить
  list_l.forEach(path => {
    try {
      const old = getFile(path);
      const data = updateLayout(old, toTransfer);
      saveFile(path, data);
    } catch (e) {
      const errStr = typeof e == 'object' && e.message ? e.message : util.inspect(e);
      console.log('ERROR: Upgrade project, file ' + path + ': ' + errStr + '. Skipped');
    }
  });
};
