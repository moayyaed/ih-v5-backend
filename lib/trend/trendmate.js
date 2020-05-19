/**
 * 
 */

class Trendmate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  async start() {
    this.dm.on('inserted:devicedb', docs => {
      // Добавлены новые устройства - добавить в devSet, приходит вся запись целиком
      console.log('EMIT: devicedb has inserted! ' + docs);
      docs.forEach(doc => this.engine.addDeviceTrendItems(doc));
    });
 
    return this.load();
  }

  async load() {
    // Получить список устройств из таблицы devicedb
    // const dbDocs = await this.dm.dbstore.get('devicedb', {}, { order: 'dn' });
    return this.dm.dbstore.get('devicedb', {}, { order: 'dn' });

  }

}

module.exports = Trendmate;