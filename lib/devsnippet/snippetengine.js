/**
 * Snippetengine.js
 */

// Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
const Timerman = require('../utils/timermanager');

const tm = new Timerman(1);

// const sceneutils = require('./sceneutils');

class Snippetengine {
  constructor(holder, dm, agent) {
    this.holder = holder;
    this.dm = dm;
    this.agent = agent;

    this.snippetSet = {};
    holder.snippetSet = this.snippetSet;

    tm.on('ready', this.onTimerReady.bind(this));

    holder.on('startsnippet', (did, period) => {
      this.startSnippet(did, period);
    });
  }

  start(snippets) {
    // [{did, module, period}]
    snippets.forEach(item => {
      this.addSnippet(item);
      this.runSnippet(item.did)
    });
  }

  addSnippet({did, module, period}) {
    // Проверить, что модуль существует - уже проверено?
    // const module = appconfig.getSnippetFilename(dn);
    // if (fs.existsSync(module)) {
      this.snippetSet[did] = { module, period, active: 0 };
      this.runSnippet(did);
  }

  runSnippet(did) {
    if (!this.snippetSet[did]) return;

    if (hasPeriod(this.snippetSet[did].period)) return;

    // Запустить сниппет. После первого require модуль кэшируется!! Если текст изменился, нужно будет сделать upreq
    /*
    try {
      debugSnippet(dn, 'Started');
      snippetSet[dn].err = '';

      require(snippetSet[dn].module)(
        (error, result) => {
          debugSnippet(dn, 'Result: ' + result + (error ? ' Error: ' + getErr(error) : ''));

          // Могли уже сниппет отключить тогда ничего не делаем
          if (snippetSet[dn]) {
            snippetSet[dn].active = 0;
            const resobj = {};
            // Здесь сделать возврат объекта или одиночного значения - тогда это mainProp
            const dobj = houser.getDevobj(dn);
            if (!dobj) throw { message: 'Run snippet, not found ' + dn };

            const prop = dobj.getMainProp();

            resobj[dn] = error ? { err: getErr(error) } : { [prop]: result };
            houser.setDevPropsFromUnit(resobj);

            debugSnippet(dn, 'Set object: ' + util.inspect(resobj));
          }
        },
        { global: houser.globals }
      );

      this.snippetSet[dn].active = 1;
      this.snippetSet[dn].lts = Date.now();
    } catch (e) {
      this.snippetSet[dn].active = 0;
      this.snippetSet[dn].lts = Date.now();

      this.snippetSet[dn].err = getErrorStr(e);
      // Ошибка при запуске!
      debugSnippet(dn, 'ERR:Snippet error ' + util.inspect(e));

      houser.logErr(e, 'Snippet error for ' + dn, 'snippetserver');
      houser.setDevPropsFromUnit({ [dn]: { err: 'Snippet run error' } });
    }

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

}

function hasPeriod(str) {
  if (!str) return;
  str = str.replace(':', '');
  return !isNaN(str) && Number(str) > 0;
}

module.exports = Snippetengine;
