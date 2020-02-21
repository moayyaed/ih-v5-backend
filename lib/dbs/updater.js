/**
 * updater.js
 */

const util = require('util');

const hut = require('../utils/hut');

const dbstore = require('./dbstore');
const descriptor = require('./descriptor');
const dataformer = require('./dataformer');
const cache = require('./cache');

/**
 *
 * @param {*} body
 */
async function updateFormx(body) {
  const { nodeid, payload } = body;

  // Для формы - каждый элемент отдельно: payload = {p1:{name:''}, p2:{txt:''}, p3:{devicecommonTable:[{id:},{}]}}
  // Преобразование полей делать не надо

  const metaData = await dataformer.getMeta('form', body.id);
  const formMetaData = metaData.data;
  if (!formMetaData.grid) throw new Error('No "grid" prop in form!');

  const docsToWrite = {};
  const tablesToWrite = {};

  // Сформировать записи по метаданным формы
  for (const cell of formMetaData.grid) {
    // Получить имя таблицы для каждой ячейки, группировать данные по таблицам.
    if (payload[cell.id]) {
      // Есть измененные данные этой ячейки
      // Это ячейки-запись
      if (cell.table) {
        if (docsToWrite[cell.table]) docsToWrite[cell.table] = {};
        docsToWrite[cell.table] = Object.assign({ _id: nodeid }, docsToWrite[cell.table], payload[cell.id]);
      } else {
        // Это может быть компонент-таблица
        if (formMetaData[cell.id] && formMetaData[cell.id][0].type == 'table') {
          // подготовить данные для таблицы prop - имя таблицы
          const tabname = formMetaData[cell.id][0].prop;
          console.log('formMetaData.tabname = ' + tabname);
          if (payload[cell.id][tabname]) tablesToWrite[tabname] = payload[cell.id][tabname];
        }
      }
    }
  }

  // Сначала проверить, что записи существуют! И выполнить валидацию данных
  // Так как откатить не сможем и ответ должен быть один!!
  // Записать по одной записи??
  try {
    for (const collection in docsToWrite) {
      const doc = docsToWrite[collection];
      const filter = { _id: doc._id };
      delete doc._id;
      await dbstore.update(collection, filter, { $set: doc });
    }
  } catch (e) {
    throw new Error('Update error ' + util.inspect(e));
  }

  // Запись таблиц
  console.log('tablesToWrite ' + util.inspect(tablesToWrite));
  try {
    for (const table in tablesToWrite) {
      console.log('table=' + table);
      const data = tablesToWrite[table];
      const filter = { _id: nodeid };
      const desc = descriptor.getTableDesc(table);
      const genfield = desc.genfield;
      const setObj = {};
      data.forEach(item => {
        const id = item.id;

        // setObj[genfield][id] = {...item}; Так происходит замена!!
        // Нужно каждое свойство отдельно using the dot-notation
        for (const prop in item) {
          if (prop != 'id') {
            setObj[genfield + '.' + id + '.' + prop] = item[prop];
          }
        }
      });
      console.log('setObj=' + util.inspect(setObj));
      await dbstore.update(desc.collection, filter, { $set: setObj });
    }
  } catch (e) {
    throw new Error('Update error ' + util.inspect(e));
  }
}

async function getMetaUpForm(id) {
  const metaData = await dataformer.getMeta('form', id);
  const formMetaData = metaData.data;
  if (!formMetaData.grid) return;

  const records = [];
  const tables = [];

  // Сформировать записи по метаданным формы
  for (const cell of formMetaData.grid) {
    if (cell.table) {
      records.push({ cell: cell.id, table: cell.table });
    }
    // может быть компонент-таблица
    if (formMetaData[cell.id]) {
      formMetaData[cell.id].forEach(item => {
        if (item.type == 'table') {
          tables.push({ cell: cell.id, table: item.prop });
        }
      });
    }
  }
  // Сохранить в кэш!!
  const key = descriptor.getCacheKey('upform', id, 'meta');
  cache.set(key, { records, tables });
  return cache.get(key).data;
}

async function updateForm(body) {
  const { id, nodeid, payload } = body;

  // Для формы - каждый элемент отдельно: payload = {p1:{name:''}, p2:{txt:''}, p3:{devicecommonTable:[{id:},{}]}}
  // Преобразование полей делать не надо
  let formMetaDataForUpdate;
  const key = descriptor.getCacheKey('upform', id, 'meta');
  if (cache.has(key)) {
    formMetaDataForUpdate = cache.get(key).data;
  } else {
    formMetaDataForUpdate = await getMetaUpForm(id);
  }
  console.log('formMetaDataForUpdate ' + util.inspect(formMetaDataForUpdate));
  /*
  const formMetaDataForUpdate = {
    records: [
      { cell: 'p1', table: 'types' },
      { cell: 'p2', table: 'types' }
    ],
    tables: [{ cell: 'p3', table: 'typeprops' }]
  };
  */

  const docsToWrite = {};
  const tablesToWrite = {};

  formMetaDataForUpdate.records.forEach(item => {
    if (payload[item.cell]) {
      if (!docsToWrite[item.table]) docsToWrite[item.table] = { _id: nodeid };
      // Добавить плоские значения
      Object.keys(payload[item.cell]).forEach(field => {
        if (typeof payload[item.cell][field] != 'object') {
          docsToWrite[item.table][field] = payload[item.cell][field];
        }
      });
    }
  });

  formMetaDataForUpdate.tables.forEach(item => {
    if (payload[item.cell] && payload[item.cell][item.table] && typeof payload[item.cell][item.table] == 'object') {
      // Добавить табличные значения компонент-таблиц
      tablesToWrite[item.table] = payload[item.cell][item.table];
    }
  });

  console.log('docsToWrite ' + util.inspect(docsToWrite));
  console.log('tablesToWrite ' + util.inspect(tablesToWrite));
  // TODO Сначала проверить, что записи существуют! И выполнить валидацию данных
  // Так как откатить не сможем и ответ должен быть один!!

  // Проверка records
  for (const table in docsToWrite) {
    const doc = docsToWrite[table];
    // ЗАГЛУШКА! Нужно определять плашку+нужны правила валидации
    if (doc.name && doc.name.includes('test')) {
      console.log('Validation field name!!');
      throw { error: 'Validation', data: { p1: { name: 'Что за чушь!' } } };
    }
  }

  // Проверка таблиц
  for (const table in tablesToWrite) {
    const data = tablesToWrite[table]; // Это объекты для каждой строки

    // ЗАГЛУШКА! Нужно определять плашку+нужны правила валидации
    let newRec;
    for (const mainprop in data) {
      // Удаление
      if (typeof data[mainprop] != 'object') {
        // Свойство на удаление - обработать при записи
      } else {
        if (mainprop.substr(0, 1) == '__') {
          // Временный ключ начинается с двойного подчеркивания
          // Это новая запись - создать новый id = prop  - НУЖНЫ ПРАВИЛА!!
          const newkey = data[mainprop].prop;
          if (!newkey) {
            throw {
              error: 'Validation',
              data: { p3: { [table]: [{ id: mainprop, prop: 'Это поле не может быть пустым!' }] } }
            };
          }
          // скопировать объект с новым ключом, временные удалить после цикла
          data[newkey] = hut.clone(data[mainprop]);
          if (!newRec) newRec = [];
          newRec.push(mainprop);
        }

        for (const prop in data[mainprop]) {
          const val = data[mainprop][prop];
          if (val < 0) {
            throw {
              error: 'Validation',
              data: { p3: { [table]: [{ id: mainprop, [prop]: 'Отрицательное значение :' + val }] } }
            };
          }
        }
      }
    }
    if (newRec)
      newRec.forEach(mainprop => {
        delete data[mainprop];
      });
  }

  // Запись records
  try {
    for (const table in docsToWrite) {
      const doc = docsToWrite[table];
      const filter = { _id: doc._id };
      delete doc._id;
      const desc = descriptor.getTableDesc(table);
      await dbstore.update(desc.collection, filter, { $set: doc });
    }
  } catch (e) {
    throw new Error('Update error ' + util.inspect(e));
  }

  // Запись таблиц
  try {
    for (const table in tablesToWrite) {
      const data = tablesToWrite[table];
      const filter = { _id: nodeid };
      const desc = descriptor.getTableDesc(table);
      const setObj = makeSetObj(data, desc.genfield);
      console.log('setObj=' + util.inspect(setObj));

      // const unsetObj = makeUnsetObj(data, desc.genfield);
      // console.log('unsetObj=' + util.inspect(unsetObj));
      if (setObj ) {
        await dbstore.update(desc.collection, filter, Object.assign({}, { $set: setObj}));
      }
    }
  } catch (e) {
    throw new Error('Update error ' + util.inspect(e));
  }
}

function makeSetObj(data, genfield) {
  let setObj;
  // data = { value:{ max: 42, min: 17 }, _newkey:{min:0, max:100}} // Нужно добавить новый ключ!!
  for (const mainprop in data) {
    if (typeof data[mainprop] == 'object') {
      for (const prop in data[mainprop]) {
        if (!setObj) setObj = {};
        setObj[genfield + '.' + mainprop + '.' + prop] = data[mainprop][prop];
      }
    }
  }
  return setObj;
  /*
  data.forEach(item => {
    // setObj[genfield][id] = {...item}; Так происходит замена!!
    // Нужно каждое свойство отдельно using the dot-notation
    for (const prop in item) {
      if (prop != 'id') {
        setObj[genfield + '.' + item.id + '.' + prop] = item[prop];
      }
    }
  });
  */
}

function makeUnsetObj(data, genfield) {
  let unsetObj;
  // data = { value:{ max: 42, min: 17 }, oldprop:'' // Удаление, если не объект
  for (const mainprop in data) {
    if (!data[mainprop]) {
      if (!unsetObj) unsetObj = {};
      unsetObj[genfield + '.' + mainprop] = 1;
    }
  }
  return unsetObj;
}

module.exports = {
  updateForm,
  makeSetObj // for test
};

/*
{
  "method":"update",
  "type":"form",
  "id":"formTypeCommon",
  "nodeid":"t200",
  "payload":{"p1":{"name":"My new record"},"p3":{"typepropsTable":{"value":{ "max":40}, "setpoint":{"min":-2, "vtype":"N", "op":"rw"}}}}
}
*/
