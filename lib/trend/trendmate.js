

class Trendmate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  async start() {
    this.dm.on('inserted:device', docs => {
      // docs.forEach(doc => this.engine.onInsertDevice(doc));
    });
  }
}

module.exports = Trendmate;