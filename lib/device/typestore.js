/**
 * Объект для работы с типами устройств
 *  Структуры:
 *    typeMap - актуальные данные о типах
 *
 *  Использование:
 *   1. Создает объект устройства заданного типа (новое устройство)
 *   2. Возвращает свойства устройства по типу при оперативной работе
 *   3. Хранит функции свойств для типа - onRead, onCalculate, в том числе, дефолтные
 *
 */
// const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const dnpref = require('./dnpref'); // Объект для работы с префиксами устройств
const typeutil = require('./typeutil');

// Сформировать typeMap из таблицы types, плоские свойства в item, props => proparr

// Объект из Map напрямую будет использоваться в  devo  typeItem = {item, props, proparr, calc}
// item - содержит описательную часть {_id, name, tags,...}
// props - объект всех свойств прямо из таблицы,
//           из него будут браться typeItem.props[prop].vtype (op)
//           Сюда же зацепить функции (req  | default) для свойства:  typeItem.props[prop].readhandler
// proparr - массив свойств-значений устройства, содержит значения по умолчанию: min,max,def,dig
//           Нужно перестраивать при изменении таблицы types
// commands - массив свойств-команд устройства, просто массив строк
//           Нужно перестраивать при изменении таблицы types
//
// calc - список свойств типа calc - ['state']

const typeMap = new Map();

module.exports = {
  DEFAULT_TYPE: 't100',

  start(typeDocs, deviceDocs, dm) {
    this.dm = dm;

    typeMap.clear();
    typeDocs.forEach(item => this.add(item));
    deviceDocs.forEach(item => dnpref.updateDnPref(item.dn));

    // Слушать события изменения таблиц, связанных с устройствами и типами
    // device - интересует только dn устройства - для актуализации префикса
    dm.on('updated:device', docs => {
      docs.forEach(doc => {
        if (doc.$set && doc.$set.dn) dnpref.updateDnPref(doc.$set.dn);
      });
    });

    dm.on('removed:device', docs => {
      docs.forEach(doc => {
        if (doc.dn) dnpref.deleteDnPref(doc.dn);
      });
    });

    // type
    dm.on('inserted:type', docs => {
      docs.forEach(doc => this.add(doc));
    });

    dm.on('updated:type', docs => {
      docs.forEach(doc => this.onUpdateTypeDoc(doc));
    });

    dm.on('removed:type', docs => {
      docs.forEach(doc => this.delete(doc._id));
    });
  },

  add(typeDoc) {
    if (!typeDoc || !typeDoc._id) return;

    const typeId = typeDoc._id;
    typeMap.set(typeDoc._id, { item: {}, props: {}, proparr: [], calc: [] });

    const typeItem = typeMap.get(typeId);
    Object.keys(typeDoc).forEach(docProp => {
      if (docProp != 'props') {
        // Плоские свойства
        typeItem.item[docProp] = typeDoc[docProp];
      } else {
        this.updateProps(typeId, typeDoc.props);
      }
    });
  },

  // Устройство получает ссылку на объект типа и работает с ним
  getTypeObj(typeId) {
    if (!typeMap.has(typeId)) typeId = this.DEFAULT_TYPE;
    return typeMap.get(typeId);
  },

  showHandlers(typeId) {
    return typeMap.has(typeId) ? typeutil.getShowHandlersStr(typeMap.get(typeId).props) : '';
  },

  async onUpdateTypeDoc(doc) {
    // Изменен тип (типы). Изменение каждого типа - отдельно
    // Вариант 1. Изменились плоские свойства (не props) - в этом случае только меняем внутри item
    // Вариант 2. Изменились props свойства в таблице -  тогда
    //    2.1 Изменились свойства op, type, <min,max>, onread, onwrite - просто перестроить typeItem (полностью?)
    //        devo возьмет изменения по ссылке
    //    2.2 Добавили/удалили свойства - нужно менять все устройства этого типа => changed:typeprops
    //    2.3 Изменилось имя свойства!!?? - нужно менять все устройства этого типа => changed:typeprops
    const typeId = doc._id;

    let flat;
    let $set;
    let $unset;
    let propNeedUpdate = false;

    // unset - здесь только удаление строк
    if (doc.$unset) {
      propNeedUpdate = true;
      $unset = { ...doc.$unset };
    }

    if (doc.$set) {
      Object.keys(doc.$set).forEach(field => {
        if (field.startsWith('props.')) {
          propNeedUpdate = true;

          // брать все свойства, если это новое поле
          const propname = field.substr(6).split('.')[0];
          if (propname && !this.hasProp(typeId, propname)) {
            if (!$set) $set = {};
            $set[field] = doc.$set[field];
          }
        } else {
          if (!flat) flat = {};
          flat[field] = doc.$set[field];
        }
      });
    }

    // Если изменилось название типа, префикс - изменить item в typestore
    if (flat) this.updateItem(doc._id, flat);

    // Если изменились свойства в табличке - изменить props, proparr - полностью из таблицы
    if (propNeedUpdate) {
      const docType = await this.dm.dbstore.get('types', { _id: typeId }, {});
      if (!docType)
        throw { err: 'SOFTERR', message: 'Not found type ' + typeId + ' in types collection after update!' };

      const newprops = docType[0].props;
      this.updateProps(typeId, newprops);
    }

    // Если добавили/удалили свойства - генерировать событие для изменения полей устройств
    if ($set || $unset) {
      const suObj = {};
      if ($set) suObj.$set = $set;
      if ($unset) suObj.$unset = $unset;
      if (doc.$renamed) suObj.$renamed = doc.$renamed;
      this.dm.emit('changed:typeprops', typeId, suObj);
    }
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

    const typeItem = typeMap.get(typeId);

    // Объект props содержит описание свойств - его полностью берем
    typeItem.props = hut.clone(newprops);

    typeItem.proparr = []; // cвойства-значения
    typeItem.commands = []; // cвойства-команды
    typeItem.calc = [];

    // Подцепить функции для каждого свойства внутрь props

    Object.keys(typeItem.props).forEach(prop => {
      const p = typeItem.props[prop];

      if (p.command) {
        typeItem.commands.push(prop);

        if (p.oncommand) {
          const filename = appconfig.getHandlerFilenameIfExists(p.oncommand);
          if (filename) p.commandfun = require(filename);
        }
        if (!p.commandfun) p.commandfun = typeutil.getDefaultCommandFun(p.vtype, p.op, prop);
        
      } else {
        typeItem.proparr.push(typeutil.getProparrAux(prop, p));

        if (p.onread) {
          const filename = appconfig.getHandlerFilenameIfExists(p.onread);
          if (filename) p.readfun = require(filename);
        }
        if (!p.readfun) p.readfun = typeutil.getDefaultReadFun(p.vtype, p.op);

        if (p.onwrite) {
          const filename = appconfig.getHandlerFilenameIfExists(p.onwrite);
          if (filename) p.writefun = require(filename);
        }

        if (p.vtype == 'c') typeItem.calc.push(prop); // Сохранить имя свойства для полей calculate
      }
    });
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

  getPropNameArray(type) {
    return type && typeMap.has(type) ? typeMap.get(type).proparr.map(item => item.prop) : [];
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

  hasProp(typeId, propname) {
    return typeMap.has(typeId) && typeMap.get(typeId).props && typeMap.get(typeId).props[propname];
  },

  // Генерирует объект props для заданного типа устройства
  createPropsFromType(typeId) {
    const props = {};
    if (typeMap.has(typeId)) {
      const arr = typeMap.get(typeId).proparr;
      arr.forEach(propItem => {
        props[propItem.prop] = Object.assign(
          { db: propItem.db || 0 },
          typeutil.getProparrAux(propItem.prop, propItem.prop)
        );
      });
    }
    return props;
  },

  // Генерирует новый dn для заданного типа устройства
  createDnFromType(typeId) {
    let pref = 'DN';
    if (typeMap.has(typeId)) {
      const typeItem = typeMap.get(typeId);
      if (typeItem.item.ruledn_pref) pref = typeItem.item.ruledn_pref;
    }
    return dnpref.getNewDn(pref);
  },

  createDeviceDoc(doc, type) {
    type = type || this.DEFAULT_TYPE;
    doc.type = type;
    doc.props = this.createPropsFromType(type);
    doc.dn = this.createDnFromType(type);
    doc.name = this.getNameFromType(type);
    doc.tags = this.getTagsFromType(type);
    return doc;
  },

  getNewDnAsCopy(dn) {
    return dnpref.getNewDnAsCopy(dn);
  }
};
