/**
 *  Объект для работы с каналами плагина
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const channelutil = require('./channelutil');

class Unitchano {
  constructor(doc, charr = [], { smart, innerId, action_props, share_node_folder_fields }) {
    this.id = doc._id; // id экземпляра плагина
    this.channels = {}; // Данные с каналов - realtime
    this.innerId = innerId; // 1=id канала - это _id записи, 0 - id канала - chan (доступно для изменения польз или плагином)

    this.smart = smart; // Модель каналов - включает папки, использует dn вместо id канала
    this.share_node_folder_fields = share_node_folder_fields; // Данные идут от папок (в зависимости от типа папки)
    this.action_props = action_props;

    this.readMap = new Map();
    this.writeMap = new Map();
    // this.charr = charr; // Массив каналов из devhard
    this.updateChannels(charr); // Присваивает this.charr, вызывает this.formReadWriteMap()
    // this.formReadWriteMap();
  }

  getChannels() {
    return this.smart ? this.getChannelsForSmart() : this.getChannelsCommon();
  }

  getChannelsCommon() {
    const res = this.charr
      .filter(item => !item.folder && item.r)
      .map(item => Object.assign({}, item, { id: item.chanId }));
    return res;
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
      if (item.r) {
        item.r = 1;
        if (item.calc) item.calcfn = this.makeFun(item.calc, item.chanId);
        this.readMap.set(item.chanId, item);
      }

      if (item.w) {
        if (item.calc_out) {
          item.calc_outfn = this.makeFun(item.calc_out, item.chanId);
        } else if (item.pubmessage) {
          item.calc_outfn = this.makeFun(item.pubmessage, item.chanId);
        }
        this.writeMap.set(item.chanId, item);
      }
    });
    // console.log('formReadWriteMap this.readMap='+util.inspect(this.readMap))
  }

  getWriteObj(chanId, value) {
    const item = this.writeMap.get(chanId);
    if (!item) {
      console.log('WARN: Not found channel ' + chanId + ' for unit ' + this.id);
      return;
    }

    // console.log('getWriteObj item='+item+' value='+item+' item.calc_outfn='+item.calc_outfn.toString())

    if (item.calc_outfn) {
      try {
        value = item.calc_outfn(value);
      } catch (e) {
        console.log(
          'ERROR: write channel ' + chanId + ', value=' + value + ' ' + item.calc_out + ': ' + hut.getShortErrStr(e)
        );
      }
    }
    if (value != undefined) item.value = value;

    if (this.smart) {
      return { id: item.chanId, dn: item.chan, prop: item.act || 'set', val: value };
    }

    const { _id, calc, calc_out, title, parent, unit, ...wObj } = item;
    wObj.id = item.chanId;
    /*
    if (wObj.pubtopic) {
      wObj.topic = wObj.pubtopic;
    }

    if (wObj.pubmessage) {
      if (testValue) {
        wObj.pubmessage = testValue;
      }
      wObj.message = wObj.pubmessage;
    }
    */
    return wObj;
  }

  // charr - массив записей из devhard, отфильтрованный по unit включая папки
  updateChannels(charr) {
    this.charr = charr;
    // Для каждого канала формировать chanId
    // Если innerId = 0  chanId = chan (редактируется пользователем или присылается плагином   т е как то формируется)
    // Если innerId = 1  chanId = _id (внутренний ид=р записи в таблице devhard)
    const idField = this.innerId ? '_id' : 'chan';
    this.charr.forEach(item => {
      if (!item.folder) item.chanId = item[idField];
    });

    if (this.charr && Array.isArray(this.share_node_folder_fields)) {
      // Добавить поля из parent узлов в каналы
      channelutil.addShareFields(this.charr, this.share_node_folder_fields);
    }
    this.formReadWriteMap();
  }

  findChannelByRecordId(id) {
    for (const item of this.charr) {
      if (item._id == id) return item;
    }
  }

  getRtChannel(chanId) {
    return this.channels[chanId];
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
      if (item.chstatus != undefined) this.channels[id].chstatus = item.chstatus;

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
        if (item.chstatus != undefined) robj[linkobj.did].chstatus = item.chstatus;

        // TODO ???? ext props - все включаются, проверяются во время присвоения устройству???
        if (item.ext) {
          Object.keys(item.ext).forEach(extprop => {
            robj[linkobj.did][extprop] = item.ext[extprop];
          });
        }
      }

      // console.log('readData this.channels='+util.inspect(this.channels))
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

  makeFun(calc, chanId) {
    
    try {
      if (calc && typeof calc == 'string') {
        if (calc.indexOf('value') < 0) {
          // Это не формула, а константная строка 
          // - вернуть в кавычках, если не число и пока кавычек нет
          if (isNaN(calc)) calc = wrapBorderQuotes(calc)
        }
      } 
      const fn = new Function('value', 'return ' + calc);
      return fn;

    } catch (e) {
      console.log('ERROR: Unit ' + this.id + ',  channel ' + chanId + ', ' + calc + '. ' + hut.getShortErrStr(e));
      return '';
    }
  }
}

function wrapBorderQuotes(str) {
  if (typeof str != 'string') return str;
  return str.startsWith('"') || str.startsWith("'") ? str : '"'+str+'"';
}

module.exports = Unitchano;
