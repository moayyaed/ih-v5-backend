/**
 * 
 */

class Globalvarmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
  
    this.dm.on('inserted:globals', docs => {
      // Добавлены новые переменные
      console.log('EMIT: globals has inserted! ' + docs);
      docs.forEach(doc => this.engine.addItem(doc));
    });
 
    return this.load();
  }

  async load() {
   
    return this.dm.dbstore.get('globals', {}, { order: 'dn' });

  }

}

module.exports = Globalvarmate;