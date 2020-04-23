/**
 * sceneserver.js
 * Сервер сценариев
 */

const dm = require('../datamanager');
const Sceneengine = require('./sceneengine'); 
const Scenemate = require('./scenemate'); 

module.exports = async function (holder) {
  const engine = new Sceneengine(holder);
  const mate = new Scenemate(engine, dm);

  engine.start(await mate.start());

  /**
   * Agent
   */
  /*
  const agent =  {
    log (sceneId, txt) {
      if (sceneSet[sceneId] && txt) {
        debugMsg(sceneId, 'log: ' + txt);
        houser.emit('writelog', 'userlog', { txt });
      }
    },

    syslog (sceneId, txt) {
      if (sceneSet[sceneId] && txt) {
        debugMsg(sceneId, 'syslog: ' + txt);
        houser.emit('writelog', 'syslog', { txt });
      }
    }
/*
    this.execOS = function(sceneId, txt, responseid) {
      if (sceneSet[sceneId] && txt) {
        debugMsg(sceneId, 'execOS: ' + txt);
        child.exec(txt, (error, stdout, stderr) => {
          if (error) {
            debugMsg(sceneId, `execOS error: ${error}`);
          }
          debugMsg(sceneId, `stdout: ${stdout}`);
          if (stderr) debugMsg(sceneId, `stderr: ${stderr}`);

          if (responseid && sceneSet[sceneId].responsefn[responseid]) {
            tryExec(sceneId, sceneSet[sceneId].responsefn[responseid], stdout);
            tryStopAfterResponse(sceneId, responseid);
          }
        });
      }
    };

    this.info = function(sceneId, infotype, dest, txt) {
      if (sceneSet[sceneId] && infotype && txt) {
        let sobj;
        if (typeof txt == 'object') {
          sobj = Object.assign({ dest }, txt);
        } else {
          sobj = { txt, dest };
        }

        debugMsg(sceneId, 'info ' + infotype + ': ' + util.inspect(sobj));
        commander.sendInfo(infotype, sobj, houser);
      }
    };

    this.doCommand = function(sceneId, dobj, command, value) {
      debugMsg(sceneId, 'do ' + dobj.dn + ' ' + command + ' ' + (value != undefined ? value : ''));

      // Если запускается команда aon (aoff) - установить флаг и изменить команду
      if (command == 'aon') {
        command = dobj.runA = 'on';
      }
      if (command == 'aoff') {
        command = dobj.runA = 'off';
      }

      // Могут передать команду или свойство
      let cmdobj = { dn: dobj.dn, stval: dobj.stval, value };
      if (dobj.hasAct(command)) {
        cmdobj.act = command;
      } else if (dobj[command] != undefined) {
        cmdobj.prop = command;
      } else {
        debugMsg(sceneId, 'Not found act or prop ' + command);
      }
      const sender = Object.assign({ scene: sceneId }, sceneSet[sceneId].sender);
      commander.doCommands(cmdobj, sender, houser);
    };

    this.doAll = function(sceneId, filter, command, value) {
      debugMsg(sceneId, 'doAll ' + util.inspect(filter) + ' ' + command + ' ' + (value != undefined ? value : ''));
      commander.doAll(filter, command, value, { scene: sceneId }, houser);
    };

    this.assign = function(sceneId, dobj, prop, value) {
      debugMsg(sceneId, 'assign ' + dobj.dn + '.' + prop + '=' + value);
      if (dobj.dobj) {
        dobj = dobj.dobj;
      }
      prop = dobj.getRealPropName(prop);

      // Прямое присваивание без передачи на железо и без проверок
      commander.assign({ dobj, prop, value }, { scene: sceneId }, houser);
    };

    this.plugincCommand = function(sceneId, comobj, responseid) {
      debugMsg(sceneId, 'plugincCommand ' + util.inspect(comobj));
      if (responseid) comobj.uuid = responseid;

      houser.emit('plugincommand', comobj, (err, playload) => {
        if (err) debugMsg(sceneId, 'Error: ' + util.inspect(err));

        if (responseid && sceneSet[sceneId].responsefn[responseid]) {
          tryExec(sceneId, sceneSet[sceneId].responsefn[responseid], playload);
          tryStopAfterResponse(sceneId, responseid);
        }
      });
    };

    this.startTimer = function(sceneId, timername, interval) {
      // Интервальный таймер
      if (interval < 200000) {
        debugMsg(sceneId, 'start timer ' + timername + ' for ' + interval + ' sek');
        return tm.startTimer(interval, { owner: sceneId, tname: timername });
      }

      // Таймер на точку времени (ts)
      const txt = hut.getDateTimeFor(new Date(interval), 'shortdtms') + ' (' + interval + ')';
      debugMsg(sceneId, 'start timer ' + timername + ' on time = ' + txt);
      return sctm.addTimer({ qts: interval, owner: sceneId, tname: timername });
    };

    this.stopTimer = function(sceneId, timername, interval) {
      debugMsg(sceneId, 'stop timer ' + timername);

      if (interval < Date.now()) {
        // Интервальный таймер
        tm.deleteTimer(interval, { owner: sceneId, tname: timername });
      } else {
        sctm.deleteTimer({ owner: sceneId, tname: timername });
      }
    };

    this.getSysTime = function(sceneId, name, date) {
      const result = systime.getSysTime(name, date);
      const txt = hut.getDateTimeFor(new Date(result), 'shortdtms') + ' (' + result + ')';
      debugMsg(sceneId, 'getSysTime ' + name + ' ' + date + ' = ' + txt);
      return result;
    };

    this.dbwrite = function(sceneId, payload, table, columns) {
      debugMsg(sceneId, 'dbwrite: table:' + table + ' payload:' + JSON.stringify(payload));

      if (!payload || typeof payload != 'object') {
        debugMsg(sceneId, 'dbwrite ' + table + ' error: Expected payload - array or object');
        return;
      }

      if (!util.isArray(payload)) payload = [payload];

      // Если пишем в дополнительные таблицы - проверить, м б новая переменная - и добавить ее varSet

      if (table) {
        payload.forEach(item => {
          if (item.dn) {
            houser.addVarSetItem(table, item.dn);
          }
        });
      }

      let addObj = { fun: 'add', table, payload, id: Date.now() };
      if (columns) {
        debugMsg(sceneId, 'columns: ' + JSON.stringify(columns));
        addObj.columns = columns;
      }

      houser.emit('dbwrite', addObj, err => {
        if (err) {
          debugMsg(sceneId, 'dbwrite ' + table + ' error: ' + util.inspect(err));
          console.log('ERR: scene ' + sceneId + ' dbwrite error=' + util.inspect(err));
        }
      });
    };

    this.snap = function(sceneId, fobj, responseid) {
      let onsnap;
      if (responseid && sceneSet[sceneId].responsefn && sceneSet[sceneId].responsefn[responseid]) {
        onsnap = sceneSet[sceneId].responsefn[responseid];
      }
      debugMsg(sceneId, 'snap:' + JSON.stringify(fobj));

      if (!fobj || !onsnap) {
        debugMsg(sceneId, 'snap: Empty or invalid arguments!');
        tryStopAfterResponse(sceneId, responseid);
        return;
      }

      let comobj = { unit: 'cctv', uuid: 'snap_' + responseid, command: 'snap', id: fobj, camid: fobj };

      debugMsg(sceneId, 'plugincommand ' + JSON.stringify(comobj));
      houser.emit('plugincommand', comobj, (e, result) => {
        debugMsg(sceneId, 'plugincommand result ' + JSON.stringify(result));
        if (sceneSet[sceneId].isActive() && sceneSet[sceneId].responsefn && sceneSet[sceneId].responsefn[responseid]) {
          tryExec(sceneId, sceneSet[sceneId].responsefn[responseid], result);
          tryStopAfterResponse(sceneId, responseid);
        }
      });
    };

    this.dbread = function(sceneId, fobj, responseid) {
      let ondbread;
      if (responseid && sceneSet[sceneId].responsefn && sceneSet[sceneId].responsefn[responseid]) {
        ondbread = sceneSet[sceneId].responsefn[responseid];
      }
      debugMsg(sceneId, 'dbread:' + JSON.stringify(fobj));

      if (!fobj || typeof fobj != 'object' || !ondbread) {
        debugMsg(sceneId, 'dbread: Empty or invalid arguments!');
        tryStop();
        return;
      }

      let readobj = processArg();
      readobj.id = responseid;
      debugMsg(sceneId, 'dbread: readobj ' + JSON.stringify(readobj));
      houser.emit('dbread', readobj, (e, result) => {
        if (sceneSet[sceneId].isActive() && sceneSet[sceneId].responsefn && sceneSet[sceneId].responsefn[responseid]) {
          tryExec(sceneId, sceneSet[sceneId].responsefn[responseid], result);
          tryStop();
        }
      });

      function tryStop() {
        delete sceneSet[sceneId].responsefn[responseid];
        if (!sceneSet[sceneId].isPending()) {
          fixStop(sceneId);
        }
      }

      function processArg() {
        let result;
        processTimePoint('start');
        processTimePoint('end');
        let dbtable = getDbtable('table') || getDbtable('dbtable');

        result = { fun: 'get', filter: fobj };
        if (dbtable) {
          result.dbtable = dbtable;
        }
        return result;

        function getDbtable(tname) {
          let res;
          if (fobj[tname]) {
            res = fobj[tname];
            delete fobj[tname];
          }
          return res;
        }

        function processTimePoint(point) {
          if (fobj[point]) {
            try {
              if (typeof fobj[point] == 'string') {
                fobj[point] = new Date(fobj[point]).getTime();
              }
              if (fobj[point] < 946684800000) throw { message: 'Invalid timestamp ' + fobj[point] }; // '2000-01-01'
            } catch (e) {
              fobj[point] = 'ERROR: ' + point + ' ' + e.message;
            }
          }
        }
      }
    };

    this.isChanged = function(sceneId, dobj, prop, value) {
      let res = false;
      let debstr = 'isChanged';

      if (dobj) {
        // if (!prop) prop = dobj.dobj.getMainProp();
        if (dobj.dobj) {
          dobj = dobj.dobj;
        }
        prop = dobj.getRealPropName(prop);

        debstr += '(' + dobj.dn + ',' + prop + (value != undefined ? ',' + value : '') + ')=';

        if (typeof sceneSet[sceneId].chobj == 'object') {
          res = !!(sceneSet[sceneId].chobj[dobj.dn] && sceneSet[sceneId].chobj[dobj.dn][prop] != undefined);

          if (res && value != undefined) {
            res = sceneSet[sceneId].chobj[dobj.dn][prop] == value;
          }

          debstr += res + ' Changed: ' + JSON.stringify(sceneSet[sceneId].chobj);
        } else debstr += 'false';
      } else {
        debstr += 'isChanged target device not defined! Expected "this.isChanged(device)"';
      }
      debugMsg(sceneId, debstr);
      return res;
    };

    this.sceneExit = function(sceneId) {
      debugMsg(sceneId, 'exit');
      this.emit('sceneExit', sceneId);
    };
    
  }
*/
};
