/*
 * Copyright (c) 2019 Intra LLC
 * MIT LICENSE
 *
 * IntraHouse core barebone
 */

const util = require('util');

const apiobj = require('./api/apiobj');

module.exports = Core;

/**
 * Core constructor
 *
 * @param {Object} params - optional
 */
function Core(agent) {
  if (!(this instanceof Core)) return new Core(agent);
  
  if (agent && typeof agent == 'object') {
    this.agent = agent;
  } else {
    this.agent =  require('./agent')();
  }

  // Добавляем api прикладного уровня
  this.users = apiobj('users', this);
  this.places = apiobj('places', this);
  this.rooms = apiobj('rooms', this);

  this.agent.on('command', message => {
    // Отрабатывает прикладная часть - нужно регистрировать обработчик
  });

  this.agent.on('act', message => {
    // Отрабатывает прикладная часть - нужно регистрировать обработчик
  });

  this.agent.on('service', message => {
    // Отрабатывает прикладная часть - нужно регистрировать обработчик
  });
}
util.inherits(Core, require('events').EventEmitter);

// loglevel=0 - Low (только старт-стоп и ошибки), 1 - middle, 2 - hight (все сообщ)
Core.prototype.log = function(txt, level) {
  this.agent.log(txt, level);
};


Core.prototype.exit = function(errcode = 0, txt = '') {
  if (txt) this.log(txt);

  setTimeout(() => {
    // Это событие можно перехватить в process.on('exit')
    process.exit(errcode);
  }, 300);
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
Core.prototype.get = function(name, filter) {
  return this.agent.sendRequest('get', { name, filter });
};

Core.prototype.set = function(name, data) {
  return this.agent.sendRequest('set', { name, data });
};

Core.prototype.onChange = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, filter }, cb);
};

Core.prototype.onAdd = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, op: 'add', filter }, cb);
};

Core.prototype.onDelete = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, op: 'delete', filter }, cb);
};

Core.prototype.onUpdate = function(name, filter, cb) {
  if (typeof filter == 'function') {
    cb = filter;
    filter = '';
  }
  this.agent.subscribe('tableupdated', { tablename: name, op: 'update', filter }, cb);
};

