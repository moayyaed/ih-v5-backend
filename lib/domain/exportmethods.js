/**
 * importmethods.js
 *
 *  Методы выгрузки прикладного уровня
 *  Формируют файл(ы) для выгрузки
 *
 *  Возвращают объект { folder:если несколько файлов - полный путь к папке, name:полный путь к файлу, error }
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const dataformer = require('../api/dataformer');

const hut = require('../utils/hut');
const CSV = require('../utils/csvutil');

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
  // TODO - поля получить от плагина!
  const channelProps = appconfig.getChannelPropsFromV5Form(nodeid);
  if (!channelProps) return { error: 'Not found v5/channelform for ' + nodeid };

  // const columns = ['chan', 'unitid', 'vartype', 'address', 'fcr', 'r', 'w', 'gr'];

  const columns = Object.keys(channelProps);
  if (!columns.includes('chan')) columns.unshift('chan');

  // Выгружать в порядке дерева?
  const tree = await dataformer.getCachedSubTree('channels', nodeid, holder.dm);
  console.log('SUBTREE ' + util.inspect(tree));
  /**
 * SUBTREE [
  {
    id: 'modbus4_all',
    title: 'ALL',
    children: []
  },
  {
    id: 'T7Zw1R5Ek',
    title: 'New Folder',
    children: []
  }
]

 */
  // const docs = await holder.dm.get('devhard', { unit: nodeid }, { sort: 'chan' });
  const treeItems = docsFromTree(tree);

  console.log('treeItems ' + util.inspect(treeItems));

  const docs = [];
  for (const item of treeItems) {
    if (!item.folder) {
      // Для записей - листьев вытащить данные из таблицы
      const onedoc = await holder.dm.findRecordById('devhard', item.id);
      console.log('findRecordById ' + item.id + util.inspect(onedoc));
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
        return val ? 1 : 0;
      case 'number':
        return isNaN(val) ? 0 : Number(val);
      default:
        return String(val);
    }
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

// {format:{[param]: fun}}
module.exports = {
  csv: {
    channels: exportChannels
  }
};
