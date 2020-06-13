
const Timerman = require('../utils/timermanager');

module.exports = {
  start(holder) {
    this.holder = holder;
    this.tm = new Timerman(0.1);
    this.tm.on('ready', this.onTimerReady);
  },
  
  sendCommand() {
    this.holder.emit();
  },

  startTimer(interval, did, prop) {
    const owner = did;
    const tname = prop;
    // Удалить таймер, взведенный ранее
    this.tm.deleteAllTimers({ owner, tname });
    const res = this.tm.startTimer(interval, { owner:did, tname });  // { sts: ct, qts: ct + tick * 100 }
    // Сохранить время окончания qts в свойстве устройства
    this.holder.devSet[did].saveQts(prop, res.qts);

  },

  // Отработка событий таймеров устройств (таймеры взводят функции-обработчики)
  onTimerReady(timeobj) {
  
    if (timeobj && timeobj.owner && timeobj.tname) {
      const {owner, tname} = timeobj;
     
      if (this.holder.devSet[owner]) {
        this.holder.devSet[owner].runFunOnTimer(tname);
      }
    }
  }
}

