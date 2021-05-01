/**
 * Объект трассировки скрипта (обработчика или сценария?)
 *
 */

/*
const util = require('util');

const hut = require('../utils/hut');
*/

class Traco {
  constructor(id, handlerObj, own) {
    this.id = id;  // hanid
    this.own = own;
    this.count = 0;
    this.minDuration = 0;
    this.maxDuration = 0;
    if (handlerObj) {
      this.blk = handlerObj.blk;
      this.error = handlerObj.error;
    }
  }

  fixStart({ did, ts }) {
    this.did = did; // Запущен для устройства
    this.startTs = ts;
    this.stopTs = 0;
    this.count += 1;
    this.blk = 0;
    this.error = '';
  }

  fixStop({ did, ts, blk = 0, error = '' }) {
    this.did = did;
    this.stopTs = ts;

    //  Worker может блокировать
    this.blk = blk;
    this.error = error;

    if (this.startTs) {
      this.duration = ts - this.startTs;
      if (!this.minDuration || this.duration < this.minDuration) {
        this.minDuration = this.duration;
      }
      if (this.duration > this.maxDuration) {
        this.maxDuration = this.duration;
      }
    }
  }
}

module.exports = Traco;
