/**
 * logutil.js
 * Функции формирования запросов для чтения логов
 * - из таблицы sql
 * - из таблицы nosql (nedb) - alerts
 */

const util = require('util');

/**
 * 
 * @param {*} table 
 * @param {*} filter 
 * @param {*} opt 
 */
function fromReadSql(table, filter = {}, opt = {}) {
  if (!table) return '';

  let sql = 'SELECT * FROM ' + table;
  const where = formWhere(filter);
  if (where) sql += ' WHERE ' + where;
  const order = formOrder(opt);
  if (order) sql += ' ORDER BY ' + order;
  const limit = formLimit(opt);
  if (limit) sql += ' LIMIT ' + limit;
  return sql;
}

function formWhere(filter) {
  let result = '';
  let first = true;

  // filter = {did:'DD1', ts:{$lt:xxxxxxxxxx}}
  // filter = {did:{$in:{['DD1','DD2']}}, ts:{$lte:xxxxxxxxx}}
  Object.keys(filter).forEach(prop => {
    if (typeof filter[prop] == 'object') {
      const objItem = getObjItem(prop, filter[prop]);
      if (objItem) result += isFirst(' AND ') + getObjItem(prop, filter[prop]);
    } else {
      result += isFirst(' AND ') + getOneItem(prop, '=', filter[prop]);
    }
  });
  return result;

  function isFirst(op) {
    return first ? ((first = false), '') : op;
  }

  function getObjItem(prop, valObj) {
    const compOper = Object.keys(valObj)[0];
    const compVal = valObj[compOper];

    switch (
      compOper // $lt, $lte, $gt, $gte, $in, $nin??
    ) {
      case '$lt':
        return getOneItem(prop, '<', compVal);
      case '$lte':
        return getOneItem(prop, '<=', compVal);
      case '$gt':
        return getOneItem(prop, '>', compVal);
      case '$gte':
        return getOneItem(prop, '>=', compVal);
      case '$in':
        return getInItems(prop, compVal);
      default:
        console.log('ERROR: Logconnector: Unknown filter exp for prop:' + util.inspect(valObj) + '. Skipped..');
        return '';
    }
  }

  function getOneItem(prop, op, val) {
    const valStr = typeof val == 'number' ? val : "'" + val + "'";
    return prop + op + valStr;
  }

  function getInItems(prop, compVal) {
    if (!Array.isArray(compVal)) {
      console.log(
        'ERROR: Logconnector: Expected array in filter exp for prop:' + util.inspect(compVal) + '. Skipped..'
      );
      return;
    }

    let res = '';
    compVal.forEach(el => {
      if (res) res += ' OR ';
      res += '(' + getOneItem(prop, '=', el) + ')';
    });
    return res;
  }
}

// {sort:{tsid:-1}, limit:100 }
function formOrder(opt) {
  if (!opt.sort || typeof opt.sort != 'object') return '';

  const prop = Object.keys(opt.sort)[0];
  const dir = opt.sort[prop] == -1 ? ' DESC' : '';
  return prop + dir;
}

function formLimit(opt) {
  return opt.limit && typeof opt.limit == 'number' ? opt.limit : 42;
}

/**
 *
 * @param {String} table
 * @param {Object} filter:  {ts:164526767765, where:[{name:'did',val:'LAMP1'}]}
 *
 * @return {String} - sql
 */
function formDeleteSql(table, filter) {
  try {
    if (!table) throw { message: 'Unexpected empty table!' };
    if (!filter || typeof filter != 'object') throw { message: 'Unexpected empty filter!' };
    if (!filter.where || !Array.isArray(filter.where)) throw { message: 'Expected "where" object in filter!' };
    // if (!filter.ts) throw { message: 'Expected "ts" in filter!' };

    const values = filter.where.map(item => `${item.name}='${item.val}'`).join(' OR ');
    let str = `DELETE FROM ${table} WHERE (${values})`;
    if (filter.ts)  str = `${str} AND ts<${filter.ts}`;
    return str;
    // return `DELETE FROM ${table} WHERE (${values}) AND ts<${filter.ts}`;
  } catch (e) {
    console.log('ERROR: Logconnector.delete' + e.message);
  }
}


function formLogWhere(doc, tsid) {
  let str = '';
  let first = true;

  if (doc.levelfrom > 0) str += isFirst(' AND ') + getOneItem('level', '>=', Number(doc.levelfrom));
  if (doc.location) str += isFirst(' AND ') + getOneItem('location', ' LIKE ', doc.location + '%');
  // tags -  это массив!!
  if (doc.tags && doc.tags.length) str += isFirst(' AND ') + getTagsItem(doc.tags);
  if (tsid) str += isFirst(' AND ') + getOneItem('tsid', '<', tsid);
  return str ? ' WHERE ' + str : '';

  function isFirst(op) {
    return first ? ((first = false), '') : op;
  }

  function getOneItem(prop, op, val) {
    const valStr = typeof val == 'number' ? val : "'" + val + "'";
    return prop + op + valStr;
  }

  function getTagsItem(tagArr) {
    // В БД tags = #Климат#Безопасность# - сохраняется как строка
    let res = '';
    tagArr.forEach(tag => {
      if (res) res += ' OR ';
      // res += "tags LIKE '%#" + tag + "#%'";
      res += "tags LIKE '%" + tag + "%'";
    });
    return ' (' + res + ') ';
  }
}


function formLogWhereFunction(doc) {
  let fiArr = [];
  if (doc.levelfrom > 0) fiArr.push('(this.level >= '+doc.levelfrom+')');
  if (doc.location) {
    fiArr.push('(this.location.startsWith("'+doc.location+'")');
  }
  if (doc.tags && doc.tags.length) {
    doc.tags.forEach(tag => {
      fiArr.push('(this.tags.indexOf("#'+tag+'#")>=0)');
    })
  }
  const str = fiArr.length ? fiArr.join(' && ') : 'true';
  // console.log('formLogWhereFunction str='+str)
  return new Function('', 'return '+str);
}


module.exports = {
  fromReadSql,
  formDeleteSql,
  formLogWhere,
  formLogWhereFunction
}