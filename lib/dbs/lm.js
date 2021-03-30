/**
 * lm.js
 */

const appconfig = require('../appconfig');

module.exports = async function(holder) {
  let limitLht = 0;
  let enabledLht = 420;  // 420
  let usedLht = await countUsedTags();
  setLht();

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
    limitLht = (enabledLht < usedLht) ? 1 : 0; 
    // if (xlimitLht != limitLht) {
      appconfig.set('limitLht', limitLht);
      holder.emit('emulmode');
      // console.log('enabledLht '+enabledLht+' usedLht='+usedLht+' limitLht='+limitLht)
    // }
  }
};
