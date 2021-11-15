/**
 * misc.js
 */

// const util = require('util');
const appconfig = require('../appconfig');
// const hut = require('../utils/hut');
const liststore = require('../dbs/liststore');

const emObj = { '0': '❏', '1': '✔︎', '2': '✘' };

function formTitle(listname, item) {
  let emo;
  switch (listname) {
    case 'deviceList':
      return item.dn + ' ▪︎ ' + item.name;
    case 'sceneList':
      // emo = emObj[item.status] || emObj['0'];
      // return emo + ' ' + item.name;
      return item.name;

    case 'unitList':
      return item.id;

    case 'projectList':
      emo = item.active ? emObj[1] + ' ' : '';
      return emo + item.title;

    case 'dbagentList':
      emo = item.active ? emObj[1] + ' ' : '';
      return emo + item.title;
    default:
      return item.title || item.name;
  }
}


function getWhenStr(rec, op, prop) {
  if (prop.startsWith('_format')) {
    // При выводе значения "value" в виде строки
    return getMes('When_OutputValue') + ' "' + prop.substr(8) + '" ' + getMes('asString');
  }
  if (prop.startsWith('_On')) {
    if (prop == '_OnChange') {
      let str = rec.par_OnChange
        ? rec.par_OnChange != '*'
          ? 'свойств ' + rec.par_OnChange
          : ' любого свойства устройства'
        : '';

      if (rec.par2_OnChange && rec.par2_OnChange != '-') {
        const item = liststore.getItemFromList('globalList', rec.par2_OnChange);
        const glDn = item && item.dn ? item.dn : rec.par2_OnChange + '(имя не определено?)';
        if (str) str += ', ';
        str += ' глобальной переменной ' + glDn;
      }
      if (!str) str = getMes('ConditionNotSET!');
      return 'При изменении ' + str;
    }

    if (prop == '_OnInterval')
      return 'Циклически каждые ' + (rec.par_OnInterval != undefined ? rec.par_OnInterval : 600) + getMes('_sec');

    if (prop == '_OnSchedule') return getMes('When_Schedule') + ': ' + rec.par_OnSchedule;

    if (prop == '_OnBoot') return getMes('When_SystemStarting');
  }

  switch (op) {
    case 'calc':
      // При изменении свойств устройства для вычисления "status"
      return getMes('When_ChangeDevPropsForCalc') + ' "' + prop + '"';
    case 'cmd':
      //  'При вызове команды "toggle"
      return getMes('When_CommandCall') + ' "' + prop + '"';
    default:
      // 'При поступлении данных для приема значения "state"
      return getMes('When_IncomingData') + ' "' + prop + '"';
  }
}

function getFormUrl(name, id, prop) {
  switch (name) {
    case 'Device':
    case 'DeviceTable':
      return getDeviceFormUrl(id);
    case 'DeviceDb':
      return getDeviceDbFormUrl(id);
    case 'SceneCodeEditor':
      return 'allscenes/scenes/scenescript/' + id + '/tabSceneCodeEditor';
    case 'SceneCommon':
      return 'allscenes/scenes/scenescript/' + id + '/tabSceneCommon';
    case 'SchedruleCommon':
      return 'allscenes/schedrules/schedrule/' + id + '/tabSchedruleCommon';
    case 'TypeProps':
      return 'dev/types/typeview/' + id + '/tabTypeProps';
    case 'typeprophandler':
      return 'dev/types/typeview/' + id + '/tabTypeHandlers/typeprophandler/' + id + '.' + prop;
    case 'DialogEditor':
      return 'vis/dialog/dialogview/' + id + '/tabDialogEditor';
    case 'VistemplateEditor':
      return 'vis/vistemplate/vistemplateview/' + id + '/tabVistemplateEditor';
    case 'LayoutEditor':
      return 'vis/layout/layoutview/' + id + '/tabLayoutEditor';
    case 'ViscontEditor':
      return 'vis/viscont/viscontview/' + id + '/tabViscontEditor';
    case 'RestapiCodeEditor':
      return 'datasource/restapihandlers/restapihandlerscript/' + id + '/tabRestapiCodeEditor';
    default:
      return '';
  }
}

function getDeviceFormUrl(did) {
  switch (getDeviceKind(did)) {
    case 'gl':
      return 'dev/globals/globalview/' + did + '/tabGlobalCommon';
    case 'sys':
      return 'dev/sysdevices/sysdeviceview/' + did + '/tabSysDeviceTable';
    default:
      return 'dev/devices/deviceview/' + did + '/tabDeviceTable';
  }
}

function getDeviceDbFormUrl(did) {
  switch (getDeviceKind(did)) {
    case 'gl':
      return 'dev/globals/globalview/' + did + '/tabGlobalCommon';
    case 'sys':
      return 'dev/sysdevices/sysdeviceview/' + did + '/tabSysDeviceDb';
    default:
      return 'dev/devices/deviceview/' + did + '/tabDeviceDb';
  }
}

function getDeviceKind(did) {
  if (isSysDevice(did)) return 'sys';
  if (isGlobal(did)) return 'gl';
  return 'device';
}

function isSysDevice(did) {
  return did.startsWith('__');
}

function isGlobal(did) {
  return did && did.startsWith('gl');
}

function getMes(id) {
  return appconfig.getMessage(id);
}

module.exports = {
  formTitle,
  isGlobal,
  getFormUrl,
  getWhenStr
};
