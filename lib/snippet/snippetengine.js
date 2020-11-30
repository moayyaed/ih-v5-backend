/**
 * Snippetengine.js
 */

const util = require('util');

const hut = require('../utils/hut');
// Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
const Timerman = require('../utils/timermanager');

const tm = new Timerman(0.1);

// const sceneutils = require('./sceneutils');

class Snippetengine {
  constructor(holder, dm) {
    this.holder = holder;
    this.dm = dm;

    this.snippetSet = {};
    holder.snippetSet = this.snippetSet;

    tm.on('ready', this.onTimerReady.bind(this));

    holder.on('startsnippet', (did, period) => {
      this.startSnippet(did, period);
    });
  }

  start(snippets) {
    // [{did, file, period}]
    console.log('SNIPPERS: ' + util.inspect(snippets));
    snippets.forEach(item => {
      this.addItem(item);
    });
  }

  addItem(item) {
    const did = item.did;
    this.snippetSet[did] = item;
    this.snippetSet[did].active = 0;
    this.run(did);
  }

  updateItem(item) {
    const did = item.did;
    console.log('updateItem did=' + did);
    if (this.snippetSet[did]) {
      console.log('updateItem exists ' + util.inspect(this.snippetSet[did]));
      // Если взведен таймер - сбросить
      tm.deleteAllTimers({ owner: 'snippet', tname: did });

      // в текущий момент работает, то не учитывать результат работы??
      if (this.snippetSet[did].active) {
        // Будет запущен после отработки с учетом нового таймера
        this.snippetSet[did] = item;
        this.snippetSet[did].active = 1;
        this.snippetSet[did].modif = 1;
        return;
      }
      // 
      item.debug = this.snippetSet[did].debug;
    }
    // иначе запустить как новый
    console.log('updateItem NEW ' + util.inspect(item));
    this.addItem(item);
  }

  removeItem(did) {
    if (this.snippetSet[did]) delete this.snippetSet[did];
  }

  needRun(did) {
    return this.snippetSet[did] && !this.snippetSet[did].err && hasPeriod(this.snippetSet[did].period);
  }

  run(did) {
    if (!this.needRun(did)) {
      return;
    }
    
    // Запустить сниппет. После первого require модуль кэшируется
    this.snippetSet[did].active = 1;
    this.snippetSet[did].lts = Date.now();
    this.snippetSet[did].qts = 0;
    this.debugSnippet(did, 'Started');

    try {
     
      const file = this.snippetSet[did].file;
      const target = this.holder.glSet.getItem(did);

      require(file)(target, (error, result) => {
        this.snippetSet[did].active = 0;
        this.debugSnippet(did, 'Result: ' + result + (error ? ' Error: ' + error : ''));

        // Могли уже сниппет отключить тогда ничего не делаем
        if (!this.snippetSet[did]) return;

        if (this.snippetSet[did].modif) {
          this.snippetSet[did].modif = 0;
        } else {
          // TODO - ПОКА Присвоим глобальной переменной
          this.holder.glSet.setValue(did, result);
          // this.debugSnippet(did, 'Set object: ' + util.inspect(resobj));
        }
        // Запуск следующий раз
        const { qts } = tm.startTimer(this.snippetSet[did].period, { owner: 'snippet', tname: did });
        this.snippetSet[did].qts = qts;
        this.debugSnippet(did, 'Next start ' + hut.getDateTimeFor(new Date(qts), 'shortdt'));
      });

     
    } catch (e) {
      this.snippetSet[did].active = 0;
      this.snippetSet[did].lts = Date.now();

      this.snippetSet[did].err = hut.getShortErrStr(e);
      // Ошибка при запуске!
      // debugSnippet(dn, 'ERR:Snippet error ' + util.inspect(e));

      // houser.logErr(e, 'Snippet error for ' + dn, 'snippetserver');
      // houser.setDevPropsFromUnit({ [dn]: { err: 'Snippet run error' } });
    }

    // Запланировать следующий запуск
    // Периодичность не должна зависеть от длительности самого сниппета???
    // tm.startTimer(this.snippetSet[did].period, { owner:'snippet', tname:did })

    /*
    const qts = schedutils.calcTimerQts({ when: 3, period: this.snippetSet[dn].period });
    if (!qts) {
      debugSnippet(dn, 'ERR:Snippet period error ' + this.snippetSet[dn].period);
      houser.logMsg('Snippet period error for ' + dn, 'snippetserver');
      houser.setDevPropsFromUnit({ [dn]: { err: 'Snippet period error' } });
    } else {
      sctm.addTimer({ tname: dn, owner: 'snippet', qts });
      this.snippetSet[dn].qts = qts;
      debugSnippet(dn, 'Next start ' + hut.getDateTimeFor(new Date(qts), 'shortdt'));
    }
    */
  }

  onTimerReady(timeobj) {
    if (timeobj.owner == 'snippet') {
      // TODO Проверить, что сниппет для устройства еще нужен
      const did = timeobj.tname;
      if (this.snippetSet[did]) {
        // Если callback не сработал - выставить ошибку timeout??
        this.run(did);
      }
    }
  }

  debugctl(mode, snipid) {
    Object.keys(this.snippetSet).forEach(did => {
      if (this.snippetSet[did].snipid == snipid) {
        this.snippetSet[did].debug = mode; // 0 || 1
        if (mode) {
          // Включена подписка - вывести текущее состояние
          this.showState(did);
        }
      }
    });
  }

  debugSnippet(did, msg) {
    // if (this.snippetSet[did] && this.snippetSet[did].debug) {
      console.log('debugSnippet '+did+' '+msg)
    if (this.snippetSet[did]) {
      const snipid = this.snippetSet[did].snipid;
      this.holder.emit(
        'debug',
        'scene_' + snipid,
        hut.getDateTimeFor(new Date(), 'shortdtms') + ' target: ' + did + ' ' + msg
      );
    }
  }

  showState(did) {
    if (!this.snippetSet[did]) return;
    let msg;
    if (this.snippetSet[did].err) {
      msg = this.snippetSet[did].err;
    } else if (this.snippetSet[did].qts) {
      msg = 'Next start ' + hut.getDateTimeFor(new Date(this.snippetSet[did].qts), 'shortdt');
    } else if (this.snippetSet[did].active) {
      msg = 'Working..';
    } else {
      msg = 'Stopped';
    }
    this.debugSnippet(did, msg);
  }

}

function hasPeriod(str) {
  if (!str) return;
  // str = str.replace(':', '');
  return !isNaN(str) && Number(str) > 0;
}

module.exports = Snippetengine;
