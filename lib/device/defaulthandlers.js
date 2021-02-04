/* eslint-disable object-shorthand */

/**
 * defaulthandlers.js
 */

module.exports = {
  MAIN: function(device, trigger) {

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
