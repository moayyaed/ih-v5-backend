/**
 *
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const tut = require('./transfer_utils');

const hut = require('../lib/utils/hut');

const Scripter = require('./scripter');

/** 
const lineRec = {
  num: 3,
  name: 'Перезагрузка роутеров',
  group: 2,
  img: '3041.png', // Не беру
  pwneed: 1, // Не беру ??
  order: 3, // Не беру
  exec: {
    do: '#RESET_3G.on#RESET_SL100.on'
  },
  lastedit: '01.09.2018 14:49:28' // Не беру??
};

const sceneRec = {
  _id: 'line3',
  status: '1',
  name: 'Перезагрузка роутеров',
  parent: 'sg2', // Здесь нужно group - sg2
  version: '4',
  multi: 0
};
*/

function createLineScene(item) {
  const sc = new Scripter(item);
  if (item.exec) {
    
    if (item.exec.email) sc.createInfo('email', item.exec.email, 'start');
    if (item.exec.sms) sc.createInfo('sms', item.exec.sms, 'start');
    if (item.exec.wri) sc.createLog(item.exec.wri, 'start');

    if (item.exec.do) sc.processDo(item.exec.do, 'start'); // DO в конце, т к может содержать DELAY

  }
  return sc.build();
}

/*

const onscenBody = {"scenname": "onDW0_1",
    "maindev": "",
    "note": "Протечка в подполе",
    "start": {
        "event": "DW0",
        "if": "(DW0.dval == 1)&&(DW0.blk == 0)"
    },
    "stop": {
        "event": "DW0",
        "if": "(!((DW0.dval == 1)&&(DW0.blk == 0)))"
    },
    "timers": {
        "name": "T1",
        "interval": "180",
        "note": "Start timer",
        "call": "ontimer"
    },
    "listen": {
        "event": "DW0",
        "call": "onlisten"
    },
    "timeout": {
        "interval": "180",
        "if": "(TIMER.T1.q)"
    },
    "functions": {
        "start": {
            "exec": {
                "timer": "T1.start"
            }
        },
        "ontimer": {
            "exec": {
                "do": "",
                "ale": "Дача / Подпол. Протечка воды!",
                "sms": "OWNER#Дача / Подпол. Протечка воды!"
            }
        },
        "onlisten": {
            "if": "(!((DW0.dval == 1)&&(DW0.blk == 0)))&&(TIMER.T1.in)",
            "exec": {
                "exit": 1
            }
        }
    }
}
*/
/*
const onscenRec ={
  "id": "onDW0_1",
  "dn": "DW0",
  "name": "Протечка в подполе",
  "dnevent": 1,
  "timeout": "180",
  "starttimer": "180",
  "startcond1": 1,
  "startcond2": 0,
  "ifcond": "",
  "exec": { "do": "", "ale": "Дача / Подпол. Протечка воды!", "sms": "OWNER#Дача / Подпол. Протечка воды!" }
};
*/

function createOnScene(item) {
  const sc = new Scripter(item);
  sc.formStartOnChange();

  if (item.startcond1 || item.startcond2) {
    // TODO Будет условный выход, иначе сразу выходим, функция только start
  }

  if (item.exec) {
   
    if (item.exec.email) sc.createInfo('email', item.exec.email, 'start');
    if (item.exec.sms) sc.createInfo('sms', item.exec.sms, 'start');
    if (item.exec.wri) sc.createLog(item.exec.wri, 'start');
    if (item.exec.do) sc.processDo(item.exec.do, 'start');
  }

  return sc.build();
}

/** 
{"scenname":"ELE_U1",
"comment":"",
"note":"Выход напряжения за границы. Фаза 1.",
"start":{
  "event":"ELU1", 
  "if":"(ELU1.aval < SETTING_ELE.minVoltage) || (ELU1.aval > SETTING_ELE.maxVoltage)"
},
"stop" :{
  "event":"ELU1", 
  "if":"(ELU1.aval >= SETTING_ELE.minVoltage) && (ELU1.aval <= SETTING_ELE.maxVoltage)"
},

"timeout":60,
"functions":{		
  "start":{"exec":{"wri":"Фаза 1. Выход напряжения за границы: <ELU1.aval> Вольт"}},
  "stop": {"exec":{"wri":"Фаза 1. Напряжение OK"}}
}	
}
*/

function createSceneFromScenebase(item) {
  const sc = new Scripter(item);
  sc.formStartOnChange(item.start);

  if (item.stop) {
    // Добавить слушателей, может быть несколько устройств

    if (item.stop.event) {
      const devArr = sc.getDevFromEvent(item.stop.event);
      const cond = sc.formConditionFromIf(item.stop.if);
      devArr.forEach(dn => {
        sc.addListener(dn, 'start');
        sc.formListenHandler(dn, cond,'stop' ); // Формировать функцию listen, туда включить ф-ю stop
      });
    }
  }

  if (item.timeout) {
    // Формировать таймер???
  }

  if (item.functions) {
    Object.keys(item.functions).forEach(funcName => {
      let lines;
      if (!Array.isArray(item.functions[funcName])) {
        lines = [item.functions[funcName]];
      } else lines = item.functions[funcName];

      lines.forEach(lineObj => {
        processFunction(lineObj, funcName);
      });
    });
  }



  return sc.build();

  // "exec":{"wri":"Фаза 1. Выход напряжения за границы: <ELU1.aval> Вольт"}
  function processFunction(fitem, funcName) {
    let ifBlock = false;
    if (fitem.if) {
      ifBlock = true;
      let cond = sc.formConditionFromIf(fitem.if);
      sc.addScriptStr('    if ('+cond+') {\n', funcName);
    }
    
    if (fitem.exec) {
      
      if (fitem.exec.email) sc.createInfo('email', fitem.exec.email, funcName);
      if (fitem.exec.sms) sc.createInfo('sms', fitem.exec.sms, funcName);
      if (fitem.exec.wri) sc.createLog(fitem.exec.wri, funcName);
      if (fitem.exec.do) sc.processDo(fitem.exec.do, funcName);
    }
    if (ifBlock) {
      sc.addScriptStr('    }\n', funcName);
    }
  }
}

function formStartCondition(item) {
  // Блокировку нужно учитывать только для датчиков??
  return '(' + item.dn + '.value == ' + item.dnevent + ')&&(' + item.dn + '.blk == 0)';
}

function formStopCondition(item) {
  // Блокировку нужно учитывать только для датчиков??
  // return '('+item.dn+'.value == '+item.dnevent+')&&('+item.dn+'.blk == 0)';
}

function addListener(dn) {
  return '     this.addListener(' + dn + ',"' + getListenHandlerName(dn) + '");\n';
}

function getListenHandlerName(dn) {
  return 'listen' + dn;
}

function listenHandler(item) {
  let str = '      ,' + getListenHandlerName(item.dn) + '(){\n';
  str += '        if(!' + formStartCondition(item) + ') this.exit();\n';
  str += '      }\n';
  return str;
}

module.exports = {
  createLineScene,
  createOnScene,
  createSceneFromScenebase
};
