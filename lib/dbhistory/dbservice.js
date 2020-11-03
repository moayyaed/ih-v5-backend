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

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const appconfig = require('../appconfig');
const dbconnector = require('../dbconnector');
const hut = require('../utils/hut');

module.exports = async function(holder) {
  let dbname;
  let dbagent;
  let engine;

  try {
    //  Определяет, какая БД используется - в основном config.json
    dbname = appconfig.get('dbname');
    if (!dbname) throw { message: 'Missing "dbname", Database will not be used!' };

    // Найти агент БД в папке agents
    const module_path = path.join(appconfig.get('agentspath'), dbname);
    if (!fs.existsSync(module_path)) throw { message: 'Dbagent module not found: ' + dbagent_path };

    // working dir должен содержать config_<dbname>.json
    // Его использует startengine, а настройка делается через интерфейс?

    const dbconfig = path.join(appconfig.get('workpath'), 'config_' + dbname + '.json');
    if (!fs.existsSync(dbconfig)) throw { message: 'Dbconfig not found: ' + dbconfig};
      

    // Если есть модуль startengine - запуск движка БД (akumuli)
    // Модуль запускается синхронно в текущем потоке, запускает движок как child process и возвращает ChildProcess Handle
    const startengine_path = path.join(module_path, 'startengine.js');
    if (fs.existsSync(startengine_path)) {
      engine = require(startengine_path)(dbconfig); // При ошибке - throw
      // TODO - можно выгрузить этот модуль, он больше не нужен
    }

    // Запуск  dbagent-a
    const dbagent_path = path.join(module_path, 'dbagent.js');
    if (!fs.existsSync(dbagent_path)) throw { message: 'File not found: ' + dbagent_path };

    dbagent = fork(dbagent_path, [appconfig.get('workpath')]); // Параметр - путь к working dir, где лежат config файлы

    // dbconnector - объект для свзи с БД
    dbconnector.init(dbagent);
  } catch (err) {
    // Установить ошибку БД
    console.log('ERROR: dbservice ' + hut.getShortErrStr(err));
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
