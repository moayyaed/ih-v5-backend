/**
 * exportdata.js
 * Функции экспорта и подготовки к экспорту на прикладном уровне
 * 
 */

// const util = require('util');

const appconfig = require('../appconfig');

const hut = require('../utils/hut');
const exportPack = require('../utils/exportPack');
const exportmethods = require('./exportmethods');


async function exportOne(query, holder) {
  if (query.format) {
    if (exportmethods[query.format] && exportmethods[query.format][query.param]) {
      return exportmethods[query.format][query.param](query, holder);
    }
    throw { message: 'Not found exportmethod for ' + query.param + ', format ' + query.format };
  }

  switch (query.param) {
    case 'image':
      return exportPack.exportImage(query, holder);
    case 'extlog':
      return exportPack.exportLog(query, holder);
    case 'project':
      return exportPack.exportProject(query, holder);
    case 'plugin':
      return exportPack.exportPlugin(query, holder);
    default:
      return exportPack.exec(query, holder);
  }
}

async function prepareToExport(query, user, holder) {
  if (!query.nodeid) throw { error: 'ERRGET', message: 'Missing nodeid!' };
  if (!query.param) throw { error: 'ERRGET', message: 'Missing param!' };

  if (query.param == 'image') return prepareToExportImage(query, holder);
  if (query.param == 'sound') return prepareToExportSound(query, holder);

  let data;
  const packExport = ['template', 'dialog', 'container', 'type', 'project']; // Выгружаются как ihpack
  if (packExport.includes(query.param)) {
    const title = 'Export: ' + query.param + ' ' + query.nodeid;
    const url = getExportUrl(query);
    const filename = await exportPack.formPackName(query, '', holder);
    data = { title, url, filename };
  } else if (query.param == 'plugin') {
    const plugin = getPluginName(query.nodeid);
    const title = 'Export plugin ' + plugin;
    const url = getExportUrl({ param: query.param, nodeid: plugin });
    const filename = plugin + '.zip';
    data = { title, url, filename };
  } else if (query.param == 'extlog') {
    // Выгрузка лога
    const title = 'Export ' + query.nodeid + ' log';
    const url = getExportUrl(query);
    const filename = 'ih_' + query.nodeid + '.log';
    data = { title, url, filename };
  } else if (query.param.indexOf(':') > 0) {
    // Прикладного уровня
    // channels:csv devices:csv
    const [param, format] = query.param.split(':');
    const nodeid = param == 'devices' ? '' : query.nodeid;
    const title = 'Export: ' + param + ' ' + nodeid;
    const url = getExportUrl({ param, nodeid, format });
    const filename = (param == 'devices' ? 'devices' : query.nodeid) + '.' + format;
    data = { title, url, filename };
  } else {
    throw { error: 'ERRGET', message: 'Unexpected param for export!' };
  }
  return { data };
}

function getExportUrl({ param, nodeid, format }) {
  return '/api/export?param=' + param + '&nodeid=' + nodeid + (format ? '&format=' + format : '');
}

function getPluginName(id) {
  return id && id.startsWith('plugin_') ? id.substr(7) : id;
}

/**
 * Подготовка к выгрузке одного файла изображения или несколько файлов внутри папки
 *
 * @param {Object} query
 *   nodeid: имя файла изображения или id папки
 * @param {Object} holder
 */
async function prepareToExportImage(query, holder) {
  const url = getExportUrl(query);
  const nodeid = query.nodeid;

  let data;
  // Если это id файла с изображением
  if (hut.isImgFile(nodeid)) {
    data = { title: nodeid, filename: nodeid, url };
  } else {
    const doc = await holder.dm.findRecordById('imagegroup', nodeid);
    if (!doc) throw { message: 'Not found imagegroup ' + nodeid };

    // Это папка - выбрать все файлы, посчитать их
    const imagegrid = await holder.dm.getImagegrid(nodeid);

    const imgArr = imagegrid ? imagegrid.data : '';

    if (!imgArr || !imgArr.length) throw { message: doc.name + '. ' + appconfig.getMessage('EmptyFolder') };

    const title = `${imgArr.length} ${appconfig.getMessage('filesFromFolder')} ${doc.name}`;
    data = { title, url, filename: query.nodeid + '.zip' };
  }
  return { data };
}

/**
 * Подготовка к выгрузке одного файла изображения или несколько файлов внутри папки
 *
 * @param {Object} query
 *   nodeid: имя файла изображения или id папки
 * @param {Object} holder
 */
async function prepareToExportSound(query, holder) {
  const url = getExportUrl(query);
  const nodeid = query.nodeid;

  let data;
  // Если это id файла 
  if (hut.isSoundFile(nodeid)) {
    data = { title: nodeid, filename: nodeid, url };
  } else {
    const doc = await holder.dm.findRecordById('soundgroup', nodeid);
    if (!doc) throw { message: 'Not found soundgroup ' + nodeid };

    // Это папка - выбрать все файлы, посчитать их
    const arr = await holder.dm.getIdsFromTree('sounds', nodeid);

    if (!arr || !arr.length) throw { message: doc.name + '. ' + appconfig.getMessage('EmptyFolder') };

    const title = `${arr.length} ${appconfig.getMessage('filesFromFolder')} ${doc.name}`;
    data = { title, url, filename: query.nodeid + '.zip' };
  }
  return { data };
}

module.exports = {
  exportOne,
  prepareToExport
}