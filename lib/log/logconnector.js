/**
 * logconnector.js
 *  Объект для связи с БД, хранящей логи
 *  - получает dbagent - канал к отдельному процессу, где запущен агент для работы с БД
 *
 *
 */

const util = require('util');
const shortid = require('shortid');

const sqlutil = require('../utils/sqlutil');

// Должно соответствовать набору столбцов в logagent - sqlite !!??
// Здесь НЕТ ts: '', tsid: '' - они не могут быть пустыми
const logFields = {
  devicelog: { did: '', prop: '', val: '', txt: '', cmd: '',  sender: '' },

  pluginlog: { unit: '', txt: '', level: '', sender: '' },
  authlog: { tags: '', location: '', txt: '', level: '',  sender: '' },
  mainlog: { tags: '', location: '', txt: '', level: '',  sender: '' }
};

const callbackMap = {};

module.exports = {
  start(dbagent, holder) {
    this.recMap = new Map();
    this.last = {}; //
    this.wait = true;
    this.waitDocs = {};

    holder.on('finish', () => {
      this.stop();
    });

    if (dbagent) {
      this.dbagent = dbagent;

      dbagent.on('message', message => {
       
        const handler = callbackMap[message.id];
        if (handler) {
          handler(message.error || null, message.payload);

          delete callbackMap[message.id];
        } else {
          // console.log('INFO: logconnector. Message : ' + util.inspect(message));
          if (message.type == 'settings') {
            this.sendSettings(message);
          } else  if (message.type == 'procinfo') {
            const did = '__UNIT_logagent';
            const readObj = {[did]:message.data};
            holder.emit('received:device:data', readObj);
          } else {
            this.parseOther(message);
          }
        }

         // Если получено хоть одно сообщение
         if (this.wait) {
          // Отправить накопленные записи
          if (this.waitDocs) {
            Object.keys(this.waitDocs).forEach(table => {
              this.write(table, this.waitDocs[table]);
            })
          }

          this.wait = false;
          this.waitDocs = '';
        }
      });

      dbagent.on('close', code => {
        console.log('ERROR: Logagent stopped, code=' + code);
        this.dbagent = '';
      });
    }
  },

  setRetentions(rp) {
    this.rp = rp;
  },

  isActive() {
    return this.dbagent && this.dbagent.connected && !this.wait;
  },

  async addLog(table, mesObj) {
    const docs = await this.form(table, Array.isArray(mesObj) ? mesObj : [mesObj]);
    if (!this.isActive()) {
      if (!this.waitDocs) this.waitDocs = {};
      if (!this.waitDocs[table])  this.waitDocs[table] = [];
      this.waitDocs[table].push(...docs);
      return;
    }
  
    this.write(table, docs);
  },

  async deleteLog(table, filter) {
    if (!this.isActive()) return;
    this.delete(table, filter);
  },

  // getLog('mainlog', {tsid:{ $lt: startTsid }, ...}, { limit:1000, sort: { tsid: -1 } })
  async getLog(table, filter = {}, opt = {}) {
    if (!this.isActive()) return [];

    const sql = sqlutil.fromReadSql(table, filter, opt);

    if (!sql) {
      console.log(
        'ERROR: getLog. Failed build sql for ' + table + ' filter=' + util.inspect(filter) + ' opt=' + util.inspect(opt)
      );
    }
    return sql ? this.read(sql) : [];
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
  async read(sql) {
    let result = [];
    try {
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
            this.log('INFO: Dbconnector. Read more then 1000: records ' + data.length + ' Query: '+sql);
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
    const sql = sqlutil.formDeleteSql(table, filter);
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
    // const rp = await this.holder.dm.datagetter.getLogRetentionDays({}, this.holder); // Сроки по level
    // console.log('INFO: sendSettings '+util.inspect(rp))

    if (this.dbagent) this.dbagent.send({ id: message.id, type: 'settings', payload: { rp: this.rp } });
  },

  log(txt) {
    console.log(txt);
  },

  /** form
   *  формирует записи для логов -
   *  добавляет уникальные идентификаторы ts (tsid)
   *
   * Проблема - с одним ts м б несколько записей, но нужно использовать ts для сортировки и пагинации
   * При записи в лог tsid - хранит ts записи (время в журнале)+ порядковый номер внутри ts
   *    tsid = '166674000000_00000'
   *
   */
  async form(logname, recs) {
    if (!recs || !recs.length) return;

    const now = Date.now();
    const docs = []; // массив документов для записи в БД
    // группировать по ts
    try {
      this.recMap.clear();
      recs.forEach(rec => {
        // let { ts, ...xdoc } = rec;
        if (!rec.ts) rec.ts = now;
        const ts = rec.ts;

        if (!this.recMap.has(ts)) {
          this.recMap.set(ts, [rec]);
        } else this.recMap.get(ts).push(rec);
      });

      let lastts = 0;
      let ats = 0;
      if (this.last[logname]) {
        lastts = this.last[logname].ts;
        ats = this.last[logname].ats;
      } else {
        this.last[logname] = { ts: 0, ats: 0 };
      }
      let max_ts;
      let max_ats;

      this.recMap.forEach((xdocs, xts) => {
        let a;
        if (xts > lastts) {
          // смело пишем новые записи с инкрементом ats с нуля
          a = 0;
        } else if (xts == lastts) {
          // берем ats из last
          // console.log('xts == lastts='+lastts)
          a = ats;
        } else {
          // Самый плохой случай - xts < lastts - запись в прошлое
          // TODO нужно считать данные за xts и найти последнее зн-е ats
          // console.log('TODO !!xts='+xts+' < lastts='+lastts)
          a = ats;
        }

        xdocs.forEach(xdoc => {
          a++;
          docs.push({ tsid: String(xts) + '_' + String(a).padStart(5, '0'), ...logFields[logname], ...xdoc });
        });
        if (xts >= lastts) {
          max_ts = xts;
          max_ats = a;
        }
      });

      // Заменить last
      if (max_ts) {
        this.last[logname].ts = max_ts;
        this.last[logname].ats = max_ats;
      }
    } catch (e) {
      console.log('ERROR: logformer. Insert ' + recs.length + ' records: ' + util.inspect(e));
    }
    // console.log('EXEC docs:'+util.inspect(docs))
    // console.log('logconnector docs='+util.inspect(docs))
    return docs;
  }
};

function getUid() {
  return shortid.generate();
}
