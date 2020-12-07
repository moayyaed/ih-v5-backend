/**
 *
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const appconfig = require('../appconfig');
const dbconnector = require('../dbconnector');
const deviceutil = require('../device/deviceutil');

class Dbagentengine {
  constructor(holder, dm) {
    this.holder = holder;
    this.dm = dm;
    this.dbunit = ''; // Пока не подключен
  }

  start(dbagentDoc) {
    if (dbagentDoc === null) {
      this.log('В этом проекте база данных не используется', 2);
      return; // Это штатно - может и не быть??
    }

    console.log('INFO: Dbagent engine has started');

    this.addUnit(dbagentDoc);

    this.holder.on('start:dbagent', () => {
      this.runModule();
    });
    this.holder.on('stop:dbagent', () => {
      this.stopModule();
    });

    this.holder.on('finish', () => {
      this.sendSigterm();
    });
  }

  isModuleRunning() {
    return this.dbunit.ps;
  }

  /** Подключить модуль и запустить? */
  addUnit(dbagentDoc) {
    this.dbunit = dbagentDoc;
    this.dbname = dbagentDoc._id;
    this.log('Use database ' + this.dbname, 2);
    this.runModule();
  }

  removeUnit(dbagentDoc) {
    if (!dbagentDoc || dbagentDoc._id != this.dbname) return;
    this.stopModule();
  }

  /** Запустить модуль как дочерний процесс
   */
  runModule() {
    if (this.isModuleRunning()) return;

    try {
     
      // Запуск  dbagent-a
      const dbagent_path = path.join(appconfig.get('agentspath'), this.dbname, 'dbagent.js');
      if (!fs.existsSync(dbagent_path)) throw { message: 'File not found: ' + dbagent_path };

      
      
      // TODO Выбрать параметры для dbagent-а?
      const options = {
        database: this.dbunit.database,
        logfile: appconfig.get('logpath')+'/ih_'+this.dbname+'.log'
      };
      console.log('WARN: RUN MODULE '+dbagent_path+'argv:'+JSON.stringify(options));
      
      const ps = fork(dbagent_path, [JSON.stringify(options)]);
      this.dbunit.ps = ps;
      ps.on('close', code => {
        this.moduleOnClose(code);
      });
      dbconnector.init(ps); // dbconnector - объект для свзи с БД

      this.dbunit.laststart = Date.now();
      this.dbunit.laststop = 0;
      this.dbunit.error = '';
      this.setUnitState();
    } catch (e) {
      this.dbunit.error = util.inspect(e);
      this.setUnitState();
    }
  }

  // Создать системный индикатор плагина
  createUnitIndicator(unitId) {
    const dn = deviceutil.getUnitIndicatorId(unitId);
    this.holder.emit('create:unitIndicator', unitId);
    this.dbunit.dn = dn;
  }

  /**
   *  @param {*} code - код завершения
   */
  moduleOnClose(code) {
    if (!this.dbunit) return;

    if (this.dbunit.sigterm) {
      this.log('IH: Plugin exit after SIGTERM', 1);
      this.dbunit.sigterm = 0;
      this.dbunit.suspend = 1;
      this.dbunit.error = '';
    } else {
      this.log('IH: Plugin exit with code ' + code, 1);
      this.dbunit.error = 'Plugin exit with code ' + code;
      this.dbunit.suspend = 0;
    }

    this.dbunit.ps = 0;
    this.dbunit.laststop = Date.now();
    this.setUnitState();

    // Продумать перезапуск
    /*
    if (!this.unitSet[unitId].suspend && this.unitSet[unitId].restarttime > 0) {
    
      tm.startTimer(this.unitSet[unitId].restarttime, { owner: unitId, tname: 'restart' });
    }
    */
  }

  setUnitState() {
    let state = 1;
    if (this.dbunit.ps) {
      state = 2;
    } else if (!this.dbunit.active) {
      state = 0;
    } else if (this.dbunit.suspend) {
      state = 1;
    } else if (this.dbunit.error) {
      state = 3;
    }

    this.dbunit.state = state;
    // Установить значение в устройство - индикатор
    this.holder.emit('received:device:data', { [this.dbunit.dn]: { state } });
  }

  /** Остановить модуль
   */
  stopModule(callback) {
    this.sendSigterm();
    if (callback) callback();
  }

  sendSigterm() {
    if (this.dbunit.ps) {
      this.dbunit.ps.kill('SIGTERM');
      this.dbunit.ps = 0;
      this.dbunit.sigterm = 1;
      this.log('IH: Send SIGTERM.', 2);
    }
  }

  log(txt, level) {
    this.dm.insertToLog('pluginlog', { unit: 'db', txt, level });
  }
}

module.exports = Dbagentengine;
