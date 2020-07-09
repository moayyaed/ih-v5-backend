/**
 * defaulthandlers.js
 */

function def_rw_N(device, prop, value) {
  if (isNaN(value)) return { error: 'Not a number: ' + value };
  const newvalue = device.getRounded(prop, value);
  return device.inRange(prop, newvalue) ? newvalue : { error: 'Out of range!', value: newvalue };
}

function def_rw_B(device, prop, value) {
  return value == 0 || value == 1 ? Number(value) : { error: 'Expected boolean! Invalid ' + value };
}

function def_rw_S(device, prop, value) {
  return typeof value == 'object' ? JSON.stringify(value) : String(value);
}

function def_cmd_on(device) {
  device.set('value', 1);
}

function def_cmd_off(device) {
  device.set('value', 0);
}

function def_cmd_toggle(device) {
  if (device.value) {
    device.off();
  } else {
    device.on();
  }
}

module.exports = {
  def_rw_N,
  def_rw_B,
  def_rw_S,
  def_cmd_on,
  def_cmd_off,
  def_cmd_toggle
};
