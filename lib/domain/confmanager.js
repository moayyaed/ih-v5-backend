/**
 * confmanager.js
 */

const util = require('util');

const appconfig = require('../appconfig');
const appcrypto = require('../utils/appcrypto');
const hwid = require('../utils/hwid');

module.exports = async function(holder) {
  const res = await hwid();
  appconfig.set('hwid', res);
  appcrypto.start(appconfig.get('sysbasepath') + '/keys/publicAuth.pem', res);

  await load();
  await enableModules();

  holder.dm.on('inserted:licenses', async docs => {
    for (const doc of docs) {
      if (doc && doc.product) enableModule(doc.product);
    }
    holder.dm.invalidateCache({ type: 'menu', id: 'pmmenu' });
  });

  holder.dm.on('removed:licenses', async () => {
    //  Удалены лицензии - удалить все и заново сформировать
    appconfig.disableAllModules();
    enableModules();
    holder.dm.invalidateCache({ type: 'menu', id: 'pmmenu' });
  });

  async function enableModules() {
    const docs = await holder.dm.dbstore.get('licenses');
    for (const doc of docs) {
      if (doc && doc.product) enableModule(doc.product);
    }
  }

  function enableModule(product) {
    if (product && product.startsWith('module_')) {
      appconfig.set(product, 1);
    }
  }

  async function load() {
    const arr = appconfig.getLicenses();
    const docs = [];
    arr.forEach(item => {
      try {
        const decData = appcrypto.decrypt(item);
        const resObj = JSON.parse(decData); // {status: 1, payload: {id: 'qdHnMFRDF',key: '86b0ae73-79f1-44d5-a8ed-cffba40ae14d',}
        const ldata = resObj.payload;

        docs.push({ _id: ldata.key, ...ldata });
      } catch (e) {
        console.log('ERROR: Parsing license file, skipped: ' + util.inspect(e));
      }
    });
    return holder.dm.insertDocs('licenses', docs);
  }
};
