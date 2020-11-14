/**
 * dbconnector.js
 */

const util = require('util');
const shortid = require('shortid');

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
            log('INFO: read Records ' + data.length + util.inspect(query));
          }
          resolve(data);
        } else reject(err);
      });
    });
  },

  write(payload) {
    if (!this.dbagent) {
      console.log('WARN: No dbagent, DB write is skipped, payload: ' + util.inspect(payload));
    }
    // [{dn, prop, ts, val}]
    // Пишем без ответа, обработчики не накапливаем
    this.sendRequest(getUid(), 'write', { payload });
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

function getUid() {
  return shortid.generate();
}
function log(txt, level) {
  // console.log(txt);
  dm.insertToLog('pluginlog', { unit: 'db', txt, level });
}
