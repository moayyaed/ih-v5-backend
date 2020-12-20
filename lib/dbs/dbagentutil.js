/**
 * dbagentutil.js
 */

const util = require('util');
const path = require('path');

// const wrappers = require('../utils/wrappers');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const dbconnector = require('../dbconnector');
const pluginutil = require('../plugin/pluginutil');

const ROOT = 'dbagentgroup';

function createNewDoc(doc, dbagent) {
  // Получить свойства-параметры и дефолтные значения для этого агента из формы formDbagentCommon
  const defObj = pluginutil.getDefaultPropsFromForm(appconfig.getV5FormPath(dbagent, 'formDbagentCommon'));

  return { ...doc, _id: dbagent, name: dbagent, parent: ROOT, ...defObj };
}

async function prepareDocAfterInstall(dbagent, holder) {
  const doc = await holder.dm.findRecordById('dbagent', dbagent);
  return doc ? '' : createNewDoc({ order: 100 }, dbagent);
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
    id: doc._id,
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
        logfile: appconfig.get('logpath') + '/ih_' + this.dbname + '.log',
        loglevel: this.doc.loglevel
      };
      const exProps = pluginutil.getExcludedProps();

      Object.keys(this.doc).forEach(propName => {
        if (!exProps.includes(propName) && this.doc[propName] != undefined) {
          options[propName] = this.doc[propName];
        }
      });

      return [JSON.stringify(options)];
    },

    setDoc(newDoc) {
      this.doc = hut.clone(newDoc);
    },

    setInfo(info) {
      console.log('WARN: setInfo ' + util.inspect(info));
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
  getActiveUnitDoc,
  replaceActiveDbagent,
  createNewDoc,
  createUnit,
  prepareDocAfterInstall
};
