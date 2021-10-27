/**
 * informmate.js
 */

const util = require('util');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');

class Informmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  start() {
    // При добавлении, изменении, удалении адресов
    this.dm.on('inserted:infoaddr', docs => {
      this.insertInfoaddrs(docs);
    });

    this.dm.on('inserted:infoaddr_common', docs => {
      this.insertInfoaddrs(docs);
    });

    // Изменение - может измениться все
    // Добавляем заново - старое уже удалено в before_update:infoaddr
    this.dm.on('updated:infoaddr', docs => {
      this.insertInfoaddrs(docs);
    });

    this.dm.on('updated:infoaddr_common', docs => {
      this.insertInfoaddrs(docs);
    });


    this.dm.on('before_update:infoaddr', docs => {
        this.removeInfoaddrs(docs);
    });

    this.dm.on('before_remove:infoaddr', docs => {
      this.removeInfoaddrs(docs);
  });
  }


  async insertInfoaddrs(docs) {
    for (const doc of docs) {
      const updoc = await this.dm.findRecordById('infoaddr', doc._id);
      this.engine.addInfoaddr(updoc);
    }
  }

  async removeInfoaddrs(docs) {
    for (const doc of docs) {
      const oldDoc = await this.dm.findRecordById('infoaddr', doc._id);
      if (oldDoc) this.engine.removeInfoaddr(oldDoc);
    }
  }
}
module.exports = Informmate;
