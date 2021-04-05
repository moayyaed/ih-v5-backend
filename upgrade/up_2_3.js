/**
 * Project upgrade 5.2 => 5.3
 *
 * В файлах экранов, компонентов, шаблонов, диалогов
 *  Для каждого elements[key]
 *    - изменено имя свойства на _lable (label || title || key)
 *
 */

const util = require('util');
const fs = require('fs');


module.exports = async function(projectPath) {
  transform(getFileList(`${projectPath}/jbase/layout`));
  transform(getFileList(`${projectPath}/jbase/container`));
  transform(getFileList(`${projectPath}/jbase/template`));
  transform(getFileList(`${projectPath}/jbase/dialog`));
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
    let _label = name;
    if (d.label && typeof d.label == 'string') {
      _label = d.label;
      delete d.label;
    } else if (d.title && typeof d.title == 'string') {
      _label = d.title;
      delete d.title;
    }
    d._label = _label;
    console.log('INFO: '+targetStr+ ' element ' + name + ' _label:'+d._label);
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
