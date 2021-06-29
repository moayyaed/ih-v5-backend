/*
 * Plugin barebone
 */

const util = require('util');

const apiobj = require('./api/apiobj');

module.exports = Plugin;

/**
 * Plugin constructor
 *
 * @param {Object} params - optional
 */
function Plugin(agent) {
  if (!(this instanceof Plugin)) return new Plugin(agent);

  this.agent = require('./agent')();
  this.logger = require('./logger');
  this.opt = getOptFromArgs();
  this.logger.start(this.opt.logfile);

  // Добавляем api прикладного уровня
  this.params = apiobj('params', this);
  this.channels = apiobj('channels', this);
  this.extra = apiobj('extra', this);
  this.devhardlinks = apiobj('devhardlinks', this);
  this.devref = apiobj('devref', this);

  this.users = apiobj('users', this);
  this.places = apiobj('places', this);
  this.rooms = apiobj('rooms', this);

  this.sendProcessInfo();
  setInterval(this.sendProcessInfo.bind(this), 10000);
}
util.inherits(Plugin, require('events').EventEmitter);

// loglevel=0 - Low (только старт-стоп и ошибки), 1 - middle, 2 - hight (все сообщ)
Plugin.prototype.log = function(txt, level=0) {
  // console.log('PLUGIN.log '+txt+' this.params='+util.inspect(this.params));
  this.logger.log(txt, level, this.params ? this.params.loglevel || 0 : 0); // Запись в лог файл
  this.agent.log(txt, level); // Передать сообщение для debug
};

Plugin.prototype.send = function(sendObj) {
  this.agent.send(sendObj);
  this.log('Send: ' + util.inspect(sendObj), 2);
};

// Отправляет данные каналов, ответа не ждет
Plugin.prototype.sendData = function(data) {
  this.agent.send({ type: 'data', data });
  this.log('SendData ' + util.inspect(data), 2);
};

// Отправляет исторические данные каналов, ответа не ждет
Plugin.prototype.sendHistdata = function(data) {
  this.agent.send({ type: 'histdata', data });
  this.log('Send  histdata ' + util.inspect(data), 2);
};

Plugin.prototype.sendResponse = function(message, response) {
  this.agent.sendResponse(message, response);
};

Plugin.prototype.exit = function(errcode = 0, txt = '') {
  this.log('Exit with  code:' + errcode+'. '+txt);
  if (txt) this.agent.send({ type: 'exit', error:txt });
  this.agent.exit(errcode, txt);
};

/**
 * API базового уровня. Используется API на прикладном уровне
 *  get
 *  set
 *  onChange
 *  onAdd
 *  onDelete
 *  onUpdate
 */

Plugin.prototype.onAct = function(cb) {
  this.agent.handlers.onAct = cb;
};

Plugin.prototype.onCommand = function(cb) {
  this.agent.handlers.onCommand = cb;
};

Plugin.prototype.onScan = function(cb) {
  this.agent.handlers.onScan = cb;
};

Plugin.prototype.get = function(name, filter) {
  return this.agent.sendRequest('get', { name, filter });
};

Plugin.prototype.set = function(name, data) {
  return this.agent.sendRequest('set', { name, data });
};

Plugin.prototype.onChange = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, filter }, cb);
};

Plugin.prototype.onAdd = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, op: 'add', filter }, cb);
};

Plugin.prototype.onDelete = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, op: 'delete', filter }, cb);
};

Plugin.prototype.onUpdate = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, op: 'update', filter }, cb);
};

/**
 * Команда управления устройствами от плагина
 *  Отправить на сервер запрос type:'command', command:{dn:'LAMP1', act:'on'}}
 *  или групповую команду: type:'command', command:{filter:{....}, act:'', value:''}
 */
Plugin.prototype.do = function(dn, act, value, sender) {
  if (typeof dn == 'string') {
    this.agent.send({ type: 'command', command: { dn, act, value, sender } });
  } else if (typeof dn == 'object') {
    this.agent.send({ type: 'command', command: { filter: dn, act, value, sender } });
  } else {
    this.log('Invalid do parameter!');
  }
};

Plugin.prototype.startscene = function(id, arg, sender) {
  this.agent.send({ type: 'startscene', id, arg, sender });
};

Plugin.prototype.sendProcessInfo = function() {
  const mu = process.memoryUsage();
  const memrss = Math.floor(mu.rss / 1024);
  const memheap = Math.floor(mu.heapTotal / 1024);
  const memhuse = Math.floor(mu.heapUsed / 1024);
  this.agent.send({ type: 'procinfo', data: { memrss, memheap, memhuse } });
};

function getOptFromArgs() {
  let opt;
  try {
    opt = JSON.parse(process.argv[2]); //
  } catch (e) {
    opt = {};
  }
  return opt;
}
