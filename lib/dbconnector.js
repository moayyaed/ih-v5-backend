/**
 * dbconnector.js
 */

const util = require('util');
const shortid = require('shortid');

const callbackMap = {};

module.exports = {
  start(dbagent, unitId, holder) {
    this.dbagent = dbagent;
    this.holder = holder;

    this.holder.dm.on('finish', () => {
      this.stop();
    });

    /*
    this.holder.dm.on('inserted:devicedb', docs => {
      // Отправлять, если ввели срок хранения
      let needToSend = 0;
      docs.forEach(doc => {
        if (doc.days) needToSend = 1;
      })
      if (needToSend)  this.sendSettings({id:getUid(), type:'settings' });
    });

    this.holder.dm.on('inserted:devicedb', docs => {
      // Отправлять, если изменился срок хранения
    });
    // При удалении записи не отправляем - не срочно
    */

    dbagent.on('message', message => {
      const handler = callbackMap[message.id];
      if (handler) {
        handler(null, message.payload);
        delete callbackMap[message.id];
      } else {
        console.log('INFO: dbconnector. Message  from ' + unitId + ': ' + util.inspect(message));
        if (message.type == 'settings') {
          this.sendSettings(message);
        } else {
          this.parseOther(message);
        }
      }
    });
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

  write(payload) {
    // Пишем без ответа, обработчики не накапливаем
    this.sendRequest(getUid(), 'write', { payload });
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
    const rp = await this.holder.dm.datagetter.getDbRetention({}, this.holder); // Для всех устройств
    if (this.dbagent) this.dbagent.send({ id: message.id, type: 'settings', payload: { rp } });
  },

  log(txt, level) {
    // console.log(txt);
    this.holder.dm.insertToLog('pluginlog', { unit: 'dbagent', txt, level });
  }
};

function getUid() {
  return shortid.generate();
}
