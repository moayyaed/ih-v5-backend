/**
 *
 */

const EventEmitter = require('events');

const unitSentMessages = {};

module.exports = function() {
  const holder = new EventEmitter();
  holder.system = { bootTs: Date.now() };

  holder.unitSet = {}; // Плагины
  holder.unitMessages = {}; // Сообщения, отправленные плагинам

  // Добавить плагины
  holder.addUnit = function(id) {
    holder.unitSet[id] = {
      id,
      sentArr: [],
      ps:0,
      send: mes => {
        if (!unitSentMessages[id]) unitSentMessages[id] = [];
        unitSentMessages[id].push(mes);
      }
    };
  };

  holder.runUnit = function(id) {
    holder.unitSet[id].ps = 1;
  }

  holder.clearUnitSentMessages = function(id) {
    if ( unitSentMessages[id]) unitSentMessages[id] = [];
  }

  holder.getUnitSentMessages = function(id) {
    return  unitSentMessages[id] ? unitSentMessages[id] : [];
  }

  holder.dm = new Datamanager();

  return holder;
};

class Datamanager extends EventEmitter {
  // async get(table, filter = {}, opt = {}) {
  constructor() {
    super();
    this.store = {};
  }

  async insertDocs(table, docs) {
    if (!this.store[table]) this.store[table] = [];
    docs.forEach(doc => this.store[table].push(doc));
    this.emit('inserted:' + table, docs);
    console.log('DM emit inserted:' + table);
  }

  async get(table) {
    return this.store[table] ? this.store[table] : [];
  }

  async findRecordById(table, id) {
    if (!this.store[table]) return;
    for (const rec of this.store[table]) {
      if (rec._id == id) return rec;
    }
  }
}
