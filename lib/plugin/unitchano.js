/**
 *  Объект для работы с каналами плагина
 */

const util = require('util');

const hut = require('../utils/hut');

class Unitchano {
  constructor(doc, charr) {
    this.id = doc._id;
    this.channels = {};
    this.charr = charr;

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

  formReadWriteMap() {
    if (!this.charr) return;

    this.charr.forEach(item => {
      //  для чтения
      if (item.r || (!item.r && !item.w)) {
        if (item.calc) item.calcfn = this.makeFun(item.calc, item.chan);
        this.readMap.set(item.chan, item);
      }

      if (item.w) {
        if (item.calc_out) item.calc_outfn = this.makeFun(item.calc_out, item.chan);
        this.writeMap.set(item.chan, item);
      }
    });
  }

  getWriteObj(chan, value) {
    const item = this.writeMap.get(chan);
    if (!item) return;

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
    return item;
  }

  updateChannels(charr) {
    this.charr = charr;
    this.formReadWriteMap();
  }

  findChannelByRecordId(id) {
    for (const item of this.charr) {
      if (item._id == id) {
        console.log('FIND in charr ' + util.inspect(item));
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
