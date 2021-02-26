/**
 * importmethods.js
 *
 *  Методы загрузки прикладного уровня
 */

const util = require('util');
const shortid = require('shortid');

const appconfig = require('../appconfig');

const CSV = require('../utils/csvutil');

async function processDevices({ data, nodeid }, holder) {
  const props = { type: 'string', dn: 'string', name: 'string' };
  const columns = Object.keys(props);
  // const docs = CSV.parse(data, { requiredFields: ['did', 'type', 'dn', 'name'] });
  const docs = CSV.parse(data);

  const errStr = checkDocs();
  if (errStr) return { response: 0, message: errStr };

  // Папки отдельно в lists - place
  // Удалить place и device - все
  await removeDocs('place', { list: 'place' }, holder);
  await removeDocs('device', {}, holder);

  const placeDocs = [{ _id: 'place', list: 'place', parent: 0, order: 0, name: 'Все' }];
  const devDocs = [];

  let order = 0;
  docs.forEach(doc => {
    order += 10;
    const parent = doc.parent_id;
    if (doc.folder_id) {
      // Это папка - place

      placeDocs.push({ _id: doc.folder_id, list: 'place', parent, order, name: doc.folder_title });
    } else {
      // Устройство
      devDocs.push({ ...formOneObj(doc), _id: doc.did, parent, order });
    }
  });

  await holder.dm.insertDocs('place', placeDocs);
  await holder.dm.insertDocs('device', devDocs);
  return { response: 1, message: 'Загружено ' + devDocs.length + ' устройств' };

  function checkDocs() {
    // Проверить, что все типы есть в системе. Если нет - не загружать
    if (!docs.length) return 'Данные не найдены!';
    let errArr = [];
    docs.forEach((doc, idx) => {
      if (doc.parseError) {
        errArr.push(doc.parseError);
      } else if (doc.folder_id) {
        let err = checkReqProps(doc, ['folder_title']);
        if (err) errArr.push('Строка ' + idx + ': ' + err + ' не может быть пусто');
      } else {
        let err = checkReqProps(doc, ['did', 'dn', 'type', 'name']);
        if (err) {
          errArr.push('Строка ' + idx + ': ' + err + ' не может быть пусто');
        } else if (!holder.typeMap.has(doc.type)) {
          errArr.push('Строка ' + idx + ': Тип ' + doc.type + ' отсутствует в проекте');
        }
      }
    });
    return errArr.length ? errArr.join('\n') : '';
  }

  function checkReqProps(doc, propArr) {
    const notFound = [];
    propArr.forEach(prop => {
      if (doc[prop] == undefined) notFound.push(prop);
    });
    return notFound.length ? notFound.join(',') : '';
  }

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
}

async function removeDocs(table, filter, holder) {
  const olddocs = await holder.dm.get(table, filter);
  if (olddocs.length) {
    await holder.dm.removeDocs(table, olddocs);
  }
}

async function processChannels({ data, nodeid }, holder) {
  let channelProps = appconfig.getChannelPropsFromV5Form(nodeid);
  // if (!channelProps) return { error: 'Not found v5/channelform for ' + nodeid };
  if (!channelProps) channelProps = { chan: 'input' };
  const columns = Object.keys(channelProps);

  const docs = CSV.parse(data, { requiredFields: ['chan'] });
  const unit = nodeid;

  // Предварительно все каналы для unit удалить
  const newdocs = [];
  const olddocs = await holder.dm.get('devhard', { unit });

  if (olddocs.length) {
    console.log('REMOVE devhard DOCS: ' + olddocs.length);
    await holder.dm.removeDocs('devhard', olddocs);
  }

  const folders = {};
  let order = 0;
  docs.forEach(doc => {
    order += 10;
    const parent = doc.parent_title ? folders[doc.parent_title] : '';
    if (doc.folder_title) {
      // Это папка
      const _id = shortid.generate();
      folders[doc.folder_title] = _id;
      newdocs.push({ _id, unit, parent, order, folder: 1, chan: doc.folder_title });
    } else {
      // Канал
      const _id = unit + '_' + doc.chan;
      // Брать только поля, которые есть в канале
      // Выполнить преобразование типа атрибута: cb, number: "0" => 0
      newdocs.push({ ...formOneObj(doc), _id, unit, parent, order });
    }
  });

  console.log('INSERT devhard DOCS: ' + newdocs.length + util.inspect(newdocs));
  await holder.dm.insertDocs('devhard', newdocs);
  return { response: 1, message: 'Загружено ' + newdocs.length + ' каналов' };

  function formOneObj(dataItem) {
    const newo = {};
    columns.forEach(field => {
      const val = dataItem[field] != undefined ? dataItem[field] : '';
      newo[field] = valueByType(field, val);
    });

    if (dataItem.did && dataItem.prop) {
      // Проверить, что такое устройство есть. Если нет - пропустить
      if (holder.devSet[dataItem.did]) {
        newo.did = dataItem.did;
        newo.prop = dataItem.prop;
      } else {
        let str = ' Link for chan ' + dataItem.chan + '! Not found device ' + dataItem.did;
        console.log('WARN: import channels ' +nodeid+str );
      }
    }
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
}

module.exports = {
  csv: {
    channels: processChannels,
    devices: processDevices
  }
};
