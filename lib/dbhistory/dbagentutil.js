/**
 * dbagentutil.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const wrappers = require('../utils/wrappers');
// const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');

const ROOT = 'dbagentgroup';

/** sync
 *  Синхронизация таблицы dbagents
 *   - Таблица содержит только корневую папку + агент для выбранной БД
 *   Остальные записи, если есть, удаляются
 *
 * Результат: массив записей для добавления в таблицу или удаления
 *
 *
 * @result {Array} массив записей - [{new:true, doc:{_id,..}}, ]
 */

async function sync(docs) {
  const changeDocs = [];

  try {
    let agentDoc;
    const dbname = appconfig.get('dbname');
    const projectName = appconfig.get('project');
    console.log('START SYNC ' + dbname);

    // Проверить, что модуль агента и сервис БД существует
    // Если нет - записать ошибку
    const errstr = await checkAvailability(dbname);

    docs.forEach(doc => {
      if (doc._id == dbname) {
        agentDoc = doc;
      } else if (doc._id != ROOT && doc._id != dbname) {
        changeDocs.push({ del: 1, doc });
      }
    });

    if (dbname) {
      if (!agentDoc) {
        // Создать новую запись с данными по умолчанию, имя БД = имя проекта?
        changeDocs.push({ new: 1, doc: { _id: dbname, title: dbname, parent: ROOT, database: projectName, errstr } });
        console.log('WARN: Create new record for ' + dbname);
      } else if (agentDoc.errstr != errstr) {
        agentDoc.$set = { errstr };
      }
    }
  } catch (e) {
    console.log('ERROR: sync dbagents ' + util.inspect(e));
  }
  console.log(' SYNC changeDocs=' + util.inspect(changeDocs));
  return changeDocs;
}

async function checkAvailability(dbname) {
  if (!dbname) return '';

  const dbagent_path = path.join(appconfig.get('agentspath'), dbname, 'dbagent.js');
  if (!fs.existsSync(dbagent_path)) return 'Dbagent module not found: ' + dbagent_path;

  // проверить что сервис установлен - его имя нужно взять у агента
  const serviceName = 'influxd.service';

  let errstr = '';
  try {
    const services = await wrappers.getServiceStatus();
    if (!services) return ''; // Какая-то проблема на уровне ОС - не проверяем

    let status;
    services.forEach(item => {
      if (item.name == serviceName) status = item.status;
    });
    if (!status) errstr = 'Not found ' + serviceName + '. Probably service not installed!';
    if (status != 'enabled') errstr = 'Service ' + serviceName + ' has status ' + status;
  } catch (e) {
    console.log('WARN: Ошибка при выполнении команды systemctl при проверке сервиса ' + serviceName);
  }
  return errstr;
}

module.exports = {
  sync
};
