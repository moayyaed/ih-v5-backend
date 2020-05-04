/*
 * Copyright (c) 2019 Intra LLC
 * MIT LICENSE
 *
 * IntraHouse plugin devices object
 *
 * Создает подмножество виртуальных устройств с автоматическим обновлением и оберткой для реализации сценариев
 *
 */

const util = require('util');

const Wdevo = require('./wdevo');

module.exports = Devices;

/**
 * Devices constructor
 *
 * @param {Object} params - optional
 */
function Devices(agent) {
  if (!(this instanceof Devices)) return new Devices(agent);

  if (agent && typeof agent == 'object') {
    this.agent = agent;
  } else {
    this.agent = require('./agent')();
  }

  this.store = {}; // Подмножество вирт устройств
  this.handlers = {}; // Обработчики событий onChange
}

// loglevel=0 - Low (только старт-стоп и ошибки), 1 - middle, 2 - hight (все сообщ)
Devices.prototype.log = function(txt, level) {
  this.agent.log(txt, level);
};

Devices.prototype.exit = function(errcode = 0, txt = '') {
  if (txt) this.log(txt);

  setTimeout(() => {
    // Это событие можно перехватить в process.on('exit')
    process.exit(errcode);
  }, 300);
};

/**
 * getDevice - добавить устройства с сервера в store
 * - получить список, сохранить устройства в store в виде объекта с оберткой для сценариев
 *
 * - подписаться на изменения
 * - возвращает промис. result = количество устройств
 *
 */
Devices.prototype.getDevice = function(filter, handler) {
  const that = this;
  const handleAll = (handler && typeof handler == 'function') ? handler : '';

  return new Promise((resolve, reject) => {
    that.agent
      .sendRequest('get', { name: 'devicesV4', filter })
      .then(result => {
        if (!result || !result.length) {
          resolve(0);
        } else {
          let devlist = [];
          // Если устройство уже было - оно создается заново
          result.forEach(item => {
            that.store[item.dn] = new Wdevo(item, that.agent);
            // that.store[item.dn] = item;

            devlist.push(item.dn);
          });

        
          // Подписаться на изменения. Подписку сделать по списку устройств (Set? на все сразу? Старую подписку удалить?
          that.agent.subscribe('devicesV4', { dn: devlist.join(',') }, data => {
            // Пришел объект изменений - внести изменения в store
            // that.agent.log('ON sub devicesV4: ' + util.inspect(data));
            
            // Если есть общий обработчик - запустить
            // if (this.handlers._devicesV4) this.handlers._devicesV4(data);
            if (handleAll) handleAll(data);

            data.forEach(item => {
              if (that.store[item.dn]) {
                // Если есть отдельный handler обработки устройства - нужно его запустить до изменения значения??
                if (this.handlers[item.dn]) {
                  this.handlers[item.dn](item);
                }

                if (!that.store[item.dn].prev) that.store[item.dn].prev = {};
                // Каждое свойство отдельно!!
                Object.keys(item).forEach(prop => {
                  if (prop != 'dn') {
                    that.store[item.dn].prev[prop] = that.store[item.dn][prop];
                    that.store[item.dn][prop] = item[prop];
                  }
                });
              }
            });
          });
          resolve(result.length);
        }
      })
      .catch(e => reject(e));
  });
};

/**
 * Регистрировать обработчик для устройства или для всех устройств?
 * Для одного устройства или списка устройств
 */
Devices.prototype.addListener = function(dn, handler) {
  if (dn) {
    this.handlers[dn] = handler;
  }
};

/**
 * Групповая команда от плагина
 *  Отправить на сервер запрос type:'command', command:'doAll', filter:{}, act:'', value:''
 */
Devices.prototype.doAll = function(filter, act, value) {
  return this.agent.sendRequest('command', { command: { filter, act, value }});
};