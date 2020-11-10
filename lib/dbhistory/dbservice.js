/**
 * Определяет, какая БД используется
 *
 * Запускает движок БД, если в пакете dbagent-а есть startengine
 * Запускает сам dbagent как дочерний процесс
 *
 * Инициализирует объект dbconnector для связи с dbagent-ом
 *   dbconnector далее используется аналогично dm, операции read, write, getStats
 *
 * Следит за дочерними процессами, выставляет ошибку БД
 *
 * При необходимости перезапускает дочерние процессы
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const appconfig = require('../appconfig');
const dm = require('../datamanager');
const dbconnector = require('../dbconnector');
const hut = require('../utils/hut');

const dbagentutil = require('./dbagentutil');

module.exports = async function(holder) {
  let dbname;
  let dbagent;
  let engine;

  // Создать таблицу dbagents - позже перенести
  const dbagentspath = appconfig.get('agentspath');
  await dm.reviseTableWithFolder('dbagent', async docs => dbagentutil.sync(docs, dbagentspath));


  try {
    //  Определяет, какая БД используется - в основном config.json
    dbname = appconfig.get('dbname');
    if (!dbname) throw { message: 'Missing "dbname". Database will not be used!' };

    log("Use database "+dbname, 2);
    const workpath = appconfig.get('workpath');

    // Найти агент БД в папке agents
    const module_path = path.join(appconfig.get('agentspath'), dbname);
    if (!fs.existsSync(module_path)) throw { message: 'Dbagent module not found: ' + dbagent_path };

    // working dir должен содержать config_<dbname>.json
    // Если его нет - копировать из папки агента
    const configName = 'config_' + dbname + '.json';
    const configFileName = path.join(workpath, configName);
    if (!fs.existsSync(configFileName)) {
      const configFileName_def = path.join(module_path, configName);
      if (fs.existsSync(configFileName_def)) {
        await fs.promises.copyFile(configFileName_def, configName);
      }
    }
      

    // Если есть модуль startengine - запуск движка БД (akumuli)
    // Модуль запускается синхронно в текущем потоке, запускает движок как child process и возвращает ChildProcess Handle
    const startengine_path = path.join(module_path, 'startengine.js');
    if (fs.existsSync(startengine_path)) {
      engine = require(startengine_path)(workpath); // При ошибке - throw
      // TODO - можно выгрузить этот модуль, он больше не нужен??
      // hut.unrequire(startengine_path);
    }

    // Запуск  dbagent-a
    const dbagent_path = path.join(module_path, 'dbagent.js');
    if (!fs.existsSync(dbagent_path)) throw { message: 'File not found: ' + dbagent_path };

    dbagent = fork(dbagent_path, [workpath]); // Параметр - путь к working dir, где лежат config файлы

    // dbconnector - объект для свзи с БД
    dbconnector.init(dbagent);
  } catch (err) {
    // TODO - Установить ошибку БД - нужен системный индикатор!!

    // let errStr = hut.getShortErrStr(err);
    let errStr = util.inspect(err);
    if (!errStr.startsWith('ERROR:')) errStr = 'ERROR: dbservice: ' + errStr
   
    log(errStr);
    return;
  }

  // -------
  // Контроль за дочерними процессами

  dbagent.on('exit', code => {
    // Агент вышел - установить ошибку, пытаться перезапустить ??
    console('ERROR: dbagent stopped with code ' + code);
  });

  if (engine) {
    engine.stdout.on('data', data => {
      console.log('INFO: ' + data.toString());
    });

    engine.on('error', err => {
      console.log('ERROR: ' + dbname + ' start error! ' + hut.getShortErrStr(err));
    });

    engine.on('exit', code => {
      console.log('ERROR:  ' + dbname + ' stopped with code ' + code);
    });
  }
};

function log(txt, level) {
  console.log(txt);
  dm.insertToLog('pluginlog', { unit: 'db', txt, level });
}