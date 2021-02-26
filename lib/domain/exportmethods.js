/**
 * importmethods.js
 *
 *  Методы выгрузки прикладного уровня
 *  Формируют файл(ы) для выгрузки
 *
 *  Возвращают объект { name:полный путь к файлу, folder:если несколько файлов - полный путь к папке,  error }
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const dataformer = require('../api/dataformer');

const CSV = require('../utils/csvutil');

async function exportDevices(query, holder) {
  // поля получить от плагина
  const props = { type: 'string', dn: 'string', name: 'string' };

  const columns = Object.keys(props);

  // Выгружать в порядке дерева
  const tree = await dataformer.getCachedTree('devdevices', holder.dm);
  const treeItems = docsFromTree(tree.children);

  const docs = [];
  for (const item of treeItems) {
    if (!item.folder) {
      // Для записей - листьев вытащить данные из таблицы
      const onedoc = await holder.dm.findRecordById('device', item.id);
      if (onedoc) {
        // Копировать свойства, которые выгружаем
        docs.push({ ...formOneObj(onedoc), did: item.id, parent_id: item.parent_id,  });
      }
    } else {
      // Для папок - только folder_title, parent_title
      docs.push({ folder_id: item.id, folder_title: item.title, parent_id: item.parent_id });
    }
  }

  columns.unshift('did');
  columns.unshift('parent_id');
  columns.unshift('folder_title');
  columns.unshift('folder_id');
  const dataStr = CSV.stringify(columns, docs);

  const name = appconfig.get('worktemppath') + '/devices.csv';
  await fs.promises.writeFile(name, dataStr, 'utf8');
  return { name };

  function formOneObj(dataItem) {
    const newo = {};
    columns.forEach(field => {
      const val = dataItem[field] != undefined ? dataItem[field] : '';
      newo[field] = valueByType(field, val);
    });
    return newo;
  }

  function valueByType(field, val) {
    const type = props[field];
    switch (type) {
      case 'cb':
        return val > 0 ? 1 : 0;
      case 'number':
        return isNaN(val) ? 0 : Number(val);
      default:
        return String(val);
    }
  }

  function docsFromTree(treeArr) {
    const result = [];
  
    traverse(treeArr, 'place');
    return result;
  
    function traverse(tarr, parent_id) {
      for (const item of tarr) {
        if (item.children) {
          result.push({ folder: 1, id: item.id, title: item.title, parent_id });
          traverse(item.children, item.id);
        } else {
          result.push({ id: item.id, title: item.title, parent_id });
        }
      }
    }
  }
}





/**
 * param=channels&format=csv
 *
 *  @return {name:путь к файлу .csv, error:'текст в случае ошибки'}
 */
async function exportChannels(query, holder) {
  if (!query) return '';
  if (!query.nodeid) return { error: 'Expected nodeid for export!' };
  if (!query.param) return { error: 'Expected param for export!' };

  const nodeid = query.nodeid;
  // поля получить от плагина
  const channelProps = appconfig.getChannelPropsFromV5Form(nodeid);
  if (!channelProps) return { error: 'Not found v5/channelform for ' + nodeid };

  const columns = Object.keys(channelProps);
  if (!columns.includes('chan')) columns.unshift('chan');
  columns.push('did');
  columns.push('prop');

  // Выгружать в порядке дерева
  const tree = await dataformer.getCachedSubTree('channels', nodeid, holder.dm);
  const treeItems = docsFromTree(tree);

  const docs = [];
  for (const item of treeItems) {
    if (!item.folder) {
      // Для записей - листьев вытащить данные из таблицы
      const onedoc = await holder.dm.findRecordById('devhard', item.id);
      if (onedoc) {
        // Копировать свойства, которые выгружаем
        docs.push({ parent_title: item.parent_title, ...formOneObj(onedoc) });
      }
    } else {
      // Для папок - только folder_title, parent_title
      docs.push({ folder_title: item.title, parent_title: item.parent_title });
    }
  }

  columns.unshift('parent_title');
  columns.unshift('folder_title');
 
  const dataStr = CSV.stringify(columns, docs);

  const name = appconfig.get('worktemppath') + '/' + nodeid + '.csv';
  await fs.promises.writeFile(name, dataStr, 'utf8');
  return { name };

  function formOneObj(dataItem) {
    const newo = {};
    columns.forEach(field => {
      const val = dataItem[field] != undefined ? dataItem[field] : '';
      newo[field] = valueByType(field, val);
    });
    return newo;
  }

  function valueByType(field, val) {
    const type = channelProps[field];
    switch (type) {
      case 'cb':
        return val > 0 ? 1 : 0;
      case 'number':
        return isNaN(val) ? 0 : Number(val);
      default:
        return String(val);
    }
  }


function docsFromTree(tree) {
  const result = [];

  traverse(tree, '');
  return result;

  function traverse(tarr, parent_title) {
    for (const item of tarr) {
      if (item.children) {
        result.push({ folder: 1, id: item.id, title: item.title, parent_title });
        traverse(item.children, item.title);
      } else {
        result.push({ id: item.id, title: item.title, parent_title });
      }
    }
  }
}
}

// {format:{[param]: fun}}
module.exports = {
  csv: {
    channels: exportChannels,
    devices: exportDevices
  }
};
