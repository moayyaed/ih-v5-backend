/**
 * 
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
      docs.forEach(doc => this.engine.addDeviceTrendItem(doc));
    });
    this.dm.on('updated:devicedb', docs => {
      // Изменены правила записи
      console.log('EMIT: devicedb has updated! ' + docs);
      docs.forEach(doc => this.engine.updateDeviceTrendItem(doc));
    });
    this.dm.on('removed:devicedb', docs => {
      // Удалены правила записи
      console.log('EMIT: devicedb has removed! ' + docs);
      docs.forEach(doc => this.engine.removeDeviceTrendItem(doc));
    });
    return this.load();
  }

  async load() {
    // Получить список устройств из таблицы devicedb
    return this.dm.dbstore.get('devicedb', {}, { order: 'did' });
  }

}

module.exports = Trendmate;