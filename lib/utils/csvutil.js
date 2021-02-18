/**
 * csvutil.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');

/**
 *  Функция готовит файл csv для экспорта
 *  Возвращает путь к файлу
 */
async function exportCSV(query, holder) {
  if (!query) return '';

  if (!query.nodeid) return { error: 'Expected nodeid for export!' };
  if (!query.param) return { error: 'Expected param for export!' };

  const nodeid = query.nodeid;

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
  const dataStr = await getChannelsStr();

  let str = columns.join(',') + '\n' + dataStr;
  const name = appconfig.get('worktemppath') + '/' + nodeid + '.csv';
  await fs.promises.writeFile(name, str, 'utf8');
  return { name };

  async function getChannelsStr() {
    const docs = await holder.dm.get('devhard', { unit: nodeid });

    let res = '';
    // Группировать по папкам и внутри по order? Взять из дерева каналов?
    docs.forEach(doc => {
      const line = columns.map(el => {
        if (doc.folder) {
          if (el != 'parent' && !el.startsWith('folder')) return '';

          if (el == 'folder') return '1';
          if (el == 'folder_id') return '"' + doc._id + '"';
          if (el == 'folder_name') return '"' + doc.chan + '"';
          return doc[el] || '';
        }

        return el.startsWith('folder') || doc[el] == undefined ? '' : '"' + doc[el] + '"';
      });

      res += line.join(',') + '\n';
    });
    return res;
  }
}

async function importCSV(query, dataStr, holder) {
  if (query.param == 'channels') {
    const unit = query.nodeid;
    // Распарсить по строкам
    const lines = dataStr.split('\n');
    console.log('LINES: ' + lines.length);

    // Распарсить первую строку - д б разделители и имена полей
    const firstLine = lines.shift();
    let delim = ';';
    const fields = firstLine.split(delim);
    if (fields.length < 3) throw { message: 'Expect fields in first line with delim "' + delim + '"' };
    if (fields[0] != 'folder') throw { message: 'Expect first field "folder"' };

    const newdocs = [];

    lines.forEach(line => {
      const doc = { unit };
      const props = line.split(delim);
      if (props.length) {
        // первое поле - folder

        for (let i = 1; i < fields.length; i++) {
          if (props[i]) {
            const field = fields[i];
            if (field == 'folder_id') { // Это не настоящие поля!!
              doc._id = props[i]; 
            } else  if (field == 'folder_name') {
              doc.chan = props[i];
            } else {
              doc[field] = props[i]; 
            }
          }
        }

        newdocs.push(doc);
      }
    });

    // Загрузить в devhard. Предварительно все каналы для unit удалить!
    const docs = await holder.dm.get('devhard', { unit });
    if (docs.length) {
      console.log('REMOVE devhard DOCS: ' + docs.length);
      await holder.dm.removeDocs('devhard', docs);
    }
    console.log('INSERT devhard DOCS: ' + newdocs.length);
    await holder.dm.insertDocs('devhard', newdocs); 
  }
}

module.exports = {
  exportCSV,
  importCSV
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
