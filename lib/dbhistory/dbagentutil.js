/**
 * dbagentutil.js
 */

const util = require('util');
const path = require('path');

// const wrappers = require('../utils/wrappers');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const dbconnector = require('../dbconnector');

const ROOT = 'dbagentgroup';

/** sync  НЕ ИСПОЛЬЗУЕТСЯ
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
    const dbname = appconfig.get('project_dbname');

    // Проверить, что модуль агента и сервис БД существует
    // Если нет - записать ошибку
    // const errstr = await checkAvailability(dbname);

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
        changeDocs.push({ new: 1, doc: createNewDoc(dbname) });
        console.log('WARN: Create new record for ' + dbname);
      }
    }
  } catch (e) {
    console.log('ERROR: sync dbagents ' + util.inspect(e));
  }
  console.log(' SYNC changeDocs=' + util.inspect(changeDocs));
  return changeDocs;
}

function createNewDoc(dbname) {
  // Имя новой БД совпадает с именем проекта??
  return { _id: dbname, title: dbname, parent: ROOT, database: appconfig.get('project') };
}

async function getActiveUnitDoc(holder) {
  //  Определяет активный dbagent, возвращает только его или null
  const docs = (await holder.dm.dbstore.get('dbagents')).filter(one => isActive(one));
  return docs.length ? docs[0] : null;
}

function isActive(doc) {
  return doc && doc.active;
}

async function replaceActiveDbagent(dbname, holder) {
  const doc = await holder.dm.findRecordById('dbagent', dbname);
  if (!doc) throw { message: 'Replace active dbagent failed! Not found record for ' + dbname };

  // У этого поставить, у активного снять
  doc.$set = { active: 1 };
  const changeDocs = [doc];

  const activeDoc = await getActiveUnitDoc(holder);
  if (activeDoc) {
    activeDoc.$set = { active: 0 };
    changeDocs.push(activeDoc);
  }
  await holder.dm.updateDocs('dbagent', changeDocs);
}

function createUnit(doc) {
  const unit = {
    doc, // Сохранить как есть все что пришло из документа (параметры БД?)
    ps: '',
    dbagent: 1,
    dbname: doc._id,

    getModulepath() {
      return path.join(appconfig.get('agentspath'), this.dbname, 'dbagent.js'); // Путь к модулю для запуска
    },

    getArgs() {
      // Формировать аргументы командной строки
      const options = {
        database: this.doc.database,
        logfile: appconfig.get('logpath') + '/ih_' + this.dbname + '.log'
      };

      if (this.info && this.info.opt && Array.isArray(this.info.op)) {
        this.info.opt.forEach(propName => {
          if (this.doc[propName] != undefined) options[propName] = this.doc[propName];
        });
      }

      return [JSON.stringify(options)];
    },

    setDoc(newDoc) {
      this.doc = hut.clone(newDoc);
    },

    setInfo(info) {
      this.info = hut.clone(info);
    },

    connector: dbconnector,

    send(sendObj) {
      if (this.ps) this.ps.send(sendObj);
    },
    sendSigterm() {
      if (this.ps) {
        this.ps.kill('SIGTERM');
        this.ps = 0;
        this.sigterm = 1;
      }
    }
  };

  return unit;
}

/*
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
*/

module.exports = {
  sync,
  getActiveUnitDoc,
  replaceActiveDbagent,
  createNewDoc,
  createUnit
};
