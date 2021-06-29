/**
 * Agent для связи сервера и плагинов (дочерних модулей)
 *
 * @param {Object} params - optional
 */

const util = require('util');

const baseconnector = require('./baseconnector');

const MAX_TRANSACTIONS = 2048;

module.exports = Agent;

function Agent(params, connector) {
  if (!connector) connector = baseconnector;
  if (!(this instanceof Agent)) return new Agent(params, connector);

  this.subs = {};
  this.handlers = {};

  this.loglevel = 1;
  this.debug = 0;
 
  this.lastId = 0;

  this.connector = connector(params);

  // 
  const that = this;

  this.connector.on('debug', message => {

    that.setDebug(message.mode);
    that.sendResponse(message, 1);
  });

  this.connector.on('command', message => {
    // that.emit(message.type, message);
    // console.log('GET command '+util.inspect(message));
    if (that.handlers.onCommand) that.handlers.onCommand(message);
  });

  this.connector.on('act', message => {
    // that.emit(message.type, message);
    // console.log('GET ACT  '+util.inspect(message));
    if (that.handlers.onAct) that.handlers.onAct(message);
  });

  // this.connector.on('act', message => {  
  //  that.emit(message.type, message);
  // });

  this.connector.on('sub', message => {
    that.processSubResponse(message);
  });

  this.connector.on('scan', message => {
    console.log('P AGENT SCAN '+util.inspect(message));
    if (that.handlers.onScan) {
      that.handlers.onScan(message);
    } 
  });
 
  // Обработка ошибок связи
  this.connector.on('error', message => {
    that.exit(1, message);
  });
}

// util.inherits(Agent, require('events').EventEmitter);

Agent.prototype.send = function(message) {
  this.connector.send(message);
};

Agent.prototype.setDebug = function(mode) {
  this.debug = mode == 'on' ? 1 : 0;
  console.log('agent setDebug '+mode+' ='+this.debug)
};

// Если debug - передавать все сообщения. Для фильтрации исп фильтр отладчика
// Логирование идет отдельно
Agent.prototype.log = function(txt, level) {
// Agent.prototype.log = function(txt) {
  /*
  if (this.debug) {
    this.connector.send({ type:'debug', txt });
  }
  */
  
  if (!txt || this.loglevel < level) return;
  const type = this.debug ? 'debug' : 'log';
  this.connector.send({ type, txt });
  
};

Agent.prototype.sendRequest = function(type, data) {

  const id = getNextId(this.lastId);
  this.lastId = id;
  const connector = this.connector;
  const sobj = util.isArray(data) ? { id, type, data } : Object.assign({ id, type }, data);

  connector.send(sobj);

  return new Promise((resolve, reject) => {
    connector.on(type, message => {
      if (message.id == id) {
        if (message.response) {
          resolve(message.data);
        } else {
          reject(message.error);
        }
      }
    });
  });
};

Agent.prototype.subscribe = function(event, filter, cb) {
  this.lastId = getNextId(this.lastId);
  const id = this.lastId;
  this.connector.send({ id, type: 'sub', event, filter });
  if (cb) this.subs[id] = { cb };
};

Agent.prototype.sendResponse = function(message, response) {
  this.connector.send(Object.assign({ response }, message));
};

Agent.prototype.processSubResponse = function(message) {
  const id = message.id;
  try {
    if (!id) throw 'Expected id!';

    if (!this.subs[id]) throw 'Not found subs!';
    if (!message.data) return;
    this.subs[id].cb(message.data);
  } catch (e) {
    this.log(e.message + ' ' + util.inspect(message));
  }
};

Agent.prototype.exit = function(errcode = 0, txt = '') {
  if (txt) this.log(txt);

  setTimeout(() => {
    // Это событие можно перехватить в process.on('exit')
    process.exit(errcode);
  }, 300);
};

Agent.prototype.get = function(name, filter) {
  return this.sendRequest('get', { name, filter });
};

Agent.prototype.doCommand = function(dobj, command, value) {
  this.connector.send({type:'command', command:{dn:dobj.dn, act:command, value}});
};

function getNextId(id) {
  return (id + 1) % MAX_TRANSACTIONS;
}
