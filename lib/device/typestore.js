/**
 * Хранилище типов для работы с устройствами
 *  Структуры:
 *    typeMap - все типы, включаются все данные (как в таблице)
 *    dnPrefIds - объект префиксов для построения dn устройств
 *
 *  Использование:
 *   1. Создает объект устройства заданного типа (новое устройство)
 *   2. Генерирует новый dn по префиксу типа
 *   3. Генерирует новый dn при копировании
 *   4. Возвращает атрибуты типа (название, тэги) при оперативной работе
 *   5. Возвращает свойств устройств данного типа при оперативной работе
 *   6. ?? Хранит функции свойств для типа - onRead, onCalculate, в том числе, дефолтные?
 *
 */
// const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

// Сформировать typeMap из таблицы types, плоские свойства в item, props => proparr
// {_id:тип, name, tags, props:{value:{vtype, op, min, max,...}}}
//   => key=_id {item:{_id, name, tags,...}, proparr:[{prop:"value", min, max,...}, ],  props:{value:{vtype, op, min, max,...}}}
// Объект из map напрямую будет использоваться в  devo  typeItem = {item, props, proparr, calc}
// item - содержит описательную часть {_id, name, tags,...}
// props - объект полей прямо из таблицы, из него будут браться typeItem.props[prop].vtype (op)
//         Сюда же зацепить функции (req  | default) для свойства:  typeItem.props[prop].readhandler
// proparr - массив для построения свойств устройства, содержит значения по умолчанию: min,max,def,dig
//           Нужно перестраивать при изменении таблицы types
// calc - просто список свойств типа calc - ['state']
const typeMap = new Map();

// Префиксы для именования [pref]:{len, numid}. Заполняются из таблицы devices
const dnPrefIds = {}; // [pref]:{len, numid}

const DEFAULT_TYPE = 't100';

module.exports = {
  start(typeDocs, deviceDocs, dm) {
    typeMap.clear();
    typeDocs.forEach(item => this.add(item));
    deviceDocs.forEach(item => this.updateDnPref(item.dn));

    // Слушать события изменения таблиц, связанных с устройствами и типами
    // device - интересует только dn устройства - для актуализации префикса
    dm.on('updated:device', docs => {
      docs.forEach(doc => {
        if (doc.$set && doc.$set.dn) this.updateDnPref(doc.$set.dn);
      });
    });

    dm.on('removed:device', docs => {
      docs.forEach(doc => {
        if (doc.dn) this.deleteDnPref(doc.dn);
      });
    });

    // type
    dm.on('inserted:type', docs => {
      docs.forEach(doc => this.add(doc));
    });

    dm.on('updated:type', docs => {
      // console.log('updated:type '+util.inspect(docs))
      // Изменен тип (типы)

      //  Возможно, нужно менять все устройства этого типа??
      docs.forEach(doc => {
        // Если изменилось название, префикс - изменить typestore и typeList?
        if (doc.$set && (doc.$set.name || doc.$set.ruledn_pref)) {
          this.updateItem(doc._id, doc.$set);
        }
        // Если изменились табличные данные (props) - то нужно менять устройства в таблице devices
        // - при добавлении свойства - добавить
        // - при удалении - удалить
        // - при изменении имени свойства - ??!!!
        // - при изменении типа и операции - с устройствами не делать ничего? Берется всегда из typestore
      });
    });

    dm.on('removed:type', docs => {
      docs.forEach(doc => this.delete(doc._id));
    });
  },

  add(typeDoc) {
    if (!typeDoc || !typeDoc._id) return;

    const res = { item: {} };
    Object.keys(typeDoc).forEach(docProp => {
      if (docProp != 'props') {
        // Плоские свойства
        res.item[docProp] = typeDoc[docProp];
      } else {
        // Объект props содержит описание свойств - его полностью берем
        res.props = hut.clone(typeDoc.props);

        // Добавляем новые атрибуты
        // res.proparr = hut.objectToArray(typeDoc.props, 'prop');
        res.proparr = [];
        res.calc = [];

        Object.keys(res.props).forEach(prop => {
          const p = res.props[prop];

          // Сохранить изменяемые устройством свойства в proparr
          res.proparr.push(getProparrItem(prop, p));

          // Подцепить функции для каждого свойства
          if (p.onread) {
            p.readfun = require(appconfig.getHandlerFilename(p.onread));
          } else {
            p.readfun = getDefaultReadFun(p.vtype, p.op);
          }
          if (p.onwrite) {
            p.writefun = require(appconfig.getHandlerFilename(p.onwrite));
          }
          if (p.vtype == 'c') res.calc.push(prop); // Сохранить имя свойства для полей calculate
        });
      }
    });
    typeMap.set(typeDoc._id, res);
  },

  // Устройство получает ссылку на объект типа и работает с ним
  getTypeObj(typeId) {
    if (!typeMap.has(typeId)) typeId = DEFAULT_TYPE;
    return typeMap.get(typeId); 
  },

  showHandlers(typeId) {
    if (!typeMap.has(typeId)) return '';
    let str = '/**  В этом окне функции показаны только для просмотра.\n';
    str += '*    Функция onRead срабатывает при получении данных\n';
    str += '*    Для замены Default обработки для свойства выберите другую функцию в графе При получении значения\n';
    str += '*    Изменить функцию или создать новую  можно в разделе Функции-обработчики\n';
    str += '* \n';
    str += '*    При необходимости можно задать функцию onWrite, которая запускается при отправке данных\n';
    str += '*/\n\n';
    typeMap.get(typeId).proparr.forEach(prop => {
      if (prop.readfun) {
        const module = prop.onread || 'Default';
        str += '/** on Read: ' + prop.prop + ',  module: ' + module + ' **/\n' + prop.readfun.toString() + '\n\n';
      }
    });
    return str;
  },

  // Изменение плоских свойств
  updateItem(typeId, newitem) {
    if (!typeMap.has(typeId)) return;
    // {item: {_id, name, ruledn_pref}, proparr:[{ prop: 'value', name: 'Значение', vtype: 'B', op: 'r' },]
    const curItem = typeMap.get(typeId).item;
    Object.assign(curItem, newitem);
  },

  // Изменение props!!
  updateProps(typeId, newprops) {
    if (!typeMap.has(typeId)) return;
    // TODO
  },

  delete(typeId) {
    typeMap.delete(typeId);
  },

  clearAll() {
    typeMap.clear();
  },

  // Получение типа в целом, а также значений отдельных атрибутов и свойств
  getItem(typeId) {
    return typeMap.has(typeId) ? typeMap.get(typeId).item : '';
  },

  getPropArray(type) {
    return type && typeMap.has(type) ? typeMap.get(type).proparr : [];
  },

  getNameFromType(typeId) {
    return typeMap.has(typeId) ? typeMap.get(typeId).item.name : '';
  },

  getTagsFromType(typeId) {
    let result = [];
    if (typeMap.has(typeId) && typeMap.get(typeId).item.tags) {
      result = [...typeMap.get(typeId).item.tags];
    }
    return result;
  },

  // Генерирует объект props для заданного типа устройства
  createPropsFromType(typeId) {
    const props = {};
    if (typeMap.has(typeId)) {
      const arr = typeMap.get(typeId).proparr;
      arr.forEach(propItem => {
        props[propItem.prop] = { db: propItem.db || 0 };
        if (propItem.vtype == 'N') {
          props[propItem.prop].min = propItem.min || null;
          props[propItem.prop].max = propItem.max || null;
          props[propItem.prop].dig = propItem.dig || 0;
        }
      });
    }
    return props;
  },

  // Генерирует новый dn для заданного типа устройства
  createDnFromType(typeId) {
    let pref = 'DN';
    if (typeMap.has(typeId)) {
      const typeItem = typeMap.get(typeId);
      if (typeItem.ruledn_pref) pref = typeItem.ruledn_pref;
    }
    return this.getNewDn(pref);
  },

  createDeviceDoc(doc, type) {
    type = type || DEFAULT_TYPE;
    doc.type = type;

    doc.props = this.createPropsFromType(type);
    doc.dn = this.createDnFromType(type);
    doc.name = this.getNameFromType(type);
    doc.tags = this.getTagsFromType(type);
    return doc;
  },

  // Для генерации dn на основании префиксов
  // В каждом dn выделяем префикс, для одинаковых префиксов - сохранить мах значение мах длины
  getNewDn(pref) {
    if (!pref) return '';

    if (!dnPrefIds[pref]) {
      dnPrefIds[pref] = { len: 3, numid: 0 };
    }
    const rule = dnPrefIds[pref];
    rule.numid += 1;
    return pref + String(rule.numid).padStart(rule.len, '0');
  },

  getNewDnAsCopy(dn) {
    if (dn) {
      let pref = dn;
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        pref = dn.substr(0, marr.index);
      }
      return this.getNewDn(pref);
    }
    return '';
  },

  // Функции при изменении данных
  // Может присвоиться пользователем - нужно обновлять
  updateDnPref(dn) {
    if (dn) {
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        const pref = dn.substr(0, marr.index);
        const dig = marr[0];
        if (!dnPrefIds[pref]) {
          dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
        } else if (dnPrefIds[pref].len < dig.length) {
          dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
        } else if (dnPrefIds[pref].len == dig.length) {
          if (Number(dig) > dnPrefIds[pref].numid) {
            dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
          }
        }
      }
    }
  },

  deleteDnPref(dn) {
    if (dn) {
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        const pref = dn.substr(0, marr.index);
        const dig = marr[0];

        if (dnPrefIds[pref]) {
          if (dig.length >= dnPrefIds[pref].len && Number(dig) == dnPrefIds[pref].numid) {
            dnPrefIds[pref].numid -= 1;
          }
        }
      }
    }
  }
};

function getDefaultReadFun(vtype, op) {
  if (op == 'w') return ''; // Чтения нет

  if (op == 'c') {
    // calculate
    return function(device) {
      return device.value ? 1 : 0;
    };
  }
  if (vtype == 'N') {
    return function(device, prop, value) {
      if (isNaN(value)) return { error: 'Not a number: ' + value };
      const newvalue = device.getRounded(prop, value);
      return device.inRange(prop, newvalue) ? newvalue : { error: 'Out of range!', value: newvalue };
    };
  }

  if (vtype == 'B') {
    return function(device, prop, value) {
      // Expected only true/false or 1/0
      if (isNaN(value)) return { error: 'Not a boolean: ' + value };
      value = Number(value);
      return value == 0 || value == 1 ? value : { error: 'Out of range:' + value };
    };
  }

  if (vtype == 'S') {
    return function(device, prop, value) {
      return typeof value == 'object' ? JSON.stringify(value) : String(value);
    };
  }
}

function getProparrItem(prop, propItem) {
  const res = { prop };
  switch (propItem.vtype) {
    case 'N':
      res.min = propItem.min || null;
      res.max = propItem.max || null;
      res.dig = propItem.dig || 0;
      res.def = propItem.def || 0;
      break;
    case 'S':
      res.def = propItem.def || '';
      break;
    case 'B':
      res.def = propItem.def || 0;
      break;
    default:
  }
  return res;
}
