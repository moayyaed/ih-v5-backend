/**
 * Запустить стартовый модуль RESTAPI - если есть
 *
 */

// const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

module.exports = async function(holder) {
  try {
    const rec = await getRestapiRootDoc();
    if (!rec || !rec.useboot) return;
    const filename = appconfig.getRestapihandlerFilename('restapi'); // Укороченное имя корневого узла
    if (!fs.existsSync(filename)) {
      console.log('ERROR: apiboot not started! Not found  ' + filename);
      return;
    }
    require(filename)(holder);
  } catch (e) {
    const errStr = hut.getShortErrStr(e);
    console.log('ERROR: apiboot run:  ' + errStr);
  }

  async function getRestapiRootDoc() {
    const rec = await holder.dm.dbstore.findOne('restapihandlers', { _id: 'restapihandlergroup' });
    if (rec) {
      return rec;
    }
    console.log('ERROR: Not found restapi root doc!');
  }
};
