/**
 * csvutil.js
 */

// const util = require('util');
const fs = require('fs');
// const path = require('path');

const hut = require('./hut');
const appconfig = require('../appconfig');

/**
 * Извлекает из csv список полей и каждую строку как объект
 * @param {String} dataStr
 * @param {Object} options
 *
 * @return {Array of Objects} docs
 * @throw {message} - в случае ошибки
 *
 */
function parse(dataStr, options = {}) {
  if (!dataStr || typeof dataStr != 'string') throw { message: 'Expect string for parse!' };

  // Распарсить по строкам  Удалить пробелы, \r , табуляции в каждой строке. Исключить пустые строки
  const lines = dataStr
    .split('\n')
    .map(line => hut.allTrim(line))
    .filter(line => line);
  if (!lines || lines.length < 2) throw { message: 'No data for parse!' }; // Первая строка - поля, вторая - данные

  // В первой строке - д б разделители и имена полей
  const firstLine = lines.shift();
  let delim = ';'; // Проверяем варианты: ';' или ','
  if (firstLine.indexOf(delim) < 0) delim = ',';
  const fields = firstLine.split(delim);
  if (!fields || fields.length < 2) throw { message: 'Expect fields in first line with delim "' + delim + '"' };

  // Должны быть поля options.requiredFields
  const reqFields = {};
  if (options.requiredFields) {
    if (!Array.isArray(options.requiredFields)) options.requiredFields = options.requiredFields.split(',');
    options.requiredFields.forEach(field => {
      fields.find(el => el == field);
      if (!fields.find(el => el == field)) throw { message: 'Missing required field "' + field + '"' };
      reqFields[field] = 1;
    });
  }

  // Подготовка объектов по каждой строке
  const docs = [];
  lines.forEach((line, lidx) => {
    const doc = {};
    const props = line.split(delim);
    if (props.length) {
      let count = 0;
      for (let i = 0; i < fields.length; i++) {
        let val = hut.removeBorderQuotes(props[i]); // Это строка - очистить от кавычек, если они есть
        const field = fields[i];
        // Если пустое значение - не сохраняем??
        if (val) {
          doc[field] = val;
          count++;
        } else if (reqFields[field]) {
          // Пишем, что ошибка, но сохраняем doc
          doc.parseError = 'Line: '+lidx+' Empty field '+field+'! Skipped..';
          count++;
        }
      }
      if (count) docs.push(doc);
    }
  });
  return docs;
}

/**
 *  Функция готовит файл csv для экспорта
 *  Возвращает путь к файлу
 */
async function exportCSV(query, holder) {
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
  const dataStr = await getChannelsStr();

  let str = columns.join(',') + '\n' + dataStr;
  const name = appconfig.get('worktemppath') + '/' + nodeid + '.csv';
  await fs.promises.writeFile(name, str, 'utf8');
  return { name };

  async function getChannelsStr() {
    const docs = await holder.dm.get('devhard', { unit: nodeid }, { sort: 'chan' });

    let res = '';
    // Группировать по папкам и внутри по order? Взять из дерева каналов?
    // ПОКА ПАПКИ НЕ ФОРМИРУЮ!!
    docs
      .filter(doc => !doc.folder)
      .forEach(doc => {
        const line = columns.map(el => (doc[el] == undefined ? '' : '"' + doc[el] + '"'));

        res += line.join(',') + '\n';
      });
    return res;
  }
}

async function importCSV(query, dataStr, holder) {
  if (query.param == 'channels') {
    const docs = parse(dataStr, { requiredFields: ['chan'] });

    const unit = query.nodeid;

    // Предварительно все каналы для unit удалить, оставить только корневую папку
    const newdocs = [];
    let rootFolder;
    const olddocs = await holder.dm.get('devhard', { unit });

    if (olddocs.length) {
      const rootIdx = getRootFolderIdx(docs);
      if (rootIdx >= 0) {
        rootFolder = docs[rootIdx];
        olddocs.splice(rootIdx, 1);
      }
      if (olddocs.length) {
        console.log('REMOVE devhard DOCS: ' + olddocs.length);
        await holder.dm.removeDocs('devhard', olddocs);
      }
    }

    let order = 0;
    let parent;
    // Нет ничего, даже корневой папки - добавить
    if (!rootFolder) {
      parent = unit + '_all';
      rootFolder = { _id: parent, folder: 1, parent: 0, chan: parent, order };
      newdocs.push(rootFolder);
    } else {
      parent = rootFolder._id;
    }

    docs.forEach(doc => {
      order += 10;
      const _id = unit + '_' + doc.chan;
      newdocs.push({ _id, unit, parent, order, ...doc });
    });

    console.log('INSERT devhard DOCS: ' + newdocs.length);
    await holder.dm.insertDocs('devhard', newdocs);
  }
}

function getRootFolderIdx(docs) {
  // Найти корневую папку
  if (docs && docs.length) {
    for (let i = 0; i < docs.length; i++) {
      if (docs[i].folder && !docs[i].parent) return i;
    }
  }
  return -1;
}

module.exports = {
  exportCSV,
  importCSV,
  parse
};

/*
const x = {
  _id: '0-GXZx3-V7',
  order: 2000,
  parent: 'C2l1t8TLt',
  unit: 'modbus1',
  chan: '77_volt_1612717554136',
  desc: 'AO',
  vartype: 'int16',
  address: '0x1001',
  unitid: '77',
  pollp: true,
  fcr: '3',
  gr: true,
  usek: false,
  ks0: 0,
  ks: 100,
  kh0: 0,
  kh: 100,
  folder: 0,
  did: '',
  prop: ''
};
*/
