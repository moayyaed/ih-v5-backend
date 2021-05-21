/**
 *  trendmate.js
 */

class Trendmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    this.dm.on('inserted:devicedb', docs => { // Добавлены новые правила записи
      docs.forEach(doc => this.engine.addItem(doc));
    });

    this.dm.on('updated:devicedb', docs => { // Изменены правила записи
 
      //  {_id: 'vcLS8dsMV', did: 'd0024', prop: 'value', dbmet: 1, dbforce: '77', '$set': { dbforce: '88' }}
      docs.forEach(doc => {
        const upDoc = Object.assign({}, doc, doc.$set);
        delete upDoc.$set;
        this.engine.setItem(upDoc);
      });
    });

    this.dm.on('removed:devicedb', docs => { // Удалены правила записи
 
      docs.forEach(doc => this.engine.removeItem(doc));
    });

  }

  
}

module.exports = Trendmate;
