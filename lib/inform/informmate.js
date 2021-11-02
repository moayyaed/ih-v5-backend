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

    // Вхождение в группы
    this.dm.on('inserted:agroup_byuser', docs => {
      docs.forEach(doc => this.engine.addGroupItem(doc));
    });

    this.dm.on('inserted:agroup_bygroup', docs => {
      docs.forEach(doc => this.engine.addGroupItem(doc));
    });

    // Изменено вхождение
    // Добавляем новое - старое вхождение уже удалено в before_update:agroup_tab
    this.dm.on('updated:agroup_byuser', docs => {
      docs.forEach(doc => this.engine.addGroupItem(doc));
    });

    this.dm.on('updated:agroup_bygroup', docs => {
      docs.forEach(doc => this.engine.addGroupItem(doc));
    });

    this.dm.on('before_update:agroup_tab', async docs => {
      this.removeUserGroups(docs);
    });

    this.dm.on('before_remove:agroup_tab', async docs => {
      this.removeUserGroups(docs);
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

  async removeUserGroups(docs) {
    for (const doc of docs) {
      const oldDoc = await this.dm.findRecordById('agroup_tab', doc._id);
      if (oldDoc) this.engine.removeGroupItem(oldDoc);
    }
  }
}
module.exports = Informmate;
