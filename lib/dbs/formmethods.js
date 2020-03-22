/**
 * formmethods.js
 * Подготовка для сохранения данных, введенных на форме
 *
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const dbstore = require('./dbstore');
const descriptor = require('./descriptor');
const dataformer = require('./dataformer');
const tagstore = require('./tagstore');

/**
 * Сохранение данных формы.
 *    На форме могут быть данные из нескольких таблиц
 *  - Вернуть :
 *      res - документ(ы), которые нужно изменить, сгруппированные по таблицам
 *
 * @param {Object} body
 *       id - идентификатор формы
 *   nodeid - идентификатор данных (узел, из которого вызывана форма)
 *  payload - объект содержит измененные данные формы по плашкам:
 *
 *          {"p1":{"name":"My record"},
 *           "p2":{"txt":"This is comment", "tags":["Climat"]},
 *          "p3":{"typepropsTable":{"value":{ "max":40}, "setpoint":{"min":-2, "vtype":"N", "op":"rw"}}}}
 *          Таблица приходит как объекты с ключами = id строки  (value, setpoint)
 *          Получаем только измененные значения полей
 *
 * @return {Object} -
 *    {res:{<table>:{docs:[]}}}
 *     Элемент docs: Содержит копию документа до редактирования + поля $set, $unset
 *
 */
async function update(body) {
  const { id, nodeid, payload } = body;

  const metaUpForm = await dataformer.getMetaUpForm(id);

  // Поля со спец типами данных, которые сохраняются, например, в файл, а не в таблицу
  const exfieldtype = metaUpForm.exfieldtype || {};

  // Плоские данные doc - по одной записи на таблицу  Собрать все поля из разных плашек
  // Табличные данные - берем все, что прислали для таблички
  // recsToWrite = {
  //     tableName:{
  //       _id:<nodeid>,
  //       doc:{name:"..", txt:"..", tags:["",""]},
  //       table: {"value":{ "max":40}, "setpoint":{"min":-2, "vtype":"N", "op":"rw"}, "oldprop":""} }

  //       потом сюда добавим в формате сохранения БД
  //       set:{name:"..", txt:"..", tags:["",""], "props.value.max":40, "props.setpoint.min":-2 }
  //       unset:{ "oldprop":1}
  //
  const recsToWrite = {};

  const res = {};

  console.log('metaUpForm ='+util.inspect(metaUpForm, null, 4))

  metaUpForm.records.forEach(item => {
    if (payload[item.cell]) {
      if (!recsToWrite[item.table]) recsToWrite[item.table] = { _id: nodeid, doc: {} };

      Object.keys(payload[item.cell]).forEach(field => {
        if (!exfieldtype[field]) {
          recsToWrite[item.table].doc[field] = payload[item.cell][field];
        } else {
          saveExField(exfieldtype[field], field, nodeid, payload[item.cell][field]);
        }
      });
    }
  });

  metaUpForm.tables.forEach(item => {
    if (payload[item.cell] && payload[item.cell][item.prop] && typeof payload[item.cell][item.prop] == 'object') {
      if (!recsToWrite[item.table]) recsToWrite[item.table] = { _id: nodeid };

      recsToWrite[item.table].table = payload[item.cell][item.prop];
    }
  });

  console.log('recsToWrite ='+util.inspect(recsToWrite, null, 4))
  // Сначала выполнить валидацию данных, так как ответ должен быть один!!
  validateForm(metaUpForm, recsToWrite);

  // Загрузка docs, формирование $set, $unset, обработка tags
  try {
    for (const table in recsToWrite) {
      const desc = descriptor.getTableDesc(table);
      const collection = desc.collection;
      const _id = recsToWrite[table]._id;

      const olddoc = await dbstore.findOne(collection, { _id });
      if (!olddoc) throw new Error('Not found doc: _id = ' + _id + ', collection ' + collection);
     
      const resDoc = olddoc;

      if (recsToWrite[table].doc) {
        const newDoc = recsToWrite[table].doc;
        // обработать поле tags - старые тэги удалить, новые сохранить
        if (newDoc.tags) tagstore.update(olddoc.tags, newDoc.tags, _id, collection);
        // Все изменения полей записать в $set
        resDoc.$set = newDoc;
      }

      // Добавить изменения из таблицы
      if (recsToWrite[table].table) {
        const tabdata = recsToWrite[table].table;
        const setObj = makeSetObj(tabdata, desc.genfield);
        if (setObj) {
          resDoc.$set = Object.assign({}, resDoc.$set, setObj);
        }
        resDoc.$unset  = makeUnsetObj(tabdata, desc.genfield);
      }
      res[table] = { docs: [resDoc] };

    }
  } catch (e) {
    throw new Error('Update error: ' + util.inspect(e));
  }

  console.log('res ='+util.inspect(res, null, 4))
  return {res};
}

function saveExField(fieldtype, field, nodeid, value) {
  if (fieldtype == 'code') {
    // Если код - сразу сохранить в файл, возможно, предварительно проверить!!
    const filename = appconfig.getScriptFilename(nodeid);
    fs.writeFileSync(filename, value, 'utf8');
  }
}

function makeSetObj(data, genfield) {
  let setObj;
  // data = { value:{ max: 42, min: 17 }, newkey:{min:0, max:100}}
  // Для вложенных нужно вернуть "props.value.max":42, "props.value.min":17, props.newkey.max = 100
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

function validateForm(metaUpForm, recsToWrite) {
  const errdata = {};
  // Проверка records
  for (const table in recsToWrite) {
    const doc = recsToWrite[table].doc;
    if (doc) {
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
    validateTable(table, recsToWrite[table].table);
  }

  // Результат проверки
  if (!hut.isObjIdle(errdata))
    throw { error: 'Validation', message: appconfig.getMessage('FailUpdate'), data: errdata };

  function validateTable(table, data) {
    if (!data) return;

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

  function addErrdata(table, prop, text) {
    const cellid = metaUpForm.alloc[table][prop];
    if (!errdata[cellid]) errdata[cellid] = {};
    errdata[cellid][prop] = text;
  }

  //  { p3: { [table]: { [mainprop]: { [prop]: 'Отрицательное значение :' + val } } } }
  function addErrTabdata(table, mainprop, prop, text) {
    const cellid = metaUpForm.alloc[table][prop];
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
  update,
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
