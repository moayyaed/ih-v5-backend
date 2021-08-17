/* eslint-disable object-shorthand */

/**
 * defaulthandlers.js
 */

const hut = require('../utils/hut');

module.exports = {
  format_def_B: function (device, prop, val) {
    return val == 1 ? 'ON' : 'OFF';
  },

  format_def_N: function (device, prop, val) {
    return isNaN(val) ? val : Number(val).toFixed(device.getDig(prop))+device.getMu(prop);
  },

  format_def_S: function (device, prop, val) {
    return val+device.getMu(prop);
  },

  /*
  format_on1_off0: function(device, prop, val) {
    return val == 1 ? 'Включено' : 'Выключено';
  },
  format_on0_off1: function(device, prop, val) {
    return val == 0 ? 'Включено' : 'Выключено';
  },

  format_open1_close0: function(device, prop, val) {
    return val == 1 ? 'Открыто' : 'Закрыто';
  },
  format_open0_close1: function(device, prop, val) {
    return val == 0 ? 'Открыто' : 'Закрыто';
  },

  format_set1_reset0: function(device, prop, val) {
    return val == 1 ? 'Сработка' : 'Сброс';
  },
  format_set0_reset1: function(device, prop, val) {
    return val == 0 ? 'Сработка' : 'Сброс';
  },
  */


  format_dtsec: function(device, prop, val) {
    return hut.isTs(val) ?  hut.getDateTimeFor(new Date(val)) : ''; // default format
  
  },
  format_dtms: function(device, prop, val) {
    return hut.isTs(val) ?  hut.getDateTimeFor(new Date(val),'dtms') : ''; 
  
  },

  format_period1: function(device, prop, val) {
    return hut.timeFormat(val, ['дн', 'час', 'мин'])
  },

  format_period2: function(device, prop, val) {
    return hut.timeFormatHMS(val, ['час', 'мин', 'сек'])
  },

  def_OnChange: function(device, triggers, globals) {

  },

  def_OnInterval: function( device, triggers, globals) {

  },

  def_OnSchedule: function( device, triggers, globals) {

  },

  def_OnBoot: function( device, triggers, globals) {

  },

  def_rw_N: function(device, prop, value) {
    if (isNaN(value)) return { error: 'Допустимо числовое значение. Получено ' + value };
    const newvalue = device.getRounded(prop, value);
    return device.inRange(prop, newvalue) ? newvalue : { error: 'Значение вне диапазона: '+newvalue };
  },

  def_rw_B: function(device, prop, value) {
    return value == 0 || value == 1 ? Number(value) : { error: 'Допустимые значения 1/0. Получено ' + value };
  },

  def_rw_S: function(device, prop, value) {
    return typeof value == 'object' ? JSON.stringify(value) : String(value);
  },
  
  def_cmd_value_on: function(device) {
    if (device.hasChannel('on')) {
      device.writeChannel('on');
    } else {
      device.setValue('value', 1);
    }
  },

  def_cmd_value_off: function(device) {
    if (device.hasChannel('off')) {
      device.writeChannel('off');
    } else {
      device.setValue('value', 0);
    }
  },

  def_cmd_value_toggle: function(device) {
    if (device.value) {
      device.off();
    } else {
      device.on();
    }
  },

  def_cmd_state_on: function(device) {
    if (device.hasChannel('on')) {
      device.writeChannel('on');
    } else {
      device.setValue('state', 1);
    }
  },
  def_cmd_state_off: function(device) {
    if (device.hasChannel('off')) {
      device.writeChannel('off');
    } else {
      device.setValue('state', 0);
    }
  },

  def_cmd_state_toggle: function(device) {
    if (device.state) {
      device.off();
    } else {
      device.on();
    }
  },

  // Эти функции - заглушки для любых свойств при создании пользовательских функций
  def_rw: function(device, prop, value) {
    return value;
  },
  def_par: function(device, prop, value) {
    return value;
  },

  def_calc: function(device) {
    return device.value > 0 ? 1 : 0;
  },

  def_cmd: function(device) {
    device.off();
  }
};
