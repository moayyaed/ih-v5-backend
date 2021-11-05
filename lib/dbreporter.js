/**
 * dbreporter.js
 */

const util = require('util');
const shortid = require('shortid');

const callbackMap = {};

module.exports = {
  start(dbagent, unitId, holder) {
    this.dbagent = dbagent;
    this.holder = holder;

    this.holder.on('finish', () => {
      this.stop();
    });

    dbagent.on('message', message => {
      const handler = callbackMap[message.id];
      if (handler) {
        handler( message.error || null, message.payload);
        delete callbackMap[message.id];
      } else {
        ;
        // console.log('INFO: dbconnector. Message  from ' + unitId + ': ' + util.inspect(message));
        if (message.type == 'settings') {
          this.sendSettings(message);
        } else if (message.type == 'procinfo') {
          const did = '__UNIT_reportmaker';
          const readObj = {[did]:message.data};
          this.holder.emit('received:device:data', readObj);
        } else {
          this.parseOther(message);
        }
      }
    });
  },

  stop() {
    this.dbagent = '';
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
            this.log('INFO: Dbreporter. Read more then 1000: records ' + data.length + ' Query:'+util.inspect(query));
          }
          resolve(data);
        } else reject(err);
      });
    });
  },

 
  sendRequest(id, type, req, callback) {
    if (!this.dbagent || !this.dbagent.connected) return;

    if (id && callback) callbackMap[id] = callback;
    const sendObj = { ...req, id, type };
    this.dbagent.send(sendObj);
    
  },

  async parseOther(message) {
    if (message.error) {
      this.log('ERROR: dbagent: ' + message.error);
    } else if (message.log) {
      this.log('INFO: dbagent: ' + message.log);
    }
  },

  log(txt, level) {
    console.log(txt);
  }
};

function getUid() {
  return shortid.generate();
}
