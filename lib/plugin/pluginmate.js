/**
 * pluginmate.js
 *
 */
const util = require('util');
// const path = require('path');

const appconfig = require('../appconfig');

class Pluginmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async load() {
    const docs = await this.dm.dbstore.get('units');
    const result = [];
    for (const doc of docs) {
      if (!doc.folder && doc.plugin) {
        // Загрузить каналы, если есть ??
        const charr = await this.loadUnitChannels(doc._id);
        result.push({ ...doc, charr });
      }
    }
    return result;
  }

  async loadUnitChannels(unit) {
    return this.dm.dbstore.get('devhard', { unit }); // Массив каналов
  }

  async start() {
    this.engine.holder.on('debugctl', (mode, uuid) => {
      console.log('DD debugctl ' + uuid);
      if (uuid && uuid.startsWith('plugin_')) {
        this.engine.debugctl(mode, uuid.split('_').pop());
      }
    });

    this.dm.on('inserted:units', docs => {
      docs.forEach(doc => this.engine.addUnit(doc._id, doc));
    });

    this.dm.on('updated:units', docs => {
      docs.forEach(doc => {
        if (doc.$set) {
          const upDoc = Object.assign({}, doc, doc.$set);
          delete upDoc.$set;
          this.engine.updateUnit(doc._id, upDoc);
        }
      });
    });

    this.dm.on('removed:units', docs => {
      docs.forEach(doc => this.engine.removeUnit(doc._id, doc));
    });

    // ****** Изменение каналов
    // Форма канала + через link
    this.dm.on('inserted:devhard', async docs => {
      this.onChannelsChange(docs, 'add');
    });

    this.dm.on('updated:devhard', docs => {
      this.onChannelsChange(docs, 'update');
    });

    this.dm.on('removed:devhard', docs => {
      this.onChannelsChange(docs, 'delete');
    });

    // В таблице unitchannelsTable
    this.dm.on('inserted:unitchannelsTable', async docs => {
      this.onChannelsChange(docs, 'add');
    });

    this.dm.on('updated:unitchannelsTable', docs => {
      this.onChannelsChange(docs, 'update');
    });

    this.dm.on('removed:unitchannelsTable', docs => {
      this.onChannelsChange(docs, 'delete');
    });
    return this.load();
  }

  createUnit(doc) {
    const charr = doc.charr;

    const unit = {
      doc, // Сохранить как есть все что пришло из документа (параметры плагина)
      id: doc._id,
      ps: 0,
      subs: new Map(), // Для подписок
      charr,
      
      getModulepath() {
        return appconfig.getPluginModulePath(doc.plugin, doc.plugin + '.js');
      },

      getArgs() {
        // Формировать аргументы командной строки
        const options = {
          logfile: appconfig.get('logpath') + '/' + doc._id + '.log'
        };
        return [JSON.stringify(options)];
      },

      send(sendObj) {
        if (this.ps) this.ps.send(sendObj);
      },

      sendSigterm() {
        if (this.ps) {
          this.ps.kill('SIGTERM');
          this.ps = 0;
          this.sigterm = 1;
        }
      }
    };

    if (charr) {
      unit.channels = {};
      unit.charr = charr;
      unit.readMap = new Map();
      unit.writeMap = new Map();
      unit.formReadWriteMap = links => {
        if (!links || !Array.isArray(links)) return;

        links.forEach(item => {
          if (item.did && item.prop) {
            //  Если канал для чтения - читаем?
            if (item.r || (!item.r && !item.w)) {
              if (item.calc) {
                item.calcfn = new Function('value', 'return ' + item.calc);
              }
              unit.readMap.set(item.chan, item);
            }

            if (item.w) {
              if (item.calc_out) {
                item.calc_outfn = new Function('value', 'return ' + item.calc_out);
              }
              unit.writeMap.set(item.did + '.' + item.prop, item);
            }
          }
        });
      };

      unit.readData = data => {
        if (!data || !Array.isArray(data)) return;
        let robj = {};

        const now = Date.now();

        data.forEach(item => {
          let id = this.smart ? item.dn : item.id; // smart плагин присылает dn??
          console.log('WARN: readData ' + util.inspect(item) + ' readMap=' + util.inspect(unit.readMap));
          // Сохранить сырое значение с канала
          unit.channels[id] = { val: item.value, ts: item.ts || now };

          if (id && unit.readMap.has(id) && item.value != undefined) {
            let linkobj = unit.readMap.get(id);
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
            console.log('ERR: calc error:' + e.message);
            return value;
          }
        }
      };
      unit.formReadWriteMap(charr);
    }

    return unit;
  }

  async onChannelsChange(docs, op) {
    // - группировать по плагинам
    const docsByUnit = {};
    docs.forEach(doc => {
      const rdoc = { op, ...doc, ...doc.$set };
      delete rdoc.$set;

      if (doc.unit) {
        if (!docsByUnit[doc.unit]) docsByUnit[doc.unit] = [];
        docsByUnit[doc.unit].push(rdoc);
      }
    });

    for (const unit of Object.keys(docsByUnit)) {
      // Полностью считать каналы заново
      this.engine.unitChannelsUpdated(unit, docsByUnit[unit], await this.loadUnitChannels(unit));
    }
  }
}

module.exports = Pluginmate;
