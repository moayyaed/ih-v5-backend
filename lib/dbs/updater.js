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
 * Сформировать вспомогательный объект для разбора формы и сохранить в кэш
 * @param {String} id - ид-р формы
 * @return {Object} Объект для разбора формы:
 * {
     records: [ { cell: 'p1', table: 'device' }, { cell: 'p2', table: 'device' } ],
     tables: [ { cell: 'p3', table: 'devicecommonTable' } ],
     alloc: {
       device: { dn: 'p1', name: 'p1', type: 'p1', parent_name: 'p1', txt: 'p2' },
       devicecommonTable: { prop: 'p3', min: 'p3', max: 'p3'}
     }
   }
 */
async function getMetaUpForm(id) {
  const metaData = await dataformer.getMeta('form', id);
  const formMetaData = metaData.data;
  if (!formMetaData.grid) return;

  const records = [];
  const tables = [];
  const alloc = {}; // table->prop->cell

  // Сформировать записи по метаданным формы
  for (const cell of formMetaData.grid) {
    if (cell.table) {
      records.push({ cell: cell.id, table: cell.table });
      addAlloc(cell.table, formMetaData[cell.id], cell.id);
    }
    // может быть компонент-таблица
    if (formMetaData[cell.id]) {
      formMetaData[cell.id].forEach(item => {
        if (item.type == 'table') {
          tables.push({ cell: cell.id, table: item.prop });

          addAlloc(item.prop, item.columns, cell.id);
        }
      });
    }
  }

  // Сохранить в кэш
  const key = descriptor.getCacheKey('upform', id, 'meta');
  cache.set(key, { records, tables, alloc });
  return cache.get(key).data;

  function addAlloc(table, arr, cellid) {
    if (!alloc[table]) alloc[table] = {};

    arr.forEach(item => {
      if (item.type != 'table') {
        alloc[table][item.prop] = cellid;
      }
    });
  }
}

/**
 * Сохранение данных формы. На форме могут быть данные из несколькиз таблиц
 *
 * @param {Object} body
 *       id - идентификатор формы
 *   nodeid - идентификатор данных (узел, из которого вызывана форма)
 *  payload - объект содержит измененные данные формы
 *
 */
async function updateForm(body) {
  const { id, nodeid, payload } = body;

  let formMetaDataForUpdate;
  const key = descriptor.getCacheKey('upform', id, 'meta');
  if (cache.has(key)) {
    formMetaDataForUpdate = cache.get(key).data;
  } else {
    formMetaDataForUpdate = await getMetaUpForm(id);
  }

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

  // Сначала проверить, что записи существуют! И выполнить валидацию данных
  // Так как откатить не сможем и ответ должен быть один!!
  validateForm(formMetaDataForUpdate, docsToWrite, tablesToWrite);

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

      const unsetObj = makeUnsetObj(data, desc.genfield);
      if (setObj || unsetObj) {
        const setUnset = {};
        if (setObj) setUnset.$set = setObj;
        if (unsetObj) setUnset.$unset = unsetObj;
        await dbstore.update(desc.collection, filter, setUnset);
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

function validateForm(formMetaDataForUpdate, docsToWrite, tablesToWrite) {
  const errdata = {};
  // Проверка records
  for (const table in docsToWrite) {
    const doc = docsToWrite[table];
    const valObj = descriptor.getTableValidator(table);
    if (valObj && valObj.main) {
      Object.keys(doc).forEach(prop => {
        if (valObj.main[prop]) {
          const errTxt = checkProp(valObj.main[prop], prop, doc[prop]);
          if (errTxt) addErrdata(table, prop, errTxt);
        }
      });
    }

    // ЗАГЛУШКА! нужны правила валидации
    // if (doc.name && doc.name.includes('test')) {
    //  addErrdata(table, 'name', 'Что за чушь!');
    // }
  }

  // Проверка таблиц
  for (const table in tablesToWrite) {
    const data = tablesToWrite[table]; // Это объекты для каждой строки

    // ЗАГЛУШКА! нужны правила валидации
    let newRec;
    for (const mainprop in data) {
      // Удаление
      if (typeof data[mainprop] == 'object') {
        // Свойство на удаление - обработать при записи

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
            addErrTabdata(table, mainprop, prop, 'Отрицательное значение?');
          }
        }
      }
    }
    if (newRec)
      newRec.forEach(mainprop => {
        delete data[mainprop];
      });
  }
  // Результат проверки
  if (!hut.isObjIdle(errdata)) throw { error: 'Validation', message: 'Не удалось сохранить данные!', data: errdata };

  function addErrdata(table, prop, text) {
    const cellid = formMetaDataForUpdate.alloc[table][prop];
    if (!errdata[cellid]) errdata[cellid] = {};
    errdata[cellid][prop] = text;
  }

  //  { p3: { [table]: { [mainprop]: { [prop]: 'Отрицательное значение :' + val } } } }
  function addErrTabdata(table, mainprop, prop, text) {
    const cellid = formMetaDataForUpdate.alloc[table][prop];
    if (!errdata[cellid]) errdata[cellid] = {};
    if (!errdata[cellid][table]) errdata[cellid][table] = {};
    if (!errdata[cellid][table][mainprop]) errdata[cellid][table][mainprop] = {};
    errdata[cellid][table][mainprop][prop] = text;
  }
}

function checkProp(rule, prop, value) {
  if (!rule.empty && !value) return 'Field ' + prop +'" '+ rule.description;
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
