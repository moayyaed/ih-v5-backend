/**
 *  checkUpdateSystem.js
 */

const util = require('util');

const updateutil = require('./updateutil');
const appconfig = require('../appconfig');

module.exports = async function checkUpdateSystem() {
  let refresh = false;
  let message = 'Установлена последняя версия ';
  // const res = await updateutil.getLatest();

  const res = await updateutil.getUpdateInfo();
  if (res) {
    if (res.newversion) {
      message = 'Доступна версия ' + res.newversion;
      appconfig.setNewversion('system', res.newversion);
      refresh = true;
    } else {
      message = res.error || 'Ошибка при проверке обновления!';
    }
  }
  return { alert: 'info', message, refresh };
};

/*
module.exports = async function checkUpdateSystem() {
  try {
    let refresh = false;
    let message = 'Установлена последняя версия ';
    // const res = await updateutil.getLatest();
    const res = await updateutil.getUpdateInfo();
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
*/
