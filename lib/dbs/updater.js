/**
 * updater.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

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
          tables.push({ cell: cell.id, table: cell.table, prop: item.prop });
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
 * Сохранение данных формы. На форме могут быть данные из нескольких таблиц
 *
 * @param {Object} body
 *       id - идентификатор формы
 *   nodeid - идентификатор данных (узел, из которого вызывана форма)
 *  payload - объект содержит измененные данные формы
 *
 */
async function updateForm(body) {
  const { id, nodeid, payload } = body;
  const data = [];

  let formMetaDataForUpdate;
  const key = descriptor.getCacheKey('upform', id, 'meta');
  if (cache.has(key)) {
    formMetaDataForUpdate = cache.get(key).data;
  } else {
    formMetaDataForUpdate = await getMetaUpForm(id);
  }

  console.log('formMetaDataForUpdate = ' + util.inspect(formMetaDataForUpdate));

  const docsToWrite = {};
  const tablesToWrite = {};
  const changedTables = [];

  formMetaDataForUpdate.records.forEach(item => {
    if (payload[item.cell]) {
      if (!docsToWrite[item.table]) docsToWrite[item.table] = { _id: nodeid };
      // Добавить плоские значения
      Object.keys(payload[item.cell]).forEach(field => {
        // if (typeof payload[item.cell][field] != 'object') {
        docsToWrite[item.table][field] = payload[item.cell][field];
        // }
      });
    }
  });

  formMetaDataForUpdate.tables.forEach(item => {
    if (payload[item.cell] && payload[item.cell][item.prop] && typeof payload[item.cell][item.prop] == 'object') {
      // Добавить табличные значения компонент-таблиц
      tablesToWrite[item.table] = payload[item.cell][item.prop];
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
      const desc = descriptor.getTableDesc(table);

      // Нужно обработать поле tags - старые тэги удалить, новые сохранить
      if (doc.tags) updateTags(doc, desc.collection);

      const filter = { _id: doc._id };
      delete doc._id;

      await dbstore.update(desc.collection, filter, { $set: doc });

      // TODO здесь нужно title формировать по разному??
      if (doc.name) {
        data.push({ id: body.nodeid, title: doc.name });
      }

      changedTables.push(table);
    }
  } catch (e) {
    throw new Error('Update error ' + util.inspect(e));
  }

  // Запись таблиц отдельно, если update

  try {
    for (const table in tablesToWrite) {
      const docToWrite = tablesToWrite[table];
      const filter = { _id: nodeid };
      const desc = descriptor.getTableDesc(table);
      const setObj = makeSetObj(docToWrite, desc.genfield);

      const unsetObj = makeUnsetObj(docToWrite, desc.genfield);
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

  // Вернуть список таблиц измененных? НЕТ, нужно вернуть запись для дерева: {id, title}
  return data.length ? data : '';
}

async function updateTags(doc, collection) {
  if (!doc.tags) return;

  // Получить старые тэги
  const olddoc = await dbstore.findOne(collection, { _id: doc._id });
  if (!olddoc) throw new Error('Update error. Not found doc: _id = ' + doc._id + ', collection ' + collection);
  this.tagstore.update(olddoc.tags, doc.tags, doc._id, collection);
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
  }

  // Проверка таблиц
  for (const table in tablesToWrite) {
    const data = tablesToWrite[table]; // Это объекты для каждой строки

    // const desc = descriptor.getTableDesc(table);
    // const valObj = desc.validator && desc.validator.props ? desc.validator.props : '';

    // ЗАГЛУШКА! нужны правила валидации
    let newRec;
    for (const mainprop in data) {
      if (typeof data[mainprop] == 'object') {
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

        /**  Проверка таблицы по правилам валидации 
        for (const prop in data[mainprop]) {
          if (valObj && valObj[prop]) {
            const errTxt = checkProp(valObj[prop], prop, data[mainprop][prop]);
            if (errTxt) addErrTabdata(table, mainprop, prop, errTxt);
          }
        }
        */
      }
    }
    if (newRec)
      newRec.forEach(mainprop => {
        delete data[mainprop];
      });
  }
  // Результат проверки
  if (!hut.isObjIdle(errdata))
    throw { error: 'Validation', message: appconfig.getMessage('FailUpdate'), data: errdata };

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
  if (!rule.empty && !value) return rule.description;
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
