/**
 * Project upgrade 5.4 => 5.5
 *
 * 1. В файлах экранов, компонентов, шаблонов, диалогов
 *  Для каждого elements[key] c  типом input и slider
 *  - заменить type на новый исходя из variant
 *  - добавить свойства исходя из нового type
 *
 *
 */

const util = require('util');
const fs = require('fs');

// const fut = require('../lib/utils/fileutil');



const VARIANTS = {
  slider: {
    android: {
      type: 'slider_android',
      autoHideLabel: { value: false },
      labelSize: { value: 14 },
      trackStep: { value: 1 },
      labelColor: { value: 'rgba(0,0,0,0.87)' },
      trackColorLeft: { value: 'rgba(25,118,210,1)' },
      trackColorRight: { value: 'rgba(25,118,210,1)' },
      thumbColor: { value: 'rgba(25,118,210,1)' }
    },
    // ios
    ios: {
      type: 'slider_ios',
      autoHideLabel: { value: false },
      labelSize: { value: 14 },
      trackStep: { value: 1 },
      labelColor: { value: 'rgba(0,0,0,0.87)' },
      trackColorLeft: { value: 'rgba(56,128,255,1)' },
      trackColorRight: { value: 'rgba(191,191,191,1)' },
      thumbColor: { value: 'rgba(255,255,255,1)' }
    },

    // pretto
    pretto: {
      type: 'slider_pretto',
      autoHideLabel: { value: false },
      labelSize: { value: 14 },
      trackStep: { value: 1 },
      labelColor: { value: 'rgba(255,255,255,1)' },
      trackColorLeft: { value: 'rgba(82,175,119,1)' },
      trackColorRight: { value: 'rgba(82,175,119,1)' },
      thumbColor: { value: 'rgba(82,175,119,1)' }
    },

    // airbnb
    airbnb: {
      type: 'slider_airbnb',
      autoHideLabel: { value: false },
      labelSize: { value: 14 },
      trackStep: { value: 1 },
      labelColor: { value: 'rgba(255,255,255,1)' },
      trackColorLeft: { value: 'rgba(58,133,137,1)' },
      trackColorRight: { value: 'rgba(216,216,216,1)' },
      thumbColor: { value: 'rgba(58,133,137,1)' }
    }
  },
  input: {
    minimal: {
      type: 'input_classic',
      normalColor: { value: 'rgba(0,0,0,0.54)' },
      hoverColor: { value: 'rgba(0,0,0,0.87)' },
      activeColor: { value: 'rgba(25,118,210,1)' }
    },
    standard: {
      type: 'input_modern',
      normalColor: { value: 'rgba(0,0,0,0.54)' },
      hoverColor: { value: 'rgba(0,0,0,0.87)' },
      activeColor: { value: 'rgba(25,118,210,1)' }
    },
    filled: {
      type: 'input_filled',
      normalColor: { value: 'rgba(0,0,0,0.54)' },
      hoverColor: { value: 'rgba(0,0,0,0.87)' },
      activeColor: { value: 'rgba(25,118,210,1)' },
      backdropColor: { value: 'rgba(0,0,0,0.09)' }
    },
    outlined: {
      type: 'input_outlined',
      normalColor: { value: 'rgba(0,0,0,0.54)' },
      hoverColor: { value: 'rgba(0,0,0,0.87)' },
      activeColor: { value: 'rgba(25,118,210,1)' }
    }
  }
};


const DEF_VARIANT = {
  slider:'android',
  input:'minimal'
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

function update(data) {
  if (!data || !data.elements) throw { message: 'Not found elements!' };

  Object.keys(data.elements).forEach(name => {
    const d = data.elements[name];

    if (d.type == 'slider' || d.type == 'input') {
      let variant = d.variant && d.variant.value && d.variant.value.id ? d.variant.value.id : DEF_VARIANT[d.type];
      delete d.variant;
      if (!VARIANTS[d.type][variant]) variant = DEF_VARIANT(d.type);
     
      Object.assign(d, VARIANTS[d.type][variant]);
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
