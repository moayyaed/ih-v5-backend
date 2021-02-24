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
  /*
  const columns = [
    'folder',
    'folder_id',
    'folder_name',
    'parent',
    'chan',
    'unitid',
    'vartype',
    'address',
    'fcr',
    'r',
    'w'
  ];
  */

  const columns = ['chan', 'unitid', 'vartype', 'address', 'fcr', 'r', 'w', 'gr'];
  const docs = await holder.dm.get('devhard', { unit: nodeid }, { sort: 'chan' });
  
  const dataStr = CSV.stringify(columns, docs)

  const name = appconfig.get('worktemppath') + '/' + nodeid + '.csv';
  await fs.promises.writeFile(name, dataStr, 'utf8');
  return { name };
}
 

// {format:{[param]: fun}}
module.exports = {
  csv:{
    channels: exportChannels
  }
}