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
const dbreporter = require('../dbreporter');
const pluginutil = require('../plugin/pluginutil');

const ROOT = 'dbagentgroup';

function createNewDoc(doc, dbagent) {
  // Получить свойства-параметры и дефолтные значения для этого агента из формы formDbagentCommon
  const defObj = pluginutil.getDefaultPropsFromForm(appconfig.getV5FormPath(dbagent, 'formDbagentCommon'));

  return { ...doc, _id: dbagent, name: dbagent, parent: ROOT, ...defObj };
}

async function prepareDocAfterInstall({ id, version }, holder) {
  const doc = await holder.dm.findRecordById('dbagent', id);
  if (doc) {
    refreshIndicatorsVersion();
  } else {
    return createNewDoc({ order: 100 }, id);
  }

  // return doc ? '' : createNewDoc({ order: 100 }, dbagent);

  function refreshIndicatorsVersion() {
    // обновить системные индикаторы
    const devs = Object.keys(holder.unitSet)
      .filter(unit => holder.unitSet[unit].dbagent && holder.unitSet[unit].dbname == id)
      .map(unit => holder.unitSet[unit].dn);

    if (devs.length) {
      const res = {};
      devs.forEach(dn => {
        res[dn] = { version };
      });
      holder.emit('received:device:data', res);
    }
  }
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

function getDbFolder() {
  return path.join(appconfig.get('projectpath'), 'db');
}
function getDbPath(folder) {
  return path.join(folder || getDbFolder(), 'hist.db');
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
    sys: 1,
    doc, // Сохранить как есть все что пришло из документа (параметры БД?)
    ps: '',
    dbagent: 1,
    dbname: doc._id,
    connector: dbconnector,

    getModulepath() {
      return path.join(appconfig.get('agentspath'), this.dbname, 'dbagent.js'); // Путь к модулю для запуска
    },

    getProp(prop) {
      return this.doc[prop] || '';
    },

    getArgs() {
      const defProps = pluginutil.getDefaultPropsFromForm(appconfig.getV5FormPath(this.dbname, 'formDbagentCommon'));
      // Формировать аргументы командной строки
      const options = {
        database: this.doc.database,
        logfile: appconfig.get('logpath') + '/ih_' + this.dbname + '.log',
        loglevel: this.doc.loglevel || 0
      };

      // Сформировать путь с учетом alone
      if (this.doc.alone) {
        options.dbPath = getDbPath(this.doc.alonePath);
      } else {
        options.dbPath = getDbPath();
      }

      Object.keys(defProps).forEach(propName => {
        options[propName] = this.doc[propName] != undefined ? this.doc[propName] : defProps[propName];
      });

      return [JSON.stringify(options)];
    },

    setDoc(newDoc) {
      this.doc = hut.clone(newDoc);
    },

    setInfo(infobj) {
      this.info = hut.clone(infobj);
    },

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

async function createReportmakerUnit(doc, info) {
  const name = 'reportmaker';
  const unit = {
    id: name,
    sys: 1,
    ps: '',
    doc:{restarttime: 3},
    connector: dbreporter,

    getModulepath() {
      return path.join(appconfig.get('pluginspath'), name, 'index.js'); // Путь к модулю для запуска
    },

    getProp(prop) {
      return this.doc[prop] || '';
    },

    getArgs() {
      const options = {
        logfile: appconfig.get('logpath') + '/ih_' + this.id + '.log',
        loglevel: 0
      };
      return [JSON.stringify(options)];
    },

    setDoc(newDoc) {
      this.doc = hut.clone(newDoc);
    },

    setInfo(infobj) {
      this.info = hut.clone(infobj);
    },

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

async function customValidate({ prop, doc, _id }, dm) {
  let res;
  let noempty = 'Не задан путь к БД!';
  if (prop == 'alonePath') {
    // Изменили путь к БД - это возможно только при уст галке alone
    if (doc.alonePath) {
      // doc.dbPath = doc[prop] + '/hist.db';
    } else res = noempty;
  } else if (prop == 'alone') {
    if (!doc[prop]) {
      // сброс галки
      doc.alonePath = '';
      doc.dbPath = getDbFolder();
    } else if (!doc.alonePath) {
      // Установка галки - должен быть путь
      // Если не меняли - путь не придет
      const rec = await dm.findRecordById('dbagent', _id);
      if (!rec.alonePath) res = noempty;
    }
  }
  return res;
}

module.exports = {
  getActiveUnitDoc,
  replaceActiveDbagent,
  createNewDoc,
  createUnit,
  createReportmakerUnit,
  prepareDocAfterInstall,
  invalidateCache,
  customValidate
};
