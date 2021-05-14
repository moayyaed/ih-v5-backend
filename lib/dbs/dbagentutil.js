/**
 * dbagentutil.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../utils/hut');
const wu = require('../utils/wrappers');

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

function invalidateCache(dbagent, dm) {
  dm.invalidateCache({ method: 'getmeta', type: 'dbagentinfo', id: dbagent });
  dm.invalidateCache({ method: 'getmeta', type: 'form', id: 'formDbagentCommon', nodeid: dbagent });
}

async function getActiveUnitDoc(holder) {
  if (appconfig.get('nodbagent')) return null;

  const alldocs = await holder.dm.dbstore.get('dbagents');

  //  Определяет активный dbagent
  const docs = alldocs.filter(one => isActive(one));
  if (docs.length) return docs[0];

  // Если агенты есть, но отключены - ничего не добавляем
  const adocs = alldocs.filter(one => one && !one.folder);
  if (adocs.length) return null;

  // Если список пуст - добавить sqlite dbagent (при первом запуске?)
  const rec = getDefaultDbagentRecord();
  if (rec) await holder.dm.insertDocs('dbagent', [rec]);
  return rec || null;
}

function getDefaultDbagentRecord() {
  const name = 'sqlite';
  const modulepath = appconfig.getDbagentModule(name);
  if (!fs.existsSync(modulepath)) {
    console.log('WARN: Failed to plug "sqlite"  as "Historical DB". Not found ' + modulepath);
    return;
  }

  return {
    _id: name,
    order: 2000,
    parent: ROOT,
    name,
    dbPath: path.join(appconfig.get('projectpath'), 'db', 'hist.db'),
    active: 1
  };
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

async function createUnit(doc, info) {
  const unit = {
    id: doc._id,
    doc, // Сохранить как есть все что пришло из документа (параметры БД?)
    ps: '',
    dbagent: 1,
    dbname: doc._id,

    getModulepath() {
      return path.join(appconfig.get('agentspath'), this.dbname, 'dbagent.js'); // Путь к модулю для запуска
    },

    getProp(prop) {
      return this.doc[prop] || '';
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

    setInfo(infobj) {
      this.info = hut.clone(infobj);
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

  try {
    await wu.installNodeModulesP(path.join(appconfig.get('agentspath'), unit.id));
  } catch (e) {
    console.log('ERROR: Npm install error: ' + util.inspect(e));
  }

  if (info) unit.setInfo(info);

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
  prepareDocAfterInstall,
  invalidateCache
};
