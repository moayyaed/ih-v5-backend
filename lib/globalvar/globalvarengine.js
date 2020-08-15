/**
 * globalvarengine.js
 * 
 */
const util = require('util');

class Globalvarengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = this.holder.dm;

    this.glSet = {};  // key= _id (did), содержит всю инф-ю, [did].value - текущее значение
    this.gldnSet = {};  // key= dn (просто указатель на объект в glSet dn=> did)
    this.globals = {}; // Виртуальный объект, key= dn для работы со значением по dn  (globals.guard=1)
    holder.globals = this.globals;
    holder.glSet = this.glSet;
  }

  start(docs) {
   
    console.log('INFO: Globalvars: ' + docs.length);
    docs.forEach(item => {
      this.addItem(item);
    });
  }

  addItem(doc) {
    if (doc && doc.dn) {
      this.glSet[doc._id] = doc;
      this.glSet[doc._id].value = doc.defval;

      const prop = doc.dn;
      this.gldnSet[prop] = this.glSet[doc._id];

      Object.defineProperty(this.globals, prop, {

        get: () => this.gldnSet[prop].value,
      
        set: (value) => {
          this.gldnSet[prop].value = value;
          const did = this.gldnSet[prop]._id;
          this.holder.emit('changed:globals',[{did, prop, value}]);
         
        }
      });

      
    }
  }

}

module.exports = Globalvarengine;

