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


const dm = require('../datamanager');
const Engine = require('./dbagentengine'); 
const Mate = require('./dbagentmate'); 


module.exports = async function (holder) {
  const engine = new Engine(holder, dm);
  const mate = new Mate(engine);
  engine.start(await mate.start());
};

 /*
const util = require('util');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const appconfig = require('../appconfig');
const dm = require('../datamanager');
const dbconnector = require('../dbconnector');


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
   
    log('ERROR: dbagent stopped with code ' + code, 1);
  });

 
};

function log(txt, level) {
  console.log(txt);
  dm.insertToLog('pluginlog', { unit: 'db', txt, level });
}
*/

