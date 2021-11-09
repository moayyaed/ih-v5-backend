/**
 * dbreporter.js
 * Компонент - коннектор для плагина reportmaker
 */

const util = require('util');
const shortid = require('shortid');

const appconfig = require('./appconfig');

const callbackMap = {};

module.exports = {
  /**
   *
   * @param {Object} cp - ChildProcess - дочерний процесс, который работает с БД
   *                           в данном случае это plugin reportmaker
   * @param {*} unitId
   * @param {*} holder
   */
  start(cp, unitId, holder) {
    this.cp = cp;
    this.holder = holder;
    this.params = this.getParamsFromDbgent(); // Параметры БД и агента, через который идет основное подключение

    /*
    this.holder.on('finish', () => {
      this.stop();
    });
    */

    if (cp) {
      cp.on('message', message => {
        const handler = callbackMap[message.id];
        if (handler) {
          handler(message.error || null, message.payload);
          delete callbackMap[message.id];
        } else {
          // console.log('INFO: dbREPORTER. Message  from ' + unitId + ': ' + util.inspect(message));
          if (message.type == 'settings') {
            this.sendSettings(message);
          } else if (message.type == 'procinfo') {
            const did = '__UNIT_reportmaker';
            const readObj = { [did]: message.data };
            this.holder.emit('received:device:data', readObj);
          } else if (message.type == 'get') {
            if (message.name == 'params') {
              cp.send({ id: message.id, type: 'get', data: this.params, response: 1 });
            } else {
              cp.send({ id: message.id, type: 'get', response: 0 });
            }
          } else {
            this.parseOther(message);
          }
        }
      });
    }
  },

  stop() {
    this.cp = '';
  },

  read(query) {
    return new Promise((resolve, reject) => {
      if (!this.cp) {
        return reject({ message: 'No child process (reportmaker)!' });
      }

      this.sendRequest(getUid(), 'read', { query }, (err, data) => {
        if (!err) {
          if (data && data.length && data.length > 1000) {
            this.log('INFO: Dbreporter. Read more then 1000: records ' + data.length + ' Query:' + util.inspect(query));
          }
          resolve(data);
        } else reject(err);
      });
    });
  },

  getReport(readObj) {
    console.log('GET REPORT readObj='+util.inspect(readObj))
    return new Promise((resolve, reject) => {
      if (!this.cp) {
        return reject({ message: 'No child process (reportmaker)!' });
      }

      this.sendRequest(getUid(), 'command', { ...readObj, command: 'report' }, (err, data) => {
        if (!err) {
          if (data && data.length && data.length > 1000) {
            this.log('INFO: Dbreporter. Read more then 1000: records ' + data.length + ' readObj:' + util.inspect(readObj));
          }
          resolve(data);
        } else reject(err);
      });
    });
  },

  sendRequest(id, type, req, callback) {

    if (!this.cp || !this.cp.connected) return;

    if (id && callback) callbackMap[id] = callback;
    const sendObj = { ...req, id, type };
    this.cp.send(sendObj);
  },

  async parseOther(message) {
    if (message.error) {
      this.log('ERROR: dbreporter: ' + message.error);
    } else if (message.log) {
      this.log('INFO: dbreporter: ' + message.log);
    }
  },

  getParamsFromDbgent() {
    // Найти unit - dbagent
    try {
      const dbagentUnit = getDbagentUnit(this.holder);
      if (!dbagentUnit) throw { message: 'Not found dbagent unit!' };

      const agentName = dbagentUnit.id;
      const agentPath = appconfig.getTheDbagentPath(agentName);

      // Получить его getArgs, сохранить как свои параметры
      const args = dbagentUnit.getArgs(); // Возвращает [JSON.stringify(options)]
      if (args && Array.isArray(args)) {
        const options = JSON.parse(args[0]);
        const {logfile, loglevel, ...mainopt} = options;
        return {...mainopt, agentName, agentPath};
      }

      throw { message: 'Expected dbagent.getArgs() result as array of strings!' };
    } catch (e) {
      console.log('ERROR: dbreporter.getParamsFromDbgent: ' + e.message);
      return {};
    }
  },

  log(txt, level) {
    console.log(txt);
  }
};

function getUid() {
  return shortid.generate();
}

function getDbagentUnit(holder) {
  for (const unit of Object.keys(holder.unitSet)) {
    if (holder.unitSet[unit] && holder.unitSet[unit].dbagent) return holder.unitSet[unit];
  }
}
