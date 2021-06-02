/**
 * snippetservice.js
 *   - запускает сниппеты с интервалом, значения передает целевому устройству или глобальной переменной
 *   - запуск кода выполняется в отдельном worker-е (один для всех сниппетов)
 *
 *  - Если worker не отвечает - перезагрузить worker (ping-pong)
 *
 */

const util = require('util');

const Snippetengine = require('./snippetengine');
const Snippetmate = require('./snippetmate');
const { Worker } = require('worker_threads');

module.exports = async function(holder) {
  holder.snippetWorker = startWorker();

  const engine = new Snippetengine(holder);
  const mate = new Snippetmate(engine);
  engine.start(await mate.start());

  let waitPong = 0;

  // Запуск workera - также выполняется и перезапуск
  function startWorker() {
    const fullPath = require.resolve('./w_snippet');
    let w = new Worker(fullPath);

    w.on('message', msg => {
      // console.log(' FROM SnippetWORKER: ' + util.inspect(msg));
      const { name, data } = msg;
      switch (name) {
        case 'trace:snippet':
          return tracing(data);
        case 'result:snippet':
          return engine.getResult(data);
        case 'pong':
          waitPong = 0;
          break;
        default:
      }
    });

    w.on('error', err => {
      console.log(`ERROR: snippetWorker threadId ${holder.snippetWorker.threadId}: ${util.inspect(err)}`);
    });
    w.on('exit', code => {
      console.log(`WARN: snippetWorker threadId ${holder.snippetWorker.threadId} stopped with exit code ${code}`);
    });
    return w;
  }

  // Запускается по сообщению 'trace:snippet' от worker-а
  function tracing({ did, state, ts, error = '', debugerror = ''}) {
    if (!holder.snippetSet[did]) {
      console.log('ERROR: trace:snippet ' + did + ' Not found in snippetSet!');
      return;
    }

    if (state) {
      holder.snippetSet[did].startTs = ts;
      holder.snippetSet[did].stopTs = 0;
      holder.snippetSet[did].error = error;
    } else {
      holder.snippetSet[did].active = 0;
      holder.snippetSet[did].stopTs = ts;
      holder.snippetSet[did].error = error;
    }
    if (error) {
      holder.snippetSet[did].qts = 0;
      engine.debugSnippet(did, debugerror || error);
    }
  }

  // Отслеживание, что worker не повис.
  // Если повис - terminate и запуск заново
  setInterval(() => {
    const threadId = holder.snippetWorker.threadId;
    if (threadId < 0) {
      console.log('WARN: snippetWorker  '+ threadId+' has terminated. Try restart. ');
      holder.snippetWorker = startWorker();
      return;
    }

    if (waitPong > 0) {
      console.log('WARN: snippetWorker. '+ threadId+' No pong > 10 s. TERMINATE SNIPPET WORKER!');
      holder.snippetWorker.terminate();

      // Все активные сниппеты пометить - снят при зависании??
      // TODO - они больше не запустятся, т к не включены в расписание!!
      // Нужна какая-то стратегия. Пока все активные при следующем запуске работать не будут
      Object.keys(holder.snippetSet).forEach(did => {
        if (holder.snippetSet[did].active) {
          holder.snippetSet[did].active = 0;
          holder.snippetSet[did].resets += 1;
        }
      });
      waitPong = 0;
    } else {
      holder.snippetWorker.postMessage({ name: 'ping' });
      waitPong = Date.now();
    }
  }, 10000);
};
