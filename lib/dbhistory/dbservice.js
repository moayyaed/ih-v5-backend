/**
 * Определяет, какая БД используется
 *
 * Запускает dbagent как дочерний процесс
 *
 * Инициализирует объект dbconnector для связи с dbagent-ом
 *   dbconnector далее используется аналогично dm, операции read, write, getStats
 *
 * Следит за процессом dbagent, выставляет ошибку БД
 *
 * TODO При необходимости перезапускает dbagent
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const appconfig = require('../appconfig');
const dm = require('../datamanager');
const dbconnector = require('../dbconnector');
// const hut = require('../utils/hut');

const dbagentutil = require('./dbagentutil');

module.exports = async function(holder) {
  let dbname;
  let dbagent;
  let dbagentDoc;

  // Создать таблицу dbagents 
  await dm.reviseTableWithFolder('dbagent', dbagentutil.sync);

  try {
    //  Определяет, какая БД используется
    dbname = appconfig.get('dbname');
    if (!dbname) {
      log('В этом проекте база данных не используется', 2);
      return; // Это штатно - может и не быть??
    }
 
    log('Use database ' + dbname, 2);
    // const workpath = appconfig.get('workpath');
    dbagentDoc = await dm.findRecordById('dbagent', dbname);

    // Запуск  dbagent-a
    const dbagent_path = path.join(appconfig.get('agentspath'), dbname, 'dbagent.js');
    if (!fs.existsSync(dbagent_path)) throw { message: 'File not found: ' + dbagent_path };

    // TODO Выбрать параметры для dbagent-а?
    const options = {
      database: dbagentDoc.database
    };
    dbagent = fork(dbagent_path, [JSON.stringify(options)]);

    // dbconnector - объект для свзи с БД
    dbconnector.init(dbagent);
  } catch (err) {
    // TODO - Установить ошибку БД - нужен системный индикатор!!
    let errStr = util.inspect(err);
    if (!errStr.startsWith('ERROR:')) errStr = 'ERROR: dbservice: ' + errStr;

    log(errStr);
    return;
  }

  // -------
  // Контроль за дочерними процессами

  dbagent.on('exit', code => {
    // Агент вышел - установить ошибку,
    // TODO - пытаться перезапустить
    // console.log('ERROR: dbagent stopped with code ' + code);
    log('ERROR: dbagent stopped with code ' + code, 1);
  });

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
