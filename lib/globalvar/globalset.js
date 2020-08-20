/**
 * globalset.js
 */

class Globalset {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;
    this.glSet = {}; // key= _id (did), содержит всю инф-ю, [did].value - текущее значение
    this.gldnSet = {}; // key= dn (просто указатель на объект в glSet dn=> did)

    holder.dm.on('inserted:globals', docs => {
      // Добавлены новые переменные
      console.log('EMIT: globals has inserted! ' + docs);
      docs.forEach(doc => this.addItem(doc));
    });

    holder.dm.on('updated:globals', docs => {
      // Изменены переменные
    });
    holder.dm.on('removed:globals', docs => {
      // Удалены переменные
    });
  }

  addItem(doc) {
    if (doc && doc.dn) {
      this.glSet[doc._id] = doc;
      this.glSet[doc._id].value = doc.defval;

      const dn = doc.dn;
      this.gldnSet[dn] = this.glSet[doc._id];
    }
  }

  getItem(id) {
    return id.startsWith('gl') ? this.glSet[id] : this.gldnSet[id];
  }

  setValue(id, value, sender) {
    const item = this.getItem(id);
    if (item) {
      if (item.value != value) {
        const prev = item.value;
        item.value = value;
        const logArr = [];
        const did = item._id;
        const prop = item.dn;
        const ts = Date.now();
     

        if (sender) {
          logArr.push({ did, prop, val: value, ts: ts - 1, cmd: 'set', ...sender });
        }

        this.holder.emit('changed:globals', [{ did, prop, value, ts, changed: 1, prev }]);
        logArr.push({ did, prop, val: value, ts });
        this.dm.insertToLog('devicelog', logArr);
      }
    } else {
      console.log('ERROR: Globalset var not found ' + id);
    }
  }

  getValue(id) {
    const item = this.getItem(id);
    return item ? item.value : 0;
  }
}

module.exports = Globalset;
