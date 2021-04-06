/**
 * logconnector.js
 *  Объект для связи с БД, хранящей логи
 *  - получает dbagent - канал к отдельному процессу, где запущен агент для работы с БД
 *
 *
 */

const util = require('util');
const shortid = require('shortid');

const callbackMap = {};

module.exports = {
  start(dbagent, holder) {
    this.holder = holder;
    if (dbagent) {
      this.dbagent = dbagent;

      dbagent.on('message', message => {
        const handler = callbackMap[message.id];
        if (handler) {
          handler(null, message.payload);
          delete callbackMap[message.id];
        } else {
          console.log('INFO: logconnector. Message : ' + util.inspect(message));
          if (message.type == 'settings') {
            this.sendSettings(message);
          } else {
            this.parseOther(message);
          }
        }
      });

      dbagent.on('close', code => {
        console.log('ERROR: Logagent stopped, code=' + code);
        this.dbagent = '';
      });
    }
  },

  isActive() {
    return this.dbagent && this.dbagent.connected;
  },

  stop() {
    this.dbagent = '';
  },

  // Отправляет запрос на статистику
  getStats() {
    this.sendRequest(getUid(), 'stats', {}, (err, result) => {
      const str = err ? util.inspect(err) : result;
      console.log('STATS: ' + str);
    });
  },

  // Сформировать запрос и отправить
  async read(table, filter, opt) {
    let result = [];
    try {
      if (!this.dbagent) throw { message: 'Missing logagent!' };
      const sql = fromReadSql(table, filter, opt);
      if (!sql) throw { message: 'Failed to build query for table ' + table + ', filter:' + util.inspect(filter) };

      result = await this.sendReadRequest(sql);
      // console.log('INFO: Logvonnector SQL '+sql+' LEN='+result.length);
    } catch (e) {
      console.log('ERROR: Logconnector: Read error. ' + util.inspect(e));
    }
    return result;
  },

  sendReadRequest(sql) {
    return new Promise((resolve, reject) => {
      this.sendRequest(getUid(), 'read', { query: { sql } }, (err, data) => {
        if (!err) {
          if (data && data.length && data.length > 1000) {
            this.log('INFO: read Records ' + data.length);
          }
          resolve(data);
        } else reject(err);
      });
    });
  },

  write(table, docs) {
    // Пишем без ответа, обработчики не накапливаем
    this.sendRequest(getUid(), 'write', { query: { table }, payload: docs });
  },

  delete(table, filter) {
    const sql = formDeleteSql(table, filter);
    if (sql) this.sendRequest(getUid(), 'run', { query: { sql } });
  },

  sendRequest(id, type, req, callback) {
    if (!this.dbagent || !this.dbagent.connected) return;

    if (id && callback) callbackMap[id] = callback;
    const sendObj = { id, type };
    if (req.query) sendObj.query = req.query;
    if (req.payload) sendObj.payload = req.payload;

    // console.log('BEFORE SENDREQ sendObj='+util.inspect(sendObj));
    this.dbagent.send(sendObj);
    // if (this.dbagent && this.dbagent.connected) this.dbagent.send(sendObj);
  },

  async parseOther(message) {
    if (message.error) {
      this.log('ERROR: dbagent: ' + message.error);
    } else if (message.log) {
      this.log('INFO: dbagent: ' + message.log);
    }
  },

  async sendSettings(message) {
    const rp = await this.holder.dm.datagetter.getLogRetention({}, this.holder); // Сроки по level
    // console.log('INFO: sendSettings '+util.inspect(rp))
    if (this.dbagent) this.dbagent.send({ id: message.id, type: 'settings', payload: { rp } });
  },

  log(txt) {
    console.log(txt);
  }
};

function getUid() {
  return shortid.generate();
}

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
    if (!table) throw {message:'Unexpected empty table!'}
    if (!filter || typeof filter != 'object') throw {message:'Unexpected empty filter!'}
    if (!filter.where || !Array.isArray(filter.where)) throw {message:'Expected "where" object in filter!'}
    if (!filter.ts) throw {message:'Expected "ts" in filter!'}
    
    const values = filter.where.map(item => `${item.name}='${item.val}'`).join(' OR ');
    return `DELETE FROM ${table} WHERE (${values}) AND ts<${filter.ts}`;
  } catch (e) {
    console.log('ERROR: Logconnector.delete'+ e.message);
  }
}
