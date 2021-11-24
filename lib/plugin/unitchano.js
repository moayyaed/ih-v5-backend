/**
 *  Объект для работы с каналами плагина
 *
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

class Unitchano {
  constructor(doc, charr = [], { smart, action_props }) {
    this.id = doc._id;
    this.channels = {};
    this.charr = charr; // Массив каналов из devhard
    this.smart = smart; // Модель каналов - включает папки, использует dn вместо id канала
    this.action_props = action_props;

    this.readMap = new Map();
    this.writeMap = new Map();
    this.formReadWriteMap();
  }

  /** formReadWriteMap
   * По описанию каналов формировать Maps для операций чтения и записи
   * Эта структура используется для маппинга канал <-> свойство устройства
   * Здесь нас интересуют только привязанные к устройствам каналы
   *
   *     @param {Array of object} links - список всех связок каналов плагина с устройствами
   *
   */
  /*
  formReadWriteMap(links) {
    if (!links || !Array.isArray(links)) return;

    links.forEach(item => {
      if (item.did && item.prop) {
        //  Если канал для чтения - читаем?
        if (item.r || (!item.r && !item.w)) {
          if (item.calc) item.calcfn = this.makeFun(item.calc, item.chan);
          this.readMap.set(item.chan, item);
        }

        if (item.w) {
          if (item.calc_out) item.calc_outfn = this.makeFun(item.calc_out, item.chan);
          this.writeMap.set(item.did + '.' + item.prop, item);
        }
      }
    });
  }
  */

 getChannels() {
    return this.smart
      ? this.getChannelsForSmart()
      : this.charr.filter(item => !item.folder && item.r).map(item => Object.assign({}, item, { id: item.chan }));
  }

  getChannelsForSmart() {
    if (!this.charr) return [];
    // parent должен быть обязательно перед child!!
    // console.log('getChannelsForSmart START this.charr='+util.inspect(this.charr));
    const res = [];
    this.charr
      .filter(item => item.r || item.w)
      .forEach(item => {
        const { _id, unit, folder, parent, did, prop, order, title, chan, usescript, ...robj } = item;
        if (usescript) {
          // формировать имя файла
          robj.scriptfile = appconfig.getChannelscriptFilepath(this.id, _id);
        }

        if (folder) {
          res.unshift({ id: _id, ...robj });
        } else {
          res.push({ ...robj, parentid: parent, dn: chan, id: chan });
        }
      });
    return res;
  }

  formReadWriteMap() {
    if (!this.charr) return;

    this.charr.forEach(item => {
      //  для чтения
      // if (item.r || (!item.r && !item.w && !item.folder)) {
      if (item.r) {
        item.r = 1;
        if (item.calc) item.calcfn = this.makeFun(item.calc, item.chan);
        this.readMap.set(item.chan, item);
      } 
      // else item.r = 0;

      if (item.w) {
        if (item.calc_out) item.calc_outfn = this.makeFun(item.calc_out, item.chan);
        this.writeMap.set(item.chan, item);
      }
    });
  }

  getWriteObj(chan, value, testValue) {
    const item = this.writeMap.get(chan);
    if (!item) {
      console.log('WARN: Not found channel ' + chan + ' for unit ' + this.id);
      return;
    }

    if (item.calc_outfn) {
      try {
        value = item.calc_outfn(value);
      } catch (e) {
        console.log(
          'ERROR: write channel ' + chan + ', value=' + value + ' ' + item.calc_out + ': ' + hut.getShortErrStr(e)
        );
      }
    }
    if (value != undefined) item.value = value;

    if (this.smart) {
      // return {dn:item.chan, prop: item.prop || item.act || 'set', val:value};
      return { id: item.chan, dn: item.chan, prop: item.act || 'set', val: value };
    }

  
   
    const {_id, calc, calc_out, title, parent, unit, ...wObj} = item;

    wObj.id = item.chan;

    if (wObj.pubtopic) {
      wObj.topic = wObj.pubtopic;
    }

    if (wObj.pubmessage) {
      if (testValue) {
        wObj.pubmessage = testValue;
      }
      wObj.message = wObj.pubmessage;
    }
    return wObj;
  }

  updateChannels(charr) {
    this.charr = charr;
    this.formReadWriteMap();
  }

  findChannelByRecordId(id) {
    for (const item of this.charr) {
      if (item._id == id) {
        return item;
      }
    }
  }

  getRtChannel(chan) {
    return this.channels[chan];
  }

  /** readData
   * Чтение данных каналов
   *  - сохранить сырое значение с канала - независимо от привязки
   *  - прогнать через маппинг, если есть привязка к устройству
   *     - если есть обработка - обработать (если есть привязка?)
   *     - вернуть значение относительно устройства
   *
   * @param {Array}  [{id: id_канала, value:плоское значение, ext:{battery:3300, power:1}, ts},..]
   * @return {Object} {DD1:{value:1, battery:3300, power:1, ts}}
   *
   */
  readData(data) {
    if (!data || !Array.isArray(data)) return;
    let robj;

    const now = Date.now();

    data.forEach(item => {
      // let id = this.smart ? item.dn : item.id; // smart плагин присылает dn??
      let id = item.id;
      if (this.smart && item.dn) {
        id = item.dn;
      }
      // Сохранить сырое значение с канала
      this.channels[id] = { val: item.value, ts: item.ts || now };

      if (item.value != undefined && this.readMap.has(id) && this.readMap.get(id).did) {
        let linkobj = this.readMap.get(id);
        if (!robj) robj = {};
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
      }
    });

    return robj;

    function calcValue(fn, value) {
      try {
        return fn(value);
      } catch (e) {
        console.log('ERROR: calc error:' + e.message);
        return value;
      }
    }
  }

  makeFun(calc, chan) {
    try {
      return new Function('value', 'return ' + calc);
    } catch (e) {
      console.log('ERROR: Unit ' + this.id + ',  channel ' + chan + ', ' + calc + '. ' + hut.getShortErrStr(e));
      return '';
    }
  }
}

module.exports = Unitchano;
