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
 * TODO При необходимости перезапускает дочерние процессы
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
    // Агент вышел - установить ошибку, 
    // TODO - пытаться перезапустить 
    // console.log('ERROR: dbagent stopped with code ' + code);
    log('ERROR: dbagent stopped with code ' + code, 1)
  });

  if (engine) {
    engine.stdout.on('data', data => {
      log('INFO: '+ dbname+': ' + data.toString(), 1)
    });

    engine.on('error', err => {
      log('ERROR: ' + dbname + ' start error! ' + hut.getShortErrStr(err), 1)
    });

    engine.on('exit', code => {
      log('ERROR:  ' + dbname + ' stopped with code ' + code, 1)
    });
  }

  /*
  process.on('exit', () => {
    if (engine) engine.kill('SIGTERM');
  });
  */
};

function log(txt, level) {
  console.log(txt);
  dm.insertToLog('pluginlog', { unit: 'db', txt, level });
}

// curl --data '{"select":"metric-names"}' http://localhost:8181/api/suggest
/*  => 
+AI005
+DN002
+AI002
+AI006
*/

// curl --data '{"aggregate": { "DN002":"count","AI005":"min_timestamp"}, "output":{ "format": "csv", "timestamp": "iso" }}' http://localhost:8181/api/query
/*  => 
DN002:count prop=value,20201114T104623.903000000,1232
DN002:count prop=state,20201114T104553.735000000,50
AI005:min_timestamp prop=value,20201114T095253.879000000,1.6053475738790001e+18
*/

// {"join":["DN002","AI005"], "range":{"from":"20201117T111400.000", "to":"20201117T122000.000"},"output":{ "format": "csv", "timestamp": "raw"}, "where":{"prop":"value"} }