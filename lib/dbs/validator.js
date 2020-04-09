/**
 * validator.js
 *
 */
// const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const descriptor = require('./descriptor');
const dbstore = require('./dbstore');

const mustMess = {
  notempty: 'mustBeNotEmptyString',
  unique: 'mustBeUnique',
  min: 'mustBeLessToMax',
  max: 'mustBeGreaterToMin'
};

async function validateForm(metaUpForm, recsToWrite) {
  const errdata = {};
  // Проверка records
  for (const table in recsToWrite) {
    const doc = recsToWrite[table].doc;
    const _id = recsToWrite[table]._id;
    if (doc) {
      const valObj = descriptor.getTableValidator(table);
      if (valObj && valObj.main) {
        for (const prop in doc) {
          if (valObj.main[prop]) {
            const errTxt = await checkProp({ rule: valObj.main[prop], prop, doc, _id, table });
            if (errTxt) addErrdata(table, prop, errTxt);
          }
        }
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
      if (data[mainprop] && typeof data[mainprop] == 'object') {
        //  __M06Osa6g5:null - ЭТО ОБЪЕКТ!!!
        if (mainprop.substr(0, 2) == '__') {
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
    if (newRec) {
      newRec.forEach(mainprop => {
        delete data[mainprop];
      });
    }
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

async function checkProp({ rule, prop, doc, _id, table }) {
  const value = doc[prop];
  if ((rule.notempty || rule.unique) && !value) return appconfig.getMessage(mustMess.notempty);
  if (rule.unique) {
    const isUnique = await isValueUnique(prop, doc, _id, table);
    if (!isUnique) return appconfig.getMessage(mustMess.unique);
  }
}

async function isValueUnique(prop, doc, _id, table) {
  const desc = descriptor.getTableDesc(table);
  const data = await dbstore.get(desc.collection, { [prop]: doc[prop] }, { fields: { [prop]: 1 } });

  if (data.length > 1) return false;
  // Если запись есть - то id записи должно совпадать!
  if (data.length == 1 && _id != data[0]._id) return false;
  return true;
}

function checkInsert(doc, valObj) {
  if (!valObj) return true;
  if (!doc) throw { err: 'ERRINSERT', message: 'No doc to insert!' };
  if (typeof doc != 'object') throw { err: 'ERRINSERT', message: 'Expected object type for insertion!' };

  if (valObj.required && Array.isArray(valObj.required)) {
    valObj.required.forEach(prop => {
      if (doc[prop] == undefined) throw { doc, message: 'Field "' + prop + '" is required!' };
    });
  }

  return checkProperties(doc, valObj);
}

function checkUpdate(doc, valObj) {
  if (!valObj) return true;
  return checkProperties(doc, valObj);
}

function checkProperties(doc, valObj) {
  if (!valObj || !valObj.properties) return true;
  Object.keys(doc).forEach(prop => {
    if (valObj.properties[prop]) {
      const rule = valObj.properties[prop];

      if (rule.type != typeof doc[prop]) throw { doc, message: 'Field "' + prop + '" ' + rule.description };
      if (rule.notempty && !doc[prop]) throw { doc, message: 'Field ' + prop + '" ' + rule.description };
    }
  });
  return true;
}

module.exports = {
  validateForm,
  checkInsert,
  checkUpdate
};
