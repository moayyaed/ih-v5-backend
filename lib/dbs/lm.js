/**
 * lm.js
 */

const util = require('util');

const appconfig = require('../appconfig');
const appcrypto = require('../utils/appcrypto');
const hwid = require('../utils/hwid');

module.exports = async function(holder) {
  const res = await hwid();
  appconfig.set('hwid', res);
  appcrypto.start(appconfig.get('sysbasepath') + '/keys/publicAuth.pem', res);

  let limitLht = 0;
  let enabledLht = 0;

  // Посчитать число тэгов
  let usedLht = await countUsedTags();

  // Считать файлы лицензий в таблицу licenses
  await load();
  await countLicTags();
  setLht();

  holder.dm.on('inserted:licenses', async () => {
    // Добавлены лицензии - заново пересчитать по таблице
    await countLicTags();
    setLht();
  });

  holder.dm.on('removed:licenses', async () => {
    //  Удалены лицензии - заново пересчитать по таблице
    await countLicTags();
    setLht();
  });

  // Отслеживание изменения таблицы devhard
  holder.dm.on('changed:devhard', async () => {
    usedLht = await countUsedTags();
    setLht();
  });

  async function countUsedTags() {
    return holder.dm.dbstore.count('devhard', {
      $where() {
        return !!(this.unit && this.chan && this.did && this.prop);
      }
    });
  }

  async function countLicTags() {
    const docs = await holder.dm.dbstore.get('licenses');
    console.log('INFO: countLicTags docs=' + util.inspect(docs));
    enabledLht = 0;
    for (const doc of docs) {
      if (typeof enabledLht == 'number' && doc.product == 'tags' && doc.qt > 0) {
        enabledLht += Number(doc.qt);
      } else if (doc.product == 'unlim') {
        enabledLht = 'unlim';
        return;
      }
    }
  }

  function setLht() {
    appconfig.set('enabledLht', enabledLht);
    appconfig.set('usedLht', usedLht);

    limitLht = (enabledLht == 'unlim') ? 0 : (enabledLht < usedLht ? 1 : 0);
    // if (xlimitLht != limitLht) {
    appconfig.set('limitLht', limitLht);
    holder.emit('emulmode');
    // console.log('enabledLht '+enabledLht+' usedLht='+usedLht+' limitLht='+limitLht)
    // }
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
