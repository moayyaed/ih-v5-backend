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

/*
{
	"patname":"daylightsensor",
	"patnote":{
			"ru":"Переключение дискретной освещенности по аналоговому значению.",
			"en":"Switching discrete illumination on analog value"
	},
	
	"comment":{
		"ru":"Используется для переключения Темно-Светло виртуального датчика в PLC по значению с аналогового датчика освещенности 1Wire.<br> Темно=1",
		
		"en":""
	},

	"param":{
			"ASENSOR":{"note":{"ru":"Датчик освещенности аналоговый","en":"Analogue daylight sensor"},"type":"250"},
			"DSENSOR":{"note":{"ru":"Датчик освещенности дискретный","en":"Discrete daylight sensor"},"type":"150"}},
	"maindev":"#ASENSOR#",
	"scenname":"#ASENSOR#",
	
	"userparam":[
		{"prop":"timegap", "defval":30, "type":"time", 
			"note":{
				"ru":"Время переключения в состояние СВЕТЛО (исключение засветки)", 
				"en":"Time"
			}	
		}
  ],		
  
	"start":{
		"event":"#ASENSOR#,#DSENSOR#",
		"if":"(#DSENSOR#.dval!=1)&&(#ASENSOR#.aval<#ASENSOR#.defval) || (#DSENSOR#.dval==1)&&(#ASENSOR#.aval>#ASENSOR#.defval)"
	},

	"listen":[{"event":"#ASENSOR#",  "call":"aexec"}
	],		  
	
	"timers":[
			 {"name":"T1","interval":"#ASENSOR#.timegap", "call":"stop"}
	], 
	
	"functions":{	 
		"start":[{"if":"(#ASENSOR#.aval<#ASENSOR#.defval)","exec":{"sendu":"#DSENSOR#.toggle:1","exit":1}}
				,{"if":"(#ASENSOR#.aval>#ASENSOR#.defval)","exec":{"timer":"T1.start"}}
				],
				
		"stop":{"if":"(#ASENSOR#.aval>#ASENSOR#.defval)", "exec":{"sendu":"#DSENSOR#.toggle:2"}
				},
				
		"aexec":[{"if":"(#ASENSOR#.aval<#ASENSOR#.defval)", "exec":{"exit":1}}
				]
	}			
}
*/

function createSceneFromScenepat(item, lang) {
  item.multi = true;
  const sc = new Scripter(item);
  if (item.param) {
    Object.keys(item.param).forEach(dn => {
      const note = getNameProp(item.param[dn].note, lang);
      sc.addDevpat(dn, { cl: getCl(item.param[dn].type), note });
    });
  }

  if (item.start && item.start.event) {
    item.start.event = clearHash(item.start.event);
    if (item.start.if) item.start.if = clearHash(item.start.if);
    sc.formStartOnChange(item.start);
  }

  // Добавить слушателей, может быть несколько устройств

  if (item.stop && item.stop.event) {
    item.stop.event = clearHash(item.stop.event);
    if (item.stop.if) item.stop.if = clearHash(item.stop.if);
    const devArr = sc.getDevFromEvent(item.stop.event);
    const cond = sc.formConditionFromIf(item.stop.if);
    devArr.forEach(dn => {
      sc.addListener(dn, 'start');
      sc.formListenHandler(dn, cond, 'stop'); // Формировать функцию listen, туда включить ф-ю stop
    });
  }

  // 	"timers":[{"name":"T1","interval":"#LAMP#.tidv","note":"Время без движения", "call":"stop"}] 
  if (item.timers && Array.isArray(item.timers)) {
    item.timers.forEach(timerItem => {
      sc.timers.set(timerItem.name, timerItem);
    });
  }

  /*
  if (item.timeout) {
    // Формировать таймер???
  }
*/
  if (item.functions) {
    Object.keys(item.functions).forEach(funcName => {
      let lines;
      if (!Array.isArray(item.functions[funcName])) {
        lines = [item.functions[funcName]];
      } else lines = item.functions[funcName];

      lines.forEach(lineObj => {
        processFunctionPat(lineObj, funcName, sc);
      });
    });
  }

  return sc.build();
}

function processFunctionPat(fitem, funcName, sc) {
  let ifBlock = false;
  if (fitem.if) {
    ifBlock = true;
    let cond = sc.formConditionFromIf(clearHash(fitem.if));
    sc.addScriptStr('    if (' + cond + ') {\n', funcName);
  }

  if (fitem.exec) {
    // "exec":{"timer":"T1.start"}
    if (fitem.exec.timer) sc.processTimer(fitem.exec.timer, funcName);

    if (fitem.exec.email) sc.createInfo('email', clearHash(fitem.exec.email), funcName);
    if (fitem.exec.sms) sc.createInfo('sms', clearHash(fitem.exec.sms), funcName);
    if (fitem.exec.wri) sc.createLog(clearHash(fitem.exec.wri), funcName);
    
    if (fitem.exec.do) sc.processDo(clearHash(fitem.exec.do), funcName);
  }
  if (ifBlock) {
    sc.addScriptStr('    }\n', funcName);
  }
}

function clearHash(str) {
  return str.replace(/#/g, '');
}

function getNameProp(val, lang) {
  return typeof val == 'object' ? val[lang] : val;
}

function getCl(typeStr) {
  const typeId = typeStr.split(',').shift();
  if (typeId < 200) return 'SensorD';
  if (typeId < 300) return 'SensorA';
  if (typeId < 600) return 'ActorD';
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
        sc.formListenHandler(dn, cond, 'stop'); // Формировать функцию listen, туда включить ф-ю stop
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
        processFunction(lineObj, funcName, sc);
      });
    });
  }

  return sc.build();
}

// "exec":{"wri":"Фаза 1. Выход напряжения за границы: <ELU1.aval> Вольт"}
function processFunction(fitem, funcName, sc) {
  let ifBlock = false;
  if (fitem.if) {
    ifBlock = true;
    let cond = sc.formConditionFromIf(fitem.if);
    sc.addScriptStr('    if (' + cond + ') {\n', funcName);
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
  createSceneFromScenebase,
  createSceneFromScenepat
};
