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
    snippets.forEach(item => {
      this.addSnippet(item);
      this.runSnippet(item.did);
    });
  }

  addSnippet({ did, file, period }) {
    console.log('ADD SNIPPET '+file)
    // Проверить, что модуль существует - уже проверено?
    // const module = appconfig.getSnippetFilename(dn);
    // if (fs.existsSync(module)) {
    const global = did.startsWith('gl');
    this.snippetSet[did] = { did, file, period, global, active: 0 };
    this.runSnippet(did);
  }

  runSnippet(did) {
    if (!this.snippetSet[did]) return;

    if (!hasPeriod(this.snippetSet[did].period)) return;

    // Запустить сниппет. После первого require модуль кэшируется!! Если текст изменился, нужно будет сделать upreq

    try {
      // debugSnippet(dn, 'Started');
      this.snippetSet[did].err = '';
      const file = this.snippetSet[did].file;

      console.log('RUN SNIPPET '+file)
      const target = this.holder.glSet.getItem(did);

      console.log('TARGET did=' + did+' target='+util.inspect(target))
      require(file)(target, (error, result) => {
        this.debugSnippet(did, 'Result: ' + result + (error ? ' Error: ' + getErr(error) : ''));

        // Могли уже сниппет отключить тогда ничего не делаем
        // if (snippetSet[dn]) {
          this.snippetSet[did].active = 0;
          
         // TODO - ПОКА Присвоим глобальной переменной
         this.holder.glSet.setValue(did, result);
          // debugSnippet(dn, 'Set object: ' + util.inspect(resobj));
          tm.startTimer(this.snippetSet[did].period, { owner:'snippet', tname:did })
        
      });

      this.snippetSet[did].active = 1;
      this.snippetSet[did].lts = Date.now();
    } catch (e) {
      this.snippetSet[did].active = 0;
      this.snippetSet[did].lts = Date.now();

      this.snippetSet[did].err = util.inspect(e);
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
        this.runSnippet(did);
      }
    }
  }

  debugSnippet(did, msg) {
    if (this.snippetSet[did] && this.snippetSet[did].debug) {
      this.holder.emit('debug', 'devref.' + did, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);

    }
  }
}

function hasPeriod(str) {
  if (!str) return;
  console.log('HAS PERIOD str='+str)
  // str = str.replace(':', '');
  return !isNaN(str) && Number(str) > 0;
  
}

module.exports = Snippetengine;
