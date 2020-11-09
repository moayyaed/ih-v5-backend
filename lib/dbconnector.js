/**
 * dbconnector.js
 */

const util = require('util');
const dm = require('./datamanager');

const callbackMap = {};

module.exports = {
  init(dbagent) {
    this.dbagent = dbagent;

    dbagent.on('message', message => {
      // console.log('PARENT ON message ' + util.inspect(message));

      const handler = callbackMap[message.id];
      if (handler) {
        handler(null, message.payload);
        delete callbackMap[message.id];
      } else {
        this.parseOther(message);
      }
    });
  },

  // Отправляет запрос на статистику
  getStats() {
    const ts = Date.now();

    this.sendRequest('s' + ts, 'stats', {}, (err, result) => {
      const str = err ? util.inspect(err) : result;
      console.log('STATS: ' + str);
    });
  },

  read(query) {
    const ts = Date.now();

    return new Promise((resolve, reject) => {
      if (!this.dbagent) {
        return reject({message:'No dbagent!'});
      } 

      this.sendRequest('r' + ts, 'read', { query }, (err, data) => {
        // const str = err ? util.inspect(err) : 'Records ' + (result ? result.length : ' NO');
        if (!err) {
          log('INFO: read query: '+ util.inspect(query) + 'Records ' + (data ? data.length : ' NO'));
          resolve(data);
        } else reject(err);
      });
    });
  },

  write(payload) {
    if (!this.dbagent) {
      console.log('WARN: No dbagent, DB write is skipped, payload: '+util.inspect(payload))
    }
    // [{dn, prop, ts, val}]
    // Пишем без ответа, обработчики не накапливаем
    const ts = Date.now();
    this.sendRequest('w' + ts, 'write', { payload });
  },

  sendRequest(id, type, req, callback) {
    if (id && callback) callbackMap[id] = callback;
    const sendObj = { id, type };
    if (type == 'read') sendObj.query = req.query;
    if (type == 'write') sendObj.payload = req.payload;

    if (this.dbagent && this.dbagent.connected) this.dbagent.send(sendObj);
  },

  parseOther(message) {
    if (message.error) {
      log('ERROR: dbagent: ' + message.error);
    } else if (message.log) {
      log('INFO: dbagent: ' + message.log);
    }
  }
};

function log(txt, level) {
  console.log(txt);
  dm.insertToLog('pluginlog', { unit: 'db', txt, level });
}
