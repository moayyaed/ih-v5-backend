/**
 * dbadapter.js
 *  - Запускает dbagent как отдельный процесс
 *    ПОКА модули агентов размещаются в этом же директории - вложенные папки?
 *
 *  - Обеспечивает операции чтения-записи в БД: отрабатывает сообщения dbread, dbwrite  от других сервисов:
 *      on('dbread', param, callback) - ответ передается через callback
 *  - TODO!!! Для индикации состояния dbagent-а создает системное устройство DBAGENT и переключает его состояние
 *
 */

const util = require('util');
const child = require('child_process');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const moduleLogName = 'Dbadapter';

module.exports = async function(holder) {
 
  const responseobj = {};
  let dbagent;

  startDbagent();

  holder.on('dbread', (req, callback) => {
    sendReqToAgent(req, callback);
  });

  holder.on('dbwrite', (req, callback) => {
    sendReqToAgent(req, callback);
  });

  holder.on('stopchilds', () => {
    if (!dbagent) return;
    dbagent.kill('SIGTERM');
  });

  function sendReqToAgent(req, callback) {
    if (!req)  return;
    
    if (dbagent) {
      if (callback) {
        responseobj[req.id] = { req, callback };
      }
      dbagent.send(req);
    } else if (callback && typeof callback == 'function') {
      callback({ message: 'Dbagent not available!' });
    }
  }

  /** Запуск dbagent-а **/
  function startDbagent() {
    if (dbagent) return;

    try {
      const modulepath = appconfig.getDbagentModulePath();
      const dbOpt = appconfig.getDbagentOptions();

      if (!fs.existsSync(modulepath)) throw { message: 'File ' + modulepath + ' not found! ' };

      // запуск дочернего процесса
      dbagent = child.fork(modulepath, [JSON.stringify(dbOpt)]);

      if (dbagent) {
        dbagent.on('message', m => {
          if (typeof m == 'object') {
            processData(m);
          } else {
            processMessage(m);
          }
        });

        dbagent.on('close', code => {
          dbagent = '';
        });

        logMsg('Dbagent' + modulepath + ' has started', moduleLogName);
      }
    } catch (e) {
      logErr(e, 'Dbagent fork ERROR!', moduleLogName);
      // setDbagentError(199);
    }
  }

  /**
   *  Обработка сообщений от dbagent - данные получены, передать клиенту
   **/
  function processData(m) {
    let err;
    let callback;

    // Отправка данных по запросу
    if (m.id) {
      if (m.error) {
        err = 'err';
        if (typeof m.error == 'object') {
          err = m.error.code;
          logErr('', m.error.message || 'database error ' + err);
        }

        if (responseobj[m.id]) {
          callback = responseobj[m.id].callback;
          if (callback) callback(null, []);
        }
        return;
      }

      if (responseobj[m.id]) {
        if (responseobj[m.id].req.alias) {
          replaceByAlias(m.records, responseobj[m.id].req.alias);
        }

        callback = responseobj[m.id].callback;
        if (m.records) {
          if (callback) callback(null, m.records);
        } else if (callback) callback(null, []);

        delete responseobj[m.id];
      }
    } else if (m.type && m.type == 'sys') {
      // Сообщение от агента без запроса - системное
      if (m.type && m.dbtable && m.vars) {
        if (util.isArray(m.vars)) {
         // m.vars.forEach(item => holder.addVarSetItem(m.dbtable, item.dn));
        }
      }
    }
  }


  function replaceByAlias(rec, alias) {
    rec.forEach(item => {
      if (item.group && alias[item.group]) {
        item.group = alias[item.group];
      }
    });
  }

  /**
   *Обработка сообщений от агента об ошибках - просто пишем в лог
   **/
  function processMessage(m) {
    if (typeof m == 'string') {
      if (m.substr(0, 4) == 'log?') {
        logMsg(m.substr(4), 'DBAGENT');
      }
    }
  }

  function logMsg(mess, moduleName) {
    console.log(moduleName+': '+mess)
  }
  function logErr(e, mess, moduleName) {

    console.log(moduleName+': '+ (e ? e.message : '') + ' ' + mess);
  }
};

