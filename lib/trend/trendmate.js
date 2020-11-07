/**
 *  trendmate.js
 */

class Trendmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    this.dm.on('inserted:devicedb', docs => {
      // Добавлены новые правила записи
      console.log('EMIT: devicedb has inserted! ' + docs);
      docs.forEach(doc => this.engine.setItem(doc));
    });
    this.dm.on('updated:devicedb', docs => {
      // Изменены правила записи
      console.log('EMIT: devicedb has updated! ' + docs);
      //  {_id: 'vcLS8dsMV', did: 'd0024', prop: 'value', dbmet: 1, dbforce: '77', '$set': { dbforce: '88' }}
      docs.forEach(doc => {
        // Подставить изменения - будет полная замена
        const upDoc = Object.assign({}, doc, doc.$set);
        delete upDoc.$set;
        this.engine.setItem(upDoc);
      });
    });
    this.dm.on('removed:devicedb', docs => {
      // Удалены правила записи
      console.log('EMIT: devicedb has removed! ' + docs);
      docs.forEach(doc => this.engine.removeItem(doc));
    });
    return this.load();
  }

  async load() {
    // Получить список устройств из таблицы devicedb
    return this.dm.dbstore.get('devicedb', {}, { order: 'did' });
  }
}

module.exports = Trendmate;
