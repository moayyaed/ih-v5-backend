/**
 * logconnector.js
 *  Объект для связи с БД, хранящей логи
 *  - получает dbagent - канал к отдельному процессу, где запущен агент для работы с БД
 *
 *
 */

const util = require('util');
const shortid = require('shortid');

const logformer = require('./logformer');

const callbackMap = {};

module.exports = {
  start(dbagent) {
    logformer.start();
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

  read(query) {
    return new Promise((resolve, reject) => {
      if (!this.dbagent) {
        return reject({ message: 'No dbagent!' });
      }

      this.sendRequest(getUid(), 'read', { query }, (err, data) => {
        // const str = err ? util.inspect(err) : 'Records ' + (result ? result.length : ' NO');
        if (!err) {
          if (data && data.length && data.length > 1000) {
            this.log('INFO: read Records ' + data.length + util.inspect(query));
          }
          resolve(data);
        } else reject(err);
      });
    });
  },

  write(table, docs) {
    // Формировать записи - добавить tsid прямо в docs
    logformer.exec(table, docs);
    // Пишем без ответа, обработчики не накапливаем
    this.sendRequest(getUid(), 'write', { payload:docs });
  },

  sendRequest(id, type, req, callback) {
    if (!this.dbagent || !this.dbagent.connected) return;

    if (id && callback) callbackMap[id] = callback;
    const sendObj = { id, type };
    if (type == 'read') sendObj.query = req.query;
    if (type == 'write') sendObj.payload = req.payload;
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
    if (this.dbagent) this.dbagent.send({ id: message.id, type: 'settings', payload: {} });
  },

  log(txt) {
    console.log('INFO: Logconnector: ' + txt);
  }
};

function getUid() {
  return shortid.generate();
}
