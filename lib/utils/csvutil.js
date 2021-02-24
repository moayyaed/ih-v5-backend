/**
 * csvutil.js
 *  - parse - импорт объектов из строки
 *  - stringify - экспорт объектов в строку
 */

// const util = require('util');
const fs = require('fs');

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
          doc.parseError = 'Line: ' + lidx + ' Empty field ' + field + '! Skipped..';
          count++;
        }
      }
      if (count) docs.push(doc);
    }
  });
  return docs;
}

function stringify(columns, docs) {
  let res = columns.join(',') + '\n';
  docs.forEach(doc => {
    const line = columns.map(el => (doc[el] == undefined ? '' : '"' + doc[el] + '"'));
    res += line.join(',') + '\n';
  });
  return res;
}

module.exports = {
  parse,
  stringify
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
