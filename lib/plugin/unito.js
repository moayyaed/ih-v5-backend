/**
 * unito.js
 */

// const util = require('util');
const hut = require('../utils/hut');

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
          if (this.ps && this.ps.connected) this.ps.send(message);
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

  updateChannels(charr) {
    this.charr = charr;
    this.formReadWriteMap(charr);
  }


  /**
   * По описанию каналов формировать Maps для операций чтения и записи
   * Эта структура используется для маппинга канал <-> свойство устройства
   * Здесь нас интересуют только привязанные к устройствам каналы
   *     @param {Array of object} links - список всех связок каналов плагина с устройствами
   *
   * */
  formReadWriteMap(links) {
    this.readMap = new Map();
    this.writeMap = new Map();

    if (!links || !Array.isArray(links)) return;

    links.forEach(item => {
      if (item.did && item.prop) {
        //  Если op отсутствует или R, RW - читаем
        if (!item.op || (item.op && item.op.substr(0, 1) == 'R')) {
          if (item.calc) {
            item.calcfn = new Function('value', 'return ' + item.calc);
          }
          this.readMap.set(item.chan, item);
        }

        if (item.op && item.op.indexOf('W') >= 0) {
          if (item.prop == 'set' && item.calc_out) {
            item.calc_outfn = new Function('value', 'return ' + item.calc_out);
          }
          this.writeMap.set(item.dn + '.' + item.prop, item);
        }
      }
    });
  }

  /**
   * Чтение данных каналов
   *  - сохранить сырое значение с канала - независимо от привязки
   *  - прогнать через маппинг, если есть привязка к устройству
   *     - если есть обработка - обработать (если есть привязка?)
   *     - вернуть значение относительно устройства
   *     - может быть также ext - расширенные свойства???
   *
   * @param {Array}  [{id: id_канала, value:плоское значение, ext:{battery:3300, power:1}, ts},..]
   * @return {Object} {DD1:{value:1, battery:3300, power:1, ts}}
   *
   */
  readData(data) {
    if (!data || !Array.isArray(data)) return;
    let robj = {};

    const now = Date.now();

    data.forEach(item => {
      let id = this.smart ? item.dn : item.id; // smart плагин присылает dn??

      // Сохранить сырое значение с канала
      this.channels[id] = { value: item.value, ts: item.ts || now };

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

  /**
   * Сохранить сырое значение с канала
   * @param {Array}
   */
  saveRawChannelsValue(data) {
    if (!data || !Array.isArray(data)) return;

    const now = Date.now();
    data.forEach(item => {
      if (item.id) {
        if (!this.channels[item.id]) this.channels[item.id] = { _raw: {} }; // ???
        this.channels[item.id]._raw = { value: item.value, ts: item.ts || now };
      }
    });
  }
}

module.exports = Unito;
