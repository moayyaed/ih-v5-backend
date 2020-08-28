/* eslint-disable object-shorthand */

/**
 * defaulthandlers.js
 */


module.exports = {
  def_rw_N: function(device, prop, value) {
    if (isNaN(value)) return { error: 'Not a number: ' + value };
    const newvalue = device.getRounded(prop, value);
    return device.inRange(prop, newvalue) ? newvalue : { error: 'Out of range!', value: newvalue };
  },
  def_rw_B: function(device, prop, value) {
    return value == 0 || value == 1 ? Number(value) : { error: 'Expected boolean! Invalid ' + value };
  },

  def_rw_S: function(device, prop, value) {
    return typeof value == 'object' ? JSON.stringify(value) : String(value);
  },
  def_cmd_value_on: function(device) {
    device.setValue('value', 1);
  },

  def_cmd_value_off: function(device) {
    device.setValue('value', 0);
  },

  def_cmd_value_toggle: function(device) {
    if (device.value) {
      device.off();
    } else {
      device.on();
    }
  },

  def_cmd_state_on: function(device) {
    device.setValue('state', 1);
  },
  def_cmd_state_off: function(device) {
    device.setValue('state', 0);
  },

  def_cmd_state_toggle: function(device) {
    if (device.state) {
      device.off();
    } else {
      device.on();
    }
  }
};
