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
  
  // Считать файлы лицензий в таблицу licenses
  await load();
  // Посчитать число тэгов

  let limitLht = 0;
  let enabledLht = 420; // 420
  let usedLht = await countUsedTags();
  setLht();

  holder.dm.on('insert:licenses', docs => {
    docs.forEach(doc => {
      // Добавлены лицензии - учесть их?
    });
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

  function setLht() {
    appconfig.set('enabledLht', enabledLht);
    appconfig.set('usedLht', usedLht);
    limitLht = enabledLht < usedLht ? 1 : 0;
    // if (xlimitLht != limitLht) {
    appconfig.set('limitLht', limitLht);
    holder.emit('emulmode');
    // console.log('enabledLht '+enabledLht+' usedLht='+usedLht+' limitLht='+limitLht)
    // }
  }

  function load() {
    const arr = appconfig.getLicenses();
    
    const docs = [];
    arr.forEach(item => {
      try {
        console.log('INFO: load lic: item='+item+' LEN='+item.length+' type='+typeof item);
        const decData = appcrypto.decrypt(item);
        const resObj = JSON.parse(decData);
        const ldata = resObj.payload;
        console.log('INFO: decrypted data: '); // {status: 1, payload: {id: 'qdHnMFRDF',key: '86b0ae73-79f1-44d5-a8ed-cffba40ae14d',}
        docs.push(...ldata);
      } catch (e) {
        console.log('ERROR: Parsing license file, skipped: ' + util.inspect(e));
      }
    });
    holder.dm.insertDocs('licenses', docs);
  }
};
