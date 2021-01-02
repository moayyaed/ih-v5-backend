/**
 * validator.js
 *
 */
const util = require('util');

const hut = require('../../utils/hut');
const appconfig = require('../../appconfig');
const descriptor = require('../../descriptor');
const dm = require('../../datamanager');

const datamaker = require('../../appspec/datamaker');

const mustMess = {
  notempty: 'mustBeNotEmpty',
  validid: 'mustBeValidId',
  unique: 'mustBeUnique',
  min: 'mustBeLessToMax',
  max: 'mustBeGreaterToMin',
  selectFromList: 'selectFromList'
};

async function validateForm(metaUpForm, recsToWrite) {
  const errdata = {};
  // Проверка records
  for (const table in recsToWrite) {
    const doc = recsToWrite[table].doc;
    const _id = recsToWrite[table]._id;

    const valObj = descriptor.getTableValidator(table);
    if (doc) {
      if (valObj && valObj.main) {
        for (const prop in doc) {
          if (valObj.main[prop]) {
            const errTxt = await checkProp({ rule: valObj.main[prop], prop, doc, _id, table });
            if (errTxt) addErrdata(table, prop, errTxt);
          }
        }
      }
    }

    if (recsToWrite[table].table && valObj) {
      preValidateTable(table, recsToWrite[table].table, getTablePropName(table), valObj.props);
      if (valObj && valObj.props) {
        await validateTable(table, recsToWrite[table].table, getTablePropName(table), valObj.props);
      }
    }
  }

  // Результат проверки
  if (!hut.isObjIdle(errdata))
    throw { error: 'Validation', message: appconfig.getMessage('FailUpdate'), data: errdata };

  function getTablePropName(table) {
    const tItem = Array.isArray(metaUpForm.tables) ? metaUpForm.tables.find(item => item.table == table) : '';
    if (!tItem || !tItem.prop) {
      throw { error: 'SOFTERR', message: 'Not found table ' + table + ' in metaUpForm!' };
    }
    return tItem.prop;
  }

  function preValidateTable(table, data, tablePropName, valObj) {
    if (!data) return;

    for (const mainprop in data) {
      if (data[mainprop] && typeof data[mainprop] == 'object') {
        for (const prop of Object.keys(data[mainprop])) {
          let errTxt;
          // if (data[mainprop] && typeof data[mainprop][prop] == 'object') errTxt = 'Выберите значение из списка!';
          if (data[mainprop] && typeof data[mainprop][prop] == 'object') {
            if (valObj && valObj[prop]) {
              errTxt = appconfig.getMessage(mustMess.selectFromList);
              if (errTxt) addErrTabdata(tablePropName, mainprop, prop, errTxt);
            } else {
              // Если поля нет в списке полей (опциональное), то просто сбросить его
              data[mainprop][prop] = '';
            }
          }
        }
      }
    }
  }

  async function validateTable(table, data, tablePropName, valObj) {
    if (!data) return;

    for (const mainprop in data) {
      if (data[mainprop] && typeof data[mainprop] == 'object') {
        //  Проверка таблицы по правилам валидации

        for (const prop of Object.keys(data[mainprop])) {
          if (valObj && valObj[prop]) {
            const errTxt = await checkProp({ rule: valObj[prop], prop, doc: data[mainprop], table});
            if (errTxt) addErrTabdata(tablePropName, mainprop, prop, errTxt);
          }
        }
      }
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
  console.log('VALIDATOR checkProp '+prop+' RULE='+util.inspect(rule));
  const value = doc[prop];
  if (rule.custom) {
    const result = await datamaker.customValidate({ rule, prop, doc, _id, table });
    return result ? appconfig.getMessage(result) : '';
  }

  if ((rule.notempty || rule.unique) && !isNotEmpty(value)) return appconfig.getMessage(mustMess.notempty);

  if (rule.validid && !hut.isIdValid(value)) return appconfig.getMessage(mustMess.validid);

  if (rule.unique) {
    const isUnique = await isValueUnique(prop, doc, _id, table);
    if (!isUnique) return appconfig.getMessage(mustMess.unique);
  }
}

function isNotEmpty(value) {
  return value && (value != "-");
}

async function isValueUnique(prop, doc, _id, table) {
  const desc = descriptor.getTableDesc(table);
  const data = await dm.dbstore.get(desc.collection, { [prop]: doc[prop] }, { fields: { [prop]: 1 } });

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
