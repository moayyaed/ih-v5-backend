/**
 * formmethods.js
 * Подготовка для сохранения данных, введенных на форме
 *
 */

const util = require('util');
// const fs = require('fs');
const path = require('path');

const hut = require('../utils/hut');
const fileutil = require('../utils/fileutil');
const appconfig = require('../appconfig');
const dm = require('../datamanager');
const descriptor = require('../descriptor');

const tagstore = require('./tagstore');
const datautil = require('./datautil');
const validator = require('./updateutils/validator');
const getMetaUpForm = require('./updateutils/getMetaUpForm');

const sceneutils = require('../scene/sceneutils');
const datamaker = require('../appspec/datamaker');
const datagetter = require('../appspec/datagetter');

/**
 * Сохранение данных формы.
 *    На форме могут быть данные из нескольких таблиц
 *  - Вернуть :
 *      документ(ы), которые нужно изменить, сгруппированные по таблицам - res
 *      также могут быть записи для добавления - insert
 *      также могут быть записи для удаления - remove
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
 *    {res:{<table>:{docs:[]}} <, insert:{<table>:{docs:[]}> <, remove:{<table>:{docs:[]}>}
 *
 */
async function update(body) {
  let { id, nodeid, rowid, payload } = body;
  const res = {};
  const insert = {};
  const remove = {};

  const metaUpFormData = await dm.getCachedData({ type: 'upform', id, nodeid, method: 'getmeta' }, getMetaUpForm);
  const metaUpForm = metaUpFormData.data;

  const spec = ['devlink', 'chanlink']; // Значение разбирается и пишется в несколько полей
  const specFields = {
    devlink: ['did', 'prop'],
    chanlink: ['did', 'prop']
  };

  if (datautil.isLink(nodeid)) {
    nodeid = await datagetter.getRecordIdByLink(id, nodeid, rowid);
  }

  const recsToWrite = {};
  // recsToWrite - промежуточный объект - собрать с формы и подготовить для записи
  // Группируем по таблицам
  // Плоские данные помещаем в doc - по одной записи на таблицу  Собрать все поля из разных плашек
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

  // Поля со спец типами данных, которые сохраняются, например, в файл, а не в таблицу
  const exfieldObj = await processExfieldtype();

  // Плоские данные
  metaUpForm.records.forEach(item => {
    if (payload[item.cell]) {
      if (!recsToWrite[item.table]) recsToWrite[item.table] = { _id: nodeid, doc: {} };

      Object.keys(payload[item.cell]).forEach(field => {
        if (spec.includes(field)) {
          processSpecField(field, item);
        } else if (!exfieldObj[field]) {
          recsToWrite[item.table].doc[field] = payload[item.cell][field];
        }
      });
    }
  });

  // Табличные данные
  metaUpForm.tables.forEach(item => {
    if (payload[item.cell] && payload[item.cell][item.prop] && typeof payload[item.cell][item.prop] == 'object') {
      if (!recsToWrite[item.table]) recsToWrite[item.table] = { _id: nodeid };

      recsToWrite[item.table].table = payload[item.cell][item.prop];
    }
  });

  // console.log('recsToWrite =' + util.inspect(recsToWrite, null, 4));

  // Выполнить валидацию данных
  await validator.validateForm(metaUpForm, recsToWrite);

  // Подготовка документов для записи: формирование $set, $unset, обработка tags
  try {
    for (const table in recsToWrite) {
      const desc = descriptor.getTableDesc(table);
      if (desc.rows) {
        await formForRows(table, desc);
      } else if (isNewRecord(table)) {
        await formNewRecord(table, desc);
      } else {
        await formForOne(table, desc);
      }
    }
  } catch (e) {
    throw new Error('Update error: ' + util.inspect(e));
  }

  const result = { res };
  if (!hut.isObjIdle(insert)) result.insert = insert;
  if (!hut.isObjIdle(remove)) result.remove = remove;
  return result;

  // Внутренние функции
  async function processExfieldtype() {
    const exfieldtype = metaUpForm.exfieldtype || {};
    for (const field of Object.keys(exfieldtype)) {
      const item = exfieldtype[field];
      if (payload[item.cell] && payload[item.cell][field]) {
        await saveExField(item, field, nodeid, payload[item.cell][field]);
      }
    }
    return exfieldtype;
  }

  function processSpecField(field, item) {
    const val = payload[item.cell][field];
    // Нужные поля должны придти внутри value - devlink:{value:{did:'d001', 'prop':'setpont'}}
    // Если devlink:{value:""} - сбросить поля
    if (typeof val == 'object' && val.value != undefined) {
      const sf_arr = specFields[field];

      sf_arr.forEach(sf => {
        recsToWrite[item.table].doc[sf] = val.value && val.value[sf] != undefined ? val.value[sf] : '';
      });
    }
  }

  async function formForRows(table, desc) {
    // Табличные данные в отдельной таблице
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
      for (const rid in recsToWrite[table].table) {
        if (recsToWrite[table].table[rid] == null) {
          // Удаление строки
          if (!remove[table]) remove[table] = { docs: [] };
          remove[table].docs.push({ _id: rid });
        } else if (isNewRow(rid)) {
          // Добавление строки
          if (!insert[table]) insert[table] = { docs: [] };
          // Генерировать новый id в подчиненной таблице, сформировать строку (включить туда id главной таблицы)
          insert[table].docs.push(
            await datamaker.createOneRecord(table, {}, recsToWrite[table].table[rid], recsToWrite[table]._id)
          );
        } else {
          const olddoc = await dm.dbstore.findOne(desc.collection, { _id: rid });
          if (!olddoc) throw new Error('Not found doc: _id = ' + rid + ', collection ' + desc.collection);
          const resDoc = olddoc;
          resDoc.$set = recsToWrite[table].table[rid];
          res[table].docs.push(resDoc);
        }
      }
    }
  }

  async function formForOne(table, desc) {
    const _id = recsToWrite[table]._id;

    const olddoc = await datamaker.findOrAddDoc(desc.collection, _id);
    const resDoc = olddoc;

    if (recsToWrite[table].doc) {
      const newDoc = recsToWrite[table].doc;
      // обработать поле tags - старые тэги удалить, новые сохранить
      if (newDoc.tags) tagstore.update(olddoc.tags, newDoc.tags, _id, desc.collection);
      // Все изменения полей записать в $set
      resDoc.$set = newDoc;
    }

    // Добавить изменения из таблицы
    if (recsToWrite[table].table) {
      const tabdata = recsToWrite[table].table;

      // Отбработка новых строк (Временный ключ начинается с двойного подчеркивания )
      // Добавить поля по умолчанию в новые строки
      // Также обработать, если переименовано поле newid (переименование свойства)
      resDoc.$renamed = processNewRows(table, tabdata, resDoc, metaUpForm.tables);

      // При переименовании - нужно вставить значения старого свойства в новое

      const setObj = makeSetObj(tabdata, desc.genfield);
      if (setObj) {
        resDoc.$set = Object.assign({}, resDoc.$set, setObj);
      }
      resDoc.$unset = makeUnsetObj(tabdata, desc.genfield);
    }
    res[table] = { docs: [resDoc] };
  }

  function isNewRecord(table) {
    return (recsToWrite[table]._id == '__new');
  }

  async function formNewRecord(table, desc) {
    if (recsToWrite[table].doc) {
      if (!insert[table]) insert[table] = { docs: [] };
      insert[table].docs.push(
        await datamaker.createOneRecord(table, {}, recsToWrite[table].doc, recsToWrite[table]._id)
      );
    }
  }
}

function processNewRows(table, data, olddoc, metaData) {
  console.log('NEW ROWS ' + table + ' data=' + util.inspect(data) + ' metaData=' + util.inspect(metaData));

  const tempRec = [];
  const renamed = {};
  for (const mainprop in data) {
    if (mainprop.substr(0, 2) == '__') {
      // Временный ключ начинается с двойного подчеркивания
      // Это новая запись - создать новый id = newid если есть. Если нет - взять ключ но убрать __? Или генерировать новый?
      const newkey = data[mainprop].newid || mainprop.substr(2);

      // Если есть genfilter - добавить его в запись
      const genfilter = getGenfilterFromMetadata(table, metaData);

      // скопировать объект с новым ключом, временный удалить после цикла. В новый объект id и newid вставлять не надо!
      if (data[mainprop]) data[newkey] = formNewTableRow(table, data[mainprop], genfilter);
      tempRec.push(mainprop);
    } else if (data[mainprop] && data[mainprop].newid && mainprop != data[mainprop].newid) {
      // Переименование свойства - добавить как новое, старое удалить
      const newkey = data[mainprop].newid;
      renamed[mainprop] = newkey;

      const olddata = olddoc.props ? olddoc.props[mainprop] : '';
      data[newkey] = formNewTableRow(table, { ...olddata, ...data[mainprop] });
      data[mainprop] = ''; // Будет включено в unset
    }
  }

  if (tempRec.length) {
    tempRec.forEach(mainprop => {
      delete data[mainprop];
    });
  }
  return !hut.isObjIdle(renamed) ? renamed : '';
}

function getGenfilterFromMetadata(table, metaData) {
  let result = '';
  let filter;
  if (metaData && Array.isArray(metaData)) {
    metaData.forEach(item => {
      if (item.table == table && item.genfilter) filter = item.genfilter;
    });
  }

  // Вернуть новый объект - убрать поля с '!def'
  if (filter) {
    Object.keys(filter).forEach(prop => {
      if (typeof filter[prop] != 'string' || !filter[prop].startsWith('!def')) {
        if (!result) result = {};
        result[prop] = filter[prop];
      }
    });
  }
  return result;
}

async function saveExField(exFieldItem, field, nodeid, value) {
  let filename;
  switch (exFieldItem.type) {
    case 'code':
      if (field == 'handler') {
        filename = appconfig.getHandlerFilename(nodeid);
      } else {
        sceneutils.processScriptStr(value); // Это валидация. Если будет ошибка - throw

        // Если код - сразу сохранить в файл, возможно, предварительно проверить!!
        filename = appconfig.getScriptFilename(nodeid);
      }
      await fileutil.writeFileP(filename, value);
      break;

    case 'layout':
    case 'container':
    case 'template':
      dm.invalidateCache({ type: 'pobj', id: exFieldItem.type, nodeid });

      filename = path.resolve(appconfig.get('jbasepath'), exFieldItem.type, nodeid + '.json');
      await fileutil.writeFileP(filename, value); // stringify внутри
      // fs.writeFileSync(filename, JSON.stringify(value), 'utf8');
      break;
    default:
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

function isNewRow(rowid) {
  return rowid.substr(0, 2) == '__';
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

function formNewTableRow(table, dataObj, genfilter) {
  const res = { ...dataObj, ...genfilter };
  delete res.id;
  delete res.newid;

  switch (table) {
    case 'type':
      if (!res.vtype || typeof res.vtype == 'object') res.vtype = 'N';
      if (!res.op || typeof res.op == 'object') res.op = 'r';
      if (res.vtype != 'N') {
        res.max = null;
        res.min = null;
        res.dig = null;
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
