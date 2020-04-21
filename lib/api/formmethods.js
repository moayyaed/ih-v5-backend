/**
 * formmethods.js
 * Подготовка для сохранения данных, введенных на форме
 *
 */

const util = require('util');
const fs = require('fs');

// const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const dm = require('../datamanager');
const descriptor = require('../descriptor');

const tagstore = require('./tagstore');

const validator = require('./updateutils/validator');
const getMetaUpForm = require('./updateutils/getMetaUpForm');

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

  const metaUpFormData = await dm.getCachedData({type:'upform', id, method:'getmeta'}, getMetaUpForm);
  const metaUpForm = metaUpFormData.data;


  const spec = ['devlink']; // Значение разбирается и пишется в несколько полей

  // Плоские данные doc - по одной записи на таблицу  Собрать все поля из разных плашек
  // Табличные данные - берем все, что прислали для таблички
  // recsToWrite = {
  //     tableName:{
  //       _id:<nodeid>,
  //       doc:{name:"..", txt:"..", tags:["",""]},
  //       table: {"value":{ "max":40}, "setpoint":{"min":-2, "vtype":"N", "op":"rw"}, "oldprop":""} }

  //       потом сюда добавим в формате сохранения БД
  //       $set:{name:"..", txt:"..", tags:["",""], "props.value.max":40, "props.setpoint.min":-2 }
  //       unset:{ "oldprop":1}
  //
  const recsToWrite = {};

  const res = {};
  console.log('metaUpForm='+ util.inspect(metaUpForm));

  // Поля со спец типами данных, которые сохраняются, например, в файл, а не в таблицу
  const exfieldtype = metaUpForm.exfieldtype || {};
  console.log('EXFIELDTYPE='+ util.inspect(exfieldtype));
  Object.keys(exfieldtype).forEach(field => {
    const item = exfieldtype[field];
    if (payload[item.cell] && payload[item.cell][field]) {
      saveExField(item, field, nodeid, payload[item.cell][field]);
    }
  });

  metaUpForm.records.forEach(item => {
    
    if (payload[item.cell]) {
      if (!recsToWrite[item.table]) recsToWrite[item.table] = { _id: nodeid, doc: {} };

      Object.keys(payload[item.cell]).forEach(field => {
        if (spec.includes(field)) {
          const val = payload[item.cell][field];
          if (typeof val == 'object') {
            // Пришли пары ключ-значение, записать как отдельные поля
            for (const prop in val) {
              recsToWrite[item.table].doc[prop] = val[prop];
            }
          }
        } else if (!exfieldtype[field]) {
          recsToWrite[item.table].doc[field] = payload[item.cell][field];
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

  console.log('recsToWrite =' + util.inspect(recsToWrite, null, 4));

  // Сначала выполнить валидацию данных, так как ответ должен быть один!!
  await validator.validateForm(metaUpForm, recsToWrite);

  // Загрузка docs, формирование $set, $unset, обработка tags
  try {
    for (const table in recsToWrite) {
      const desc = descriptor.getTableDesc(table);
      const collection = desc.collection;
      if (desc.rows) {
        // Только табличные данные?
        /**
         * recsToWrite ={
          unitchannelsTable: {
          _id: 'mqttclient1',
          table: {
            d0584: { topic: '/MT8102iE/Time_Heat111' },
            d0585: { topic: '/MT8102iE/Time_Forge111' },
            d0586: { topic: '/MT8102iE/Pressure_Heat111' }
          }}}
         */
        if (recsToWrite[table].table) {
          res[table] = { docs: [] };
          for (const _id in recsToWrite[table].table) {
            const olddoc = await dm.dbstore.findOne(collection, { _id });
            if (!olddoc) throw new Error('Not found doc: _id = ' + _id + ', collection ' + collection);
            const resDoc = olddoc;
            resDoc.$set = recsToWrite[table].table[_id];
            res[table].docs.push(resDoc);
          }
        }
      } else {
        const _id = recsToWrite[table]._id;

        const olddoc = await dm.dbstore.findOne(collection, { _id });
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

          // Отбработка новых строк (Временный ключ начинается с двойного подчеркивания )
          // Добавить поля по умолчанию в новые строки
          processNewRows(table, tabdata);

          const setObj = makeSetObj(tabdata, desc.genfield);
          if (setObj) {
            resDoc.$set = Object.assign({}, resDoc.$set, setObj);
          }
          resDoc.$unset = makeUnsetObj(tabdata, desc.genfield);
        }
        res[table] = { docs: [resDoc] };
      }
    }
  } catch (e) {
    throw new Error('Update error: ' + util.inspect(e));
  }
  return { res };
}

function processNewRows(table, data) {
  let tempRec;

  for (const mainprop in data) {
    if (mainprop.substr(0, 2) == '__') {
      // Временный ключ начинается с двойного подчеркивания
      // Это новая запись - создать новый id = newid если есть. Если нет - взять ключ но убрать __? Или генерировать новый?
      const newkey = data[mainprop].newid || mainprop.substr(2);

      // скопировать объект с новым ключом, временный удалить после цикла. В новый объект id и newid вставлять не надо!
      if (data[mainprop]) data[newkey] = formNewTableRow(table, data[mainprop]);
      if (!tempRec) tempRec = [];
      tempRec.push(mainprop);
    }
  }

  if (tempRec) {
    tempRec.forEach(mainprop => {
      delete data[mainprop];
    });
  }
}

function saveExField(exFieldItem, field, nodeid, value) {
  console.log('saveExField START '+util.inspect(exFieldItem));
  if (exFieldItem.type == 'code') {
    // Если код - сразу сохранить в файл, возможно, предварительно проверить!!
    const filename = appconfig.getScriptFilename(nodeid);
    console.log('saveExField filename '+filename)
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

function formNewTableRow(table, dataObj) {
  const res = { ...dataObj };
  delete res.id;
  delete res.newid;

  switch (table) {
    case 'type':
      if (!res.vtype || typeof res.vtype == 'object') res.vtype = 'N';
      if (!res.op || typeof res.op == 'object') res.op = 'r';
      if (res.vtype != 'N') {
        res.max = null;
        res.min = null;
        res.dog = null;
      }
      break;
    default:
  }
  return res;
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
