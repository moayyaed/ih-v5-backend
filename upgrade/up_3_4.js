/**
 * Project upgrade 5.3 => 5.4
 *
 * 1. В файлах экранов, компонентов, шаблонов, диалогов
 *  Для каждого elements[key] c  типом input и template добавить свойства
 *
 * 2. Удаляются неиспользуемые папки проекта
 *
 */

const util = require('util');
const fs = require('fs');

const fut = require('../lib/utils/fileutil');

const addToInput = {
  textSize: { value: 16 },
  textColor: { value: 'rgba(0,0,0,0.87)' },
  labelColor: { value: 'rgba(0,0,0,0.54)' },
  labelColorHover: { value: 'rgba(25,118,210,1)' },
  baseColor: { value: 'rgba(0,0,0,0.09)' },
  baseColorHover: { value: 'rgba(0,0,0,0.13)' },
  underlineColor: { value: 'rgba(0,0,0,0.42)' },
  underlineColorHover: { value: 'rgba(0,0,0,0.87)' },
  underlineColorSelect: { value: 'rgba(25,118,210,1)' }
};

const addToTemplate = {
  animation: {},
  borderSize: { value: 0 },
  borderRadius: { value: 0 },
  borderStyle: { value: { id: 'solid', title: 'Solid' } },
  borderColor: { value: 'rgba(0,0,0,1)' },
  backgroundColor: {
    type: 'fill',
    value: 'transparent',
    fill: 'transparent',
    angle: 90,
    shape: 'circle',
    positionX: 50,
    positionY: 50,
    extent: 'closest-side',
    palette: [
      { offset: '0.00', color: '#4A90E2', opacity: 1 },
      { offset: '1.00', color: '#9013FE', opacity: 1 }
    ]
  },
  rotate: { value: 0 },
  flipH: { value: false },
  flipV: { value: false },
  boxShadow: { active: false, value: '2px 2px 4px 0px #000000' }
};

module.exports = async function(projectPath) {
  console.log('INFO: Update project layouts');
  transform(getFileList(`${projectPath}/jbase/layout`));
  console.log('INFO: Update project containers');
  transform(getFileList(`${projectPath}/jbase/container`));
  console.log('INFO: Update project templates');
  transform(getFileList(`${projectPath}/jbase/template`));
  console.log('INFO: Update project dialogs');
  transform(getFileList(`${projectPath}/jbase/dialog`));


  console.log('INFO: Remove unused files and folders');
  fut.removeFolderSync(`${projectPath}/bigbase`);
  fut.removeFolderSync(`${projectPath}/logbase`);
  fut.removeFolderSync(`${projectPath}/history`);
};

function transform(list) {
  if (!list || !list.length) return;

  list.forEach(path => {
    try {
      const old = getFile(path);
      const data = update(old, path);
      saveFile(path, data);
    } catch (e) {
      const errStr = typeof e == 'object' && e.message ? e.message : util.inspect(e);
      console.log('ERROR: Upgrade project, file ' + path + ': ' + errStr + '. Skipped');
    }
  });
}

function update(data, targetStr) {
  if (!data || !data.elements) throw { message: 'Not found elements!' };

  Object.keys(data.elements).forEach(name => {
    const d = data.elements[name];

    if (d.type == 'input') {
      Object.assign(d, addToInput);
    } else if (d.type == 'template') {
      Object.assign(d, addToTemplate);
    }
    // console.log('INFO: ' + targetStr + ' element ' + name + ' _label:' + d._label);
  });
  return data;
}

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
