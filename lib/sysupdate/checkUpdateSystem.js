/**
 *  checkUpdateSystem.js
 */

const util = require('util');

const updateutil = require('./updateutil');
const appconfig = require('../appconfig');

module.exports = async function checkUpdateSystem() {
  try {
    let refresh = false;
    let message = 'Установлена последняя версия ';
    const res = await updateutil.getLatest();
    if (res) {
      message = 'Доступна версия ' + res.newversion;
      appconfig.setNewversion('system', res.newversion);
      refresh = true;
    }
    return { alert: 'info', message, refresh };
  } catch (e) {
    console.log('ERROR: checkUpdateSystem ' + util.inspect(e));
    throw { message: 'Недоступен сервер обновлений!' };
  }
};
