/**
 *  Объект для создания скрипта сценария
 *  Принимает данные по частям, затем строит скрипт командой build
 */

// const util = require('util');

// const hut = require('../lib/utils/hut');

class Scripter {
  constructor(item) {
    this.item = item;
    this.devs = new Set();
    this.startOnChange = '';
    this.funcs = new Map();
    this.timerIds = new Set();
    this.devpat = new Map();
    this.timers = new Map();
    this.multi = item.multi;
  }

  addDevpat(dn, {cl, note}) {
    this.devpat.set(dn, {cl, note});
  }

  getNewTimerName() {
    let tname = 'T1';
    let n = 1;
    while (this.timerIds.has(tname)) {
      n++;
      tname = 'T' + String(n);
    }
    return tname;
  }

  processDo(doStr, funName) {
    if (!doStr) return;

    const arr = splitDo(doStr);
    arr.forEach(astr => {
      funName = this.processOneDo(astr, funName);
    });
  }

  // {"timer":"T1.start"}
  processTimer(timerStr, funName) {
    if (!timerStr) return;
    const [timer, oper] =  timerStr.split('.');
    if (oper == 'start') {
      const timerObj = this.timers.get(timer);
      // {"name":"T1","interval":"#LAMP#.tidv","note":"Время без движения до отключения", "call":"stop"}
      if (timerObj) {
        this.startTimer(timer, timerObj.interval, timerObj.call, funName);
      }
    } else this.stopTimer(timer, funName);
  }

  processOneDo(astr, funName) {
    let dn = '';
    let str = '';

    if (astr && astr.indexOf('.') > 0) {
      const parts = astr.split('.');

      let xdn = parts[0];
      if (xdn == 'ALL') {
        str = underComment(astr, 'ПОКА НЕ РЕАЛИЗОВАНО!!');
      } else if (xdn == 'DELAY') {
        // Стартовать таймер, все остальное будет после таймера
        const timerHandle = this.startNewTimer(parts[1], funName);
        // this.addScriptStr(str, funName); // this.startTimer('T1', 10, "onTimer_T1")
        funName = timerHandle; // funName = "onTimer_T1" Все остальное д б внутри onTimer_T1
      } else if (parts.length == 2) {
        if (astr && parts[1].indexOf(':') > 0) {
          // присваивание свойства
          const prop = parts[1].split(':');
          if (prop.length == 2) {
            dn = xdn;
            str = '     ' + dn + '.set("' + prop[0] + '",' + prop[1] + '); \n';
          } else {
            str = underComment(astr, 'НЕ РАСПОЗНАНО!!');
          }
        } else {
          // команда
          dn = xdn;
          str = '     ' + astr + '(); \n';
        }
      } else {
        str = underComment(astr, 'НЕ РАСПОЗНАНО!!');
      }
    }
    if (dn) this.devs.add(dn);
    if (str) this.addScriptStr(str, funName);
    return funName;
  }

  addScriptStr(str, funName) {
    if (!this.funcs.has(funName)) {
      this.funcs.set(funName, str);
    } else {
      this.funcs.set(funName, this.funcs.get(funName) + str);
    }
  }

  startNewTimer(interval, funName) {
    const timer = this.getNewTimerName();
    this.timerIds.add(timer);
    const timerHandler = 'onTimer' + timer;
    // const str = '     this.startTimer("' + timer + '",' + interval + ',"' + timerHandler + '");\n'; // this.startTimer("T1", 1, "onTimer");
    // this.addScriptStr(str, funName);
    this.startTimer(timer, interval, timerHandler, funName);
    return timerHandler;
  }



  startTimer(timer, interval, timerHandler, funName) {
    const str = '     this.startTimer("' + timer + '",' + interval + ',"' + timerHandler + '");\n'; // this.startTimer("T1", 1, "onTimer");
    this.addScriptStr(str, funName);
  }

  stopTimer(timer, funName) {
    const str = '     this.stopTimer("' + timer + '");\n'; // this.stopTimer("T1");
    this.addScriptStr(str, funName);
  }

  //  this.info("email","diomidov",`Внимание!\n`);
  createInfo(type, astr, funName) {
    let dn = '';

    const arr = astr.split('#');
    let rec = arr[0];
    let txt = processMessageWithDevice(arr[1]);
    let str = '     this.info("' + type + '","' + rec + '",`' + txt + '`);\n';

    if (dn) this.devs.add(dn);
    if (str) this.addScriptStr(str, funName);

    // return { dn: '', str: '     this.info("' + type + '","' + rec + '",`' + txt + '`);\n' };
  }

  createLog(astr, funName) {
    // TODO Но внутри м б ссылка на устройство или несколько устройств!!
    // "день <METER1.aval> ночь <METER1.aval2>"
    let dn = '';

    let txt = astr;
    let str = '     this.log(`' + txt + '`);\n';

    if (dn) this.devs.add(dn);
    if (str) this.addScriptStr(str, funName);

    // return { dn: '', str: '     this.log(`' + txt + '`);\n' };
  }

  buildFun(funName) {
    let str = '';
    str += '  ' + funName + '() {\n';
    str += this.funcs.get(funName);
    str += '  }';
    return str;
  }

  buildScript() {
    let str = '';
    str += 'script({\n';
    str += this.buildFun('start');

    if (this.funcs.size > 1) {
      const farr = Array.from(this.funcs.keys()).filter(fname => fname != 'start');
      farr.forEach(fname => {
        str += ',\n\n';
        str += this.buildFun(fname);
      });
    }
    str += '\n';
    str += '});\n';
    return str;
  }

  buildDevs() {
    let str = '';
    if (this.multi) {
      for (let [dn, value] of this.devpat) {
        str += 'const ' + dn + ' = Device("' + value.cl +'","' +value.note+'"); \n';
      }
    } else {
      for (let dn of this.devs) {
        str += 'const ' + dn + ' = Device("' + dn + '"); \n';
      }
    }
    return str;
  }

  build() {
    let { name, description } = this.item;
    name = name || this.item.id;

    let str = scriptComment({ name, description });
    str += this.buildDevs();
    str += this.startOnChange; // Готовая строка
    str += this.buildScript();
    return str;
  }

  formStartOnChange(itemStart) {
    // Вариант, когда скрипт в JSON
    if (itemStart) {
      // {"event":"ELU1", "if":"(ELU1.aval < SETTING_ELE.minVoltage) || (ELU1.aval > SETTING_ELE.maxVoltage)"
      if (itemStart.event) {
        const devArr = this.getDevFromEvent(itemStart.event);
        const cond = this.formConditionFromIf(itemStart.if);

        const devStr = devArr.length > 1 ? '[' + devArr.join(',') + ']' : devArr[0];
        this.startOnChange = 'startOnChange(' + devStr + (cond ? ',' + cond : '') + '); \n';
      }
      return;
    }

    if (this.item.dn) {
      const dn = this.item.dn;
      this.devs.add(dn);
      this.startOnChange = 'startOnChange(' + dn + ',' + this.formStartCondition() + '); \n';
    }
  }

  // TODO - заменить dval, aval на value в условии
  formConditionFromIf(ifStr) {
    return ifStr || '';
  }

  getDevFromEvent(eventItem) {
    if (!eventItem) return [];

    // м б через запятую!!
    const devArr = eventItem.split(',').filter(dn => dn); // Убрать пустые?

    devArr.forEach(dn => {
      this.devs.add(dn);
    });
    return devArr;
  }

  formStartCondition() {
    // Блокировку нужно учитывать только для датчиков??
    // Условие входа, там м б ifcond по && и устройство задействованное  сценарии
    if (this.item.ifcond) {
    }

    return '(' + this.item.dn + '.value == ' + this.item.dnevent + ')&&(' + this.item.dn + '.blk == 0)';
  }

  addListener(dn, funName) {
    let str = '     this.addListener(' + dn + ',"' + getListenHandlerName(dn) + '");\n';
    this.addScriptStr(str, funName);
  }

  formListenHandler(dn, condition, next) {
    const funName = getListenHandlerName(dn);
    let str = '     if ' + condition + ' this.' + next + '();\n';
    this.addScriptStr(str, funName);
  }
}

function splitDo(doStr) {
  if (doStr.indexOf('#') >= 0) return doStr.split('#');
  if (doStr.indexOf(',') >= 0) return doStr.split(',');
  return [doStr];
}

function scriptComment({ name, description }) {
  let str = '/** \n';
  str += '* @name ' + name + ' \n';
  str += '* @desc ' + (description || '') + ' \n';
  str += '* @version 4 \n';
  str += '*/\n';
  return str;
}

function underComment(astr, comment) {
  return '     // ' + comment + ' \n     // ' + astr + ' \n';
}

function getListenHandlerName(dn) {
  return 'listen' + dn;
}

function processMessageWithDevice(mes) {
  let res = mes;
  const regexp = /(<[^>]*)/;
  let found = true;
  while (found) {
    const arr = regexp.exec(res);
    if (arr && arr[0]) {
      const ss = arr[0]; // <Meter1.aval - без последней >

      res = res.replace(ss + '>', '${' + ss.substr(1) + '}');
    } else found = false;
  }
  return res;
}
module.exports = Scripter;
