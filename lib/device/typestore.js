/**
 * Объект для работы с типами устройств
 *  Структуры:
 *    typeMap - актуальные данные о типах
 *
 *  Использование:
 *   1. Создает объект устройства заданного типа (новое устройство)
 *   2. Возвращает свойства устройства по типу при оперативной работе
 *   3. Хранит функцию свойства, в том числе, дефолтные
 *
 */
const util = require('util');

const hut = require('../utils/hut');

const dnpref = require('./dnpref'); // Объект для работы с префиксами устройств
const handlerutils = require('./handlerutil');
const deviceutil = require('./deviceutil');
const defaulthandlers = require('./defaulthandlers');

// Сформировать typeMap из таблицы types, плоские свойства в item, props => proparr

// Объект из Map напрямую будет использоваться в  devo  typeItem = {item, props, proparr, calc}
// item - содержит описательную часть {_id, name, tags,...}
// props - объект всех свойств прямо из таблицы,
//           из него будут браться typeItem.props[prop].vtype (op)
//           Сюда же зацепить функции-обработчики (req  | default) для свойства:  typeItem.props[prop].readhandler
// proparr - массив свойств-значений устройства, содержит значения по умолчанию: min,max,def,dig
//           Нужно перестраивать при изменении таблицы types
// commands - массив свойств-команд устройства, просто массив строк
//           Нужно перестраивать при изменении таблицы types
// calc - список свойств типа calc - [{prop:'state', when:'1', trigger:'value'}]

const embeddedTypes = [
  {
    _id: deviceutil.getDefaultTypeId(),
    name: 'Default type',
    props: {
      state: { name: 'State', vtype: 'N', op: 'rw' }
    }
  },
  {
    _id: deviceutil.getSysIndicatorTypeId(),
    sys: 1,
    name: 'System indicator',
    props: {
      state: { name: 'State', vtype: 'N', op: 'rw' }
    }
  }
];

const typeMap = new Map();

module.exports = {
  start(typeDocs, deviceDocs, dm) {
    this.dm = dm;
    this.defaultType = deviceutil.getDefaultTypeId();
    typeMap.clear();

    // Системные типы - встроенные
    embeddedTypes.forEach(item => this.add(item));

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

    dm.on('updated:typepropsTable', docs => {
      docs.forEach(doc => this.onUpdateTypeDoc(doc));
    });

    dm.on('removed:type', docs => {
      docs.forEach(doc => this.delete(doc._id));
    });
  },

  add(typeDoc) {
    if (!typeDoc || !typeDoc._id) return;

    const typeId = typeDoc._id;
    typeMap.set(typeDoc._id, { item: {}, props: {}, proparr: [], calc: [], onHandlers: {} });

    const typeItem = typeMap.get(typeId);
    Object.keys(typeDoc).forEach(docProp => {
      if (docProp == 'props') {
        this.updateProps(typeId, typeDoc.props);
      } else {
        // Плоские свойства
        typeItem.item[docProp] = typeDoc[docProp];
        if (docProp.startsWith('scriptOn') && typeDoc[docProp]) {
          // scriptOnChange: 1
          this.requireHandler(typeId, '_' + docProp.substr(6));
        }
      }
    });
  },

  existsType(typeId) {
    return typeMap.has(typeId);
  },

  // Устройство получает ссылку на объект типа и работает с ним
  getTypeObj(typeId) {
    return typeMap.has(typeId) ? typeMap.get(typeId) : typeMap.get(this.defaultType);
  },

  getTypeMap() {
    return typeMap;
  },

  getTypeObjPropField(typeId, prop, field) {
    if (typeMap.has(typeId)) {
      return typeMap.get(typeId).props[prop] ? typeMap.get(typeId).props[prop][field] : '';
    }
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

      // Удалили свойство - нужно удалить handler  $unset={ 'props.newprop': 1 }
      Object.keys($unset).forEach(key => {
        if (key.startsWith('props.')) {
          handlerutils.deleteHandler(typeId + '_' + key.split('.').pop());
        }
      });
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

      // TODO Переименовали свойство - нужно переименовать handler??

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

    Object.keys(typeItem.props).forEach(prop => {
      const p = typeItem.props[prop];

      if (p.op == 'cmd') {
        typeItem.commands.push(prop);
      } else {
        typeItem.proparr.push({ prop, ...getProparrAux(prop, p) });
      }
      if (p.op == 'calc') typeItem.calc.push({ prop, when: p.when || '0', trigger: getTriggerObj(p.trigger) }); // Сохранить имя свойства для полей calculate

      // Подцепить функцию-обработчик fn для каждого свойства
      // p.fuse: 0-обработчик не используется, 1-default, 2-внешний (из файла)
      p.fn = '';
      if (p.fuse == 1) {
        p.fn = handlerutils.getDefaultHandler(typeId, prop, typeItem);
      } else if (p.fuse == 2) {
        this.requireHandler(typeId, prop);
      }

      // Подцепить функцию  форматирования fn_format для каждого свойства - не команды
      p.fn_format = '';
      if (p.op != 'cmd' && p.format) {
        if (typeof p.format == 'string') {
          p.fn_format = defaulthandlers['format_' + p.format] || '';
        } else if (p.format == 1) {
          // Встроенный
          // const format_def = 'format_def_' + p.vtype;
          // if (defaulthandlers[format_def]) p.fn_format = defaulthandlers[format_def];
          p.fn_format = getBuildInFnFormat(p.vtype);
        } else if (p.format == 2) {
          // Пользовательский
          this.requireHandler(typeId, '_format_' + prop);
          if (!p.fn_format) p.fn_format = getBuildInFnFormat(p.vtype);
        }
      }
    });

    function getBuildInFnFormat(vtype) {
      // Встроенный
      const format_def = 'format_def_' + vtype;
      return defaulthandlers[format_def] ? defaulthandlers[format_def] : '';
    }

    function getTriggerObj(trigger) {
      if (!trigger) return '';
      const result = {};
      trigger.split(',').forEach(prop => {
        result[prop] = 1;
      });
      return result;
    }
  },

  requireHandler(typeId, inprop) {
    const typeItem = typeMap.get(typeId);
    let setObj;

    // Внешний обработчик
    const filename = handlerutils.getHandlerFilename(typeId, inprop);

    // Для общих обработчиков _OnSchedule,
    if (inprop.startsWith('_On')) {
      const errPropName = 'err' + inprop;
      let errstr = '';
      try {
        if (filename) {
          typeItem.onHandlers['fn_' + inprop] = require(filename);
        }
      } catch (e) {
        errstr = 'Handler ERROR: ' + hut.getShortErrStr(e);
        console.log('ERROR: Handler ERROR: ' + hut.getErrStrWoTrace(e));
        typeItem.onHandlers['fn_' + inprop] = '';
      }
      if (errstr != typeItem[errPropName]) {
        setObj = { [errPropName]: errstr };
      }
      return setObj ? { table: 'type', doc: setObj } : '';
    }

    // Обработчики свойства - обычный и format("_format_value")
    const prop = inprop.startsWith('_format') ? inprop.substr(8) : inprop;
    const p = typeItem.props[prop];

    if (inprop.startsWith('_format')) {
      requirePropFun('fn_format', 'errstr_format');
    } else {
      requirePropFun('fn', 'errstr');
    }
    return setObj ? { table: 'type', doc: setObj } : '';

    function requirePropFun(prop_fn, prop_err) {
      let estr;
      try {
        if (filename) {
          p[prop_fn] = require(filename);
          // Сбросить ошибку errstr в types
          estr = '';
        }
      } catch (e) {
        console.log('ERROR: Handler ERROR: ' + hut.getErrStrWoTrace(e));
        estr = 'Handler ERROR: ' + hut.getShortErrStr(e);
        p[prop_fn] = '';
      }

      if (estr != p[prop_err]) {
        setObj = { ['props.' + prop + '.' + prop_err]: estr };
      }
    }
  },

  getHandlerFun(typeId, prop) {
    const typeItem = typeMap.get(typeId);
    return typeItem.onHandlers['fn_' + prop];
  },

  async updateDocInTable(typeId, setObj) {
    const doc = await this.dm.dbstore.findOne('types', { _id: typeId }, {});
    if (!doc) {
      console.log('WARN: typestore.updateDocInTable. Not found type ' + typeId + ' in types collection!');
      return;
    }
    doc.$set = setObj;
    this.dm.updateDocs('type', [doc]);
  },

  // Вернуть обработчик в виде строки для редактирования
  async getHandlerStr(typeId, prop) {
    if (!typeId || !prop) return '';
    if (prop.startsWith('_On')) {
      return handlerutils.getOnHandlerStr(typeId, prop);
    }

    if (!typeMap.has(typeId)) return '';
    const typeObj = typeMap.get(typeId);
    // if (!typeObj || !typeObj.props || !typeObj.props[prop]) return '';
    if (!typeObj || !typeObj.props) return '';

    return handlerutils.getPropHandlerStr(typeId, prop, typeObj);
  },

  // Перезагрузить обработчики после изменения функции-обработчика
  reloadHandler(fname) {
    for (const typeItem of typeMap.values()) {
      Object.keys(typeItem.props).forEach(prop => {
        const p = typeItem.props[prop];
        if (p.fname == fname) {
          handlerutils.requireHandler(prop, p);
        }
      });
    }
  },

  async copyHandlers(fromType, toType) {
    const typeItem = typeMap.get(fromType);
    if (!typeItem || !typeItem.props) {
      console.log('WARN: Copy type operation. Not found source type ' + fromType);
      return;
    }

    // Собрать список пользовательских обработчиков, getHandlerFilename возвращает имя если файл существует
    const arr = Object.keys(typeItem.props).filter(
      prop => typeItem.props[prop].fuse == 2 && handlerutils.getHandlerFilename(fromType, prop)
    );
    return handlerutils.copyHandlers(arr, fromType, toType);
  },

  delete(typeId) {
    // Удалить обработчики, если есть
    handlerutils.deleteHandlers(typeId);
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

  getPropAndCommandNameArray(type) {
    return type && typeMap.has(type) && typeMap.get(type).props ? Object.keys(typeMap.get(type).props) : [];
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
      // Добавление свойств
      const arr = typeMap.get(typeId).proparr;
      arr.forEach(propItem => {
        props[propItem.prop] = getProparrAux(propItem.prop, propItem);
      });

      // Добавление команд
      const commands = typeMap.get(typeId).commands;
      if (commands) {
        commands.forEach(command => {
          props[command] = {};
        });
      }
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
    type = type || this.defaultType;
    doc.type = type;
    doc.props = this.createPropsFromType(type);
    doc.dn = this.createDnFromType(type);
    doc.name = this.getNameFromType(type);
    doc.tags = this.getTagsFromType(type);
    return doc;
  },

  getNewDnAsCopy(dn) {
    return dnpref.getNewDnAsCopy(dn);
  },

  // Возвращает массив команд - все команды всех устройств: ['on', 'off', 'up', 'down']
  getAllCmd() {
    const allset = new Set();
    for (const typeItem of typeMap.values()) {
      if (typeItem.commands)
        typeItem.commands.forEach(cmd => {
          allset.add(cmd);
        });
    }
    return [...allset];
  },

  getAllProp() {
    const allset = new Set();
    for (const typeItem of typeMap.values()) {
      if (typeItem.proparr)
        typeItem.proparr.forEach(propItem => {
          const prop = propItem.prop;
          allset.add(prop);

          if (typeItem.props[prop].format) allset.add(prop + '#string');
        });
    }
    return [...allset];
  }
};

// Частные функции
/**
 *
 * @param {*} prop
 * @param {*} propItem
 */
function getProparrAux(prop, propItem) {
  // const res = { prop };
  if (!propItem || propItem.command) return;

  const res = {};
  res.mu = propItem.mu || '';
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
  // if (propItem.fn_opt_str) res.fn_opt = propItem.fn_opt_str;

  return res;
}
