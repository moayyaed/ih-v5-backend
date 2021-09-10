/**
 * formmethods.js
 * Подготовка для сохранения данных, введенных на форме
 *
 */

// const util = require('util');

const hut = require('../utils/hut');
const descriptor = require('../descriptor');
const appconfig = require('../appconfig');

const tagstore = require('./tagstore');
const datautil = require('./datautil');
const validator = require('./updateutils/validator');
const getMetaUpForm = require('./updateutils/getMetaUpForm');
const commander = require('../appspec/commander');

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
async function update(body, holder) {
  const dm = holder.dm;
  if (!body) throw { err: 'SOFTERR', message: 'Update error - missing body!' };
  let { id, nodeid, rowid, payload } = body;
  const res = {};
  const insert = {};
  const remove = {};

  const metaUpFormData = await dm.getCachedData({ type: 'upform', id, nodeid, method: 'getmeta' }, getMetaUpForm);
  const metaUpForm = metaUpFormData.data;

  const spec = ['devlink', 'devtrig', 'chanlink', 'dn_prop', 'id_prop', 'cmd_prop']; // Значение разбирается и пишется в несколько полей
  const specFields = {
    devlink: ['did', 'prop'],
    chanlink: ['did', 'prop']
  };

  // console.log('UPDATE nodeid='+nodeid+' id='+id);

  const preNodeid = nodeid;
  if (datautil.isLink(nodeid)) {
    nodeid = await dm.datagetter.getRecordIdByLink(id, nodeid, rowid, dm);
  }
  // console.log('UPDATE link nodeid='+nodeid);

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
  const exfieldObj = metaUpForm.exfieldtype || {};
  // await processExfieldtype(exfieldObj);

  // Плоские данные
  metaUpForm.records.forEach(item => {
    if (payload[item.cell]) {
      if (!recsToWrite[item.table]) recsToWrite[item.table] = { _id: nodeid, doc: {} };

      Object.keys(payload[item.cell]).forEach(field => {
        if (spec.includes(field)) {
          processSpecField(field, item);
        } else if (field == '_inputval') {
          processInputval(item.table, nodeid, payload[item.cell][field]);
        } else if (!exfieldObj[field]) {
          recsToWrite[item.table].doc[field] = payload[item.cell][field];
        }
      });
    }
  });

  await processExfieldtype(exfieldObj);

  // Табличные данные
  for (const tableId in metaUpForm.tables) {
    const item = metaUpForm.tables[tableId];
    if (payload[item.cell] && payload[item.cell][item.prop] && typeof payload[item.cell][item.prop] == 'object') {
      if (!recsToWrite[item.table]) recsToWrite[item.table] = { _id: nodeid };
      const payloadItem = payload[item.cell][item.prop];

      // Обработка spec полей  - chanlink, devlink, dn_prop
      for (const xrowid in payloadItem) {
        const rowObj = payloadItem[xrowid];
        for (const columnField in rowObj) {
          if (spec.includes(columnField) && typeof rowObj[columnField] == 'object') {
            // chanlink:{id, prop, title, ...}
            // {nodeid, rowid, field, fieldItem}
            const specVal = await dm.datamaker.processTableSpecField(
              { nodeid, rowid: xrowid, field: columnField, fieldItem: rowObj[columnField] },
              dm
            );
            if (specVal == undefined) {
              delete rowObj[columnField];
            } else {
              rowObj[columnField] = specVal;
            }
          } else if (columnField == '_inputval' && rowObj[columnField]) {
            // Ручной ввод значения - например для устройств
            processInputval(item.table, xrowid, rowObj[columnField]);
            delete rowObj[columnField];
          }
        }
      }

      recsToWrite[item.table].table = payloadItem;
    }
    // });
  }

  // console.log('recsToWrite =' + util.inspect(recsToWrite, null, 4));

  // console.log('BEFORE VALIDATE ' + util.inspect(recsToWrite, null, 4));
  // Выполнить валидацию данных
  await validator.validateForm(metaUpForm, recsToWrite, dm);

  // Подготовка документов для записи: формирование $set, $unset, обработка tags
  try {
    for (const table in recsToWrite) {
      const desc = descriptor.getTableDesc(table);
      if (desc.store == 'none' || desc.store == 'tree') {
        await saveOther(table, desc);
      } else if (desc.rows) {
        await formForRows(table, desc);
      } else if (datautil.isNewRecord(recsToWrite[table]._id)) {
        await formNewRecord(table, desc);
      } else {
        await formForOne(table, desc);
      }
    }
  } catch (e) {
    if (e.error == 'Validation') throw e;
    throw { message: appconfig.getMessage('DataUpdateError') +': '+ hut.getShortErrStr(e) };
  }

  const result = { res };
  if (!hut.isObjIdle(insert)) result.insert = insert;
  if (!hut.isObjIdle(remove)) result.remove = remove;
  // console.log('UPDATE result =' + util.inspect(result, null, 4));

  return result;

  // Внутренние функции
  async function processExfieldtype(exfieldtype) {
    // console.log('processExfieldtype preNodeid=' + preNodeid);
    // const exfieldtype = metaUpForm.exfieldtype || {};
    for (const field of Object.keys(exfieldtype)) {
      const item = exfieldtype[field];
      if (payload[item.cell] && payload[item.cell][field]) {
        // {item, field, nodeid, value}
        const chItem = await dm.datamaker.saveExField(
          { item, field, nodeid: preNodeid, value: payload[item.cell][field] },
          dm
        );

        if (chItem && chItem.table && chItem.doc) {
          if (!recsToWrite[chItem.table]) recsToWrite[chItem.table] = { _id: nodeid, doc: {} };
          recsToWrite[chItem.table].doc = { ...recsToWrite[chItem.table].doc, ...chItem.doc };
        }
      }
    }
    // return exfieldtype;
  }

  function processInputval(table, rowId, value) {
    if (table == 'devicecommonTable') {
      // Установить значение свойству (параметру?) - выполнить assign?
      if (nodeid && rowId && holder.devSet[nodeid]) {
        // holder.devSet[nodeid].assign(rowId, value, sender);
        // holder.devSet[nodeid].setValue(rowId, value, { login: 'admin' });
        commander.execSet(null, { did: nodeid, prop: rowId, value }, holder);
      }
    } else if (table == 'glcurrentTable') {
      commander.execSet(null, { did: nodeid, value }, holder);
    }
  }

  function processSpecField(field, item) {
    const val = payload[item.cell][field];

    // Нужные поля должны придти внутри value - devlink:{value:{did:'d001', 'prop':'setpont'}}
    // Если devlink:{value:""} - сбросить поля
    // if (typeof val == 'object' && val.value != undefined) {
    if (typeof val == 'object' && (val.value != undefined || val.result != undefined)) {
      const sf_arr = specFields[field];
      const valValue = val.value != undefined ? val.value : val.result;

      sf_arr.forEach(sf => {
        recsToWrite[item.table].doc[sf] = valValue && valValue[sf] != undefined ? valValue[sf] : '';
      });
    }
    /**
  val={
  prop: 'closeValveWater',
  title: 'room_223.closeValveWater',
  title2: 'Закрыть воду в номере',
  link: '',
  enable: true,
  result: {
    did: 'd0270',
    prop: 'closeValveWater',
    title: 'room_223.closeValveWater',
    dn: 'room_223',
    value: { did: 'd0270', prop: 'closeValveWater' }
  }
}

     */
  }

  async function saveOther(table) {
    // console.log('SAVE OTHER ' + table + ' nodeid=' + nodeid+' recsToWrite='+util.inspect(recsToWrite, null, 4));
    if (table == 'systemsettingsTable') {
      await dm.datamaker.saveConfig(recsToWrite[table].doc);
    } else if (table == 'currentprojectTable') {
      await dm.datamaker.saveCurrentProjectSettings(recsToWrite[table].doc, nodeid, holder);
    } else if (table == 'typepropalertTable') {
      await dm.datamaker.saveTypepropalert(recsToWrite[table].table, nodeid, holder);
    } else if (table == 'devicesTreeTable') {
      await dm.datamaker.saveDevicesTreeTable(recsToWrite[table].table, nodeid, holder);
    } else if (table == 'customdataTable') {
      const restable = await getCustomdataTablename();
      await formForRows(table, { collection: restable, rows: true, upsert: true }, restable);
      // customdataTable: { _id: 'cttab003', table: { yox3nr7KDk: { is_activated: 1 } } }
    }
  }

  async function getCustomdataTablename() {
    const doc = await dm.findOne('customtable', { _id: nodeid });
    if (!doc) throw new Error('Not found doc: _id = ' + nodeid + ', table customtable');
    return doc.tablename;
  }

  async function formForRows(table, desc, restable) {
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
    if (!restable) restable = table;

    if (recsToWrite[table].table) {
      res[restable] = { docs: [] };
      for (const rid in recsToWrite[table].table) {
        if (recsToWrite[table].table[rid] == null) {
          // Удаление строки
          if (!remove[restable]) remove[restable] = { docs: [] };
          remove[restable].docs.push({ _id: rid });
        } else if (isNewRow(rid)) {
          // Добавление строки
          if (!insert[restable]) insert[restable] = { docs: [] };
          // Генерировать новый id в подчиненной таблице, сформировать строку (включить туда id главной таблицы)
          insert[restable].docs.push(
            // {table, filter, item, parentid, body}
            await dm.datamaker.createOneRecord(
              { table: restable, filter: {}, item: recsToWrite[table].table[rid], parentid: recsToWrite[table]._id },
              dm
            )
          );
        } else {
          const olddoc = await dm.findOne(restable, { _id: rid });
          if (!olddoc) {
            if (!desc.upsert) throw new Error('Not found doc: _id = ' + rid + ', table ' + restable);

            // Добавление строки
            if (!insert[restable]) insert[restable] = { docs: [] };
            // Генерировать новый id в подчиненной таблице, сформировать строку (включить туда id главной таблицы)
            insert[restable].docs.push(
              // {table, filter, item, parentid, body}
              await dm.datamaker.createOneRecord(
                {
                  table: restable,
                  filter: { id: rid, nodeid },
                  item: recsToWrite[table].table[rid],
                  parentid: recsToWrite[table]._id
                },
                dm
              )
            );
          } else {
            const resDoc = olddoc;
            resDoc.$set = recsToWrite[table].table[rid];
            res[restable].docs.push(resDoc);
          }
        }
      }
    }
  }

  async function formForOne(table, desc) {
    const _id = recsToWrite[table]._id;

    const olddoc = await dm.datamaker.findOrAddDoc({ collection: desc.collection, id: _id }, dm);
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

  async function formNewRecord(table, desc) {
    if (recsToWrite[table].doc) {
      if (!insert[table]) insert[table] = { docs: [] };
      insert[table].docs.push(
        // {table, filter, item, parentid, body}
        await dm.datamaker.createOneRecord(
          { table, filter: {}, item: recsToWrite[table].doc, parentid: recsToWrite[table]._id, body },
          dm
        )
      );
    }
  }
}

function processNewRows(table, data, olddoc, metaData) {
  // console.log('NEW ROWS ' + table + ' data=' + util.inspect(data) + ' metaData=' + util.inspect(metaData));

  const tempRec = [];
  const renamed = {};
  for (const mainprop in data) {
    if (mainprop.substr(0, 2) == '__') {
      // Временный ключ начинается с двойного подчеркивания
      if (data[mainprop] != null) {
        // Могут добавить и сразу удалить - тогда приходит {__udii7eQzU: null} !!
        // Это новая запись - создать новый id = newid если есть. Если нет - взять ключ но убрать __? Или генерировать новый?
        const newkey = data[mainprop].newid || mainprop.substr(2);

        // Если есть genfilter - добавить его в запись
        const genfilter = getGenfilterFromMetadata(table, metaData);

        // скопировать объект с новым ключом, временный удалить после цикла. В новый объект id и newid вставлять не надо!
        if (data[mainprop]) data[newkey] = formNewTableRow(table, data[mainprop], genfilter);
        tempRec.push(mainprop);
      }
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
      // Внутри записи не д б объектов : {id:'-', title:'-'}
      Object.keys(res).forEach(prop => {
        if (typeof res[prop] == 'object') {
          res[prop] = '';
        }
      });
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
