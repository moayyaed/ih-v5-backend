/**
 * unito.js
 */

// const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

class Unito {
  constructor(doc, manifest) {
    this.id =  doc._id;
    this.manifest = manifest || {};
    this.setDoc(doc); // Сохранить как есть все что пришло из документа (параметры плагина)
    // this.doc = doc;
    this.ps =  0;
    this.subs =  new Map(); // Для подписок
    this.charr = '';
  }

  setDoc(doc) {
    this.doc = hut.clone(doc);
  }

  getModulepath() {
    return appconfig.getPluginModulePath(this.doc.plugin, this.doc.plugin + '.js');
  }

  getArgs() {
    // Формировать аргументы командной строки
    const options = {
      logfile: appconfig.get('logpath') + '/' + this.id + '.log'
    };
    return [JSON.stringify(options)];
  }

 

  send(sendObj) {
    if (this.ps) this.ps.send(sendObj);
  }

  sendSigterm() {
    if (this.ps) {
      this.ps.kill('SIGTERM');
      this.ps = 0;
      this.sigterm = 1;
    }
  }
};

/*
class Unito {
  constructor(uref) {
    if (!uref.plugin) throw { message: 'Required prop "plugin" is not defined! ' + JSON.stringify(uref) };

    hut.clone(uref, this); // Копировать плоские свойства?
    //  this.module = manifest.module ? manifest.module : this.plugin;
    this.module = this.plugin + '.js';
    this.id = uref._id;
    this.initOk = 0;
    this.channels = {}; // Хранит сырые  значения с каналов
    this.formReadWriteMap(uref.charr);

    // this.formTimeProps(uref.timeout, uref.restarttime);
    // this.formPropsDueToManifest(houser);
    if (!uref.addon) this.mapRebuild = 1;
    this.runMethod = hut.getFileExt(this.module) == 'js' ? 1 : 0; // 1-fork, 0-spawn

    this.runMethod = 1;

    switch (this.runMethod) {
      case 1: // fork - объекты через IPC
        this.send = function(message) {
          if (!message) return;
          if (this.ps && this.ps.connected) {
            this.ps.send(message);
            
          }
        };

        // this.readTele = message => message;
        this.formTele = message => message;
        break;

      default:
        // spawn - строки через stdin, stdout
        // Модуль м б не кроссплатформенный!!

        this.send = function(message) {
          if (!message) return;
          if (typeof message == 'object') message = JSON.stringify(message);
         
          // if (this.ps && this.ps.connected) this.ps.stdin.write(message + '\n');
          if (this.ps && this.ps.stdin) this.ps.stdin.write(message + '\n');
        };

        this.readTele = message => {
          // пришла строка - нужно пробовать сделать объект
          try {
            return JSON.parse(message);
          } catch (e) {
            return message;
          }
        };
        this.formTele = message => message;
    }
    // Если есть файл-адаптер - использовать
   //  this.adapt(houser);
  }

  sendSigterm() {
    this.ps.kill('SIGTERM');
    this.ps = 0;
    this.sigterm = 1;
  }

  updateChannels(charr) {
    this.charr = charr;
    this.formReadWriteMap(charr);
  }


 
  formReadWriteMap(links) {
    this.readMap = new Map();
    this.writeMap = new Map();

    if (!links || !Array.isArray(links)) return;

    links.forEach(item => {
      if (item.did && item.prop) {
        //  Если канал для чтения - читаем?
        if (item.r || !item.r&&!item.w) {
          if (item.calc) {
            item.calcfn = new Function('value', 'return ' + item.calc);
          }
          this.readMap.set(item.chan, item);
        }

        if (item.w) {
          if (item.calc_out) {
            item.calc_outfn = new Function('value', 'return ' + item.calc_out);
          }
          this.writeMap.set(item.did + '.' + item.prop, item);
        }
      }
    });
  }

  readData(data) {
    if (!data || !Array.isArray(data)) return;
    let robj = {};

    const now = Date.now();

    data.forEach(item => {
      let id = this.smart ? item.dn : item.id; // smart плагин присылает dn??

      // Сохранить сырое значение с канала
      this.channels[id] = { val: item.value, ts: item.ts || now };

      if (id && this.readMap.has(id) && item.value != undefined) {
        let linkobj = this.readMap.get(id);
        if (!robj[linkobj.did]) robj[linkobj.did] = {};

        // Преобразовать, если есть правила преобразования
        if (linkobj.inv && (item.value == 0 || item.value == 1)) {
          robj[linkobj.did][linkobj.prop] = item.value == 1 ? 0 : 1;
        } else {
          robj[linkobj.did][linkobj.prop] = linkobj.calcfn ? calcValue(linkobj.calcfn, item.value) : item.value;
        }

        if (item.ts) robj[linkobj.did].ts = item.ts;

        // TODO ???? ext props - все включаются, проверяются во время присвоения устройству???
        if (item.ext) {
          Object.keys(item.ext).forEach(extprop => {
            robj[linkobj.did][extprop] = item.ext[extprop];
          });
        }

        // }
      } 
    });

    return robj;

    function calcValue(fn, value) {
      try {
        return fn(value);
      } catch (e) {
        console.log('ERR: calc error:' + e.message);
        return value;
      }
    }
  }

  formMessage (toSend) {
    let data = [];
  
    // Сформировать команды с исп writeMap
    for (let i = 0; i < toSend.length; i++) {
      let res = this.formWriteProp(toSend[i]);
      if (res) data.push(res);
    }
    // Передать команды  плагину
    if (data.length > 0) return { type: 'act', data };
  }

  formWriteProp ({ did, prop, value, command }) {
    console.log('formWriteProp writeMap='+util.inspect(this.writeMap));
    if (command != 'set') prop = command;

    if (did && prop && this.writeMap.has(did + '.' + prop)) {
      let res;
      res = hut.clone(this.writeMap.get(did + '.' + prop));

      res.id = res.chan;
  
      if (res.command == undefined) {
        res.command = prop;
      }
  
      if (res.inv_out) {
        if (res.command == 'on') {
          res.command = 'off';
        } else if (res.command == 'off') res.command = 'on';
      }
  
      if (res.command == 'set' && res.calc_outfn) {
        value = res.calc_outfn(value);
      }
  
      if (value != undefined) {
        res.value = value;
      }
     
  
      // Удалить свойства, которые не нужны плагину
      const serverProps = ['inv', 'inv_out', 'calc', 'calc_out', 'complex', 'dn', 'unit', 'prop', 'op'];
      Object.keys(res).forEach(xprop => {
        if (serverProps.includes(xprop)) delete res[xprop];
      });
      console.log('formWriteProp res='+util.inspect(res));
      return res;
    }
  }
  
}
*/


module.exports = Unito;
