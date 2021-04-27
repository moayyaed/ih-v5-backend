/**
 * licutil.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const portal = require('../domain/portal');


async function activateLicense(query, holder) {
  if (!query || !query.payload || !query.payload.p3) throw { message: 'Expected payload with p3 part!' };

  const newlicense = query.payload.p3;
  if (!newlicense) throw { message: 'Ключ не введен!' };

  try {
    const { data, decData } = await portal.activation_license({ key: newlicense }, holder);
    const resObj = JSON.parse(decData);
    console.log('INFO: <=  data = ' + util.inspect(resObj));
    if (!resObj || !resObj.status || !resObj.payload) return { res: 0, message: resObj.message || 'Empty message!' };

    const licdata = resObj.payload;
    // Сохранить активированную лицензию в зашифрованном виде, Добавить в таблицу лицензий
    await appconfig.saveLicense(licdata.key, data);
    holder.dm.insertDocs('licenses', [{ _id: licdata.key, ...licdata }]);
    return { alert: 'info', message: 'Лицензия успешно активирована', ok: 1, refresh: true };

  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return {  alert: 'info', message: 'Ошибка при активации!', ok: 0 };
  }
}

async function deactivateLicense(query, holder) {
  if (!query || !query.payload || !query.payload.key) throw { message: 'Expected payload with key!' };

  try {
    const key = query.payload.key;
    const rec = await holder.dm.findRecordById('licenses', key); // rec {_id:key, id, userid}
    if (!rec) throw { message: 'Not found record with key ' + key };
    if (!rec.id || !rec.userid) throw { message: 'Invalid record with key ' + key + '! Missing id or userid!' };

    const resObj = await portal.deactivate_license({ key, id: rec.id, userid: rec.userid }, holder);

    console.log('INFO: <=  portalResult.data=' + util.inspect(resObj));
    if (!resObj || !resObj.status) return { res: 0, message: resObj.message || 'No message from portal!' };

    // Удалить файл лицензии и запись из таблицы
    appconfig.removeLicense(key);
    holder.dm.removeDocs('licenses', [{ _id: key }]);
    return { alert: 'info', message: 'Лицензия деактивирована', ok: 1, refresh: true };
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return { alert: 'info', message: hut.getShortErrStr(e), ok: 0 };
  }
}

// Демо лицензия разовая, на портал деактивацию не отправляем, просто удаляем
async function deactivateDemoLicense(query, holder) {
  if (!query || !query.payload || !query.payload.key) throw { message: 'Expected payload with key!' };

  try {
    // Удалить файл лицензии и запись из таблицы
    const key = query.payload.key;
    appconfig.removeLicense(key);
    holder.dm.removeDocs('licenses', [{ _id: key }]);
    return { alert: 'info', message: 'Demo лицензия удалена', ok: 1, refresh: true };
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return { alert: 'info', message: 'Ошибка при удалении!', ok: 0 };
  }
}

module.exports = {
  activateLicense,
  deactivateLicense,
  deactivateDemoLicense
};
