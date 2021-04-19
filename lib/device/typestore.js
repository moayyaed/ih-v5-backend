/** typestore.js
 *
 * Сервис для работы с типами устройств, создания новых устройств
 *
 *  Основная функция - создать typeMap с  элементами typeObj (typo)
 *  - typeObj - объект типа, содержит информацию о типе и handlers (обработчики)
 *    которые вызываются устройством
 *
 *  typeMap передается каждому объекту устройства (тип устройства может измениться)
 *
 *   1. Слушает
 *      - updated:device - изменение dn устройства для актуализации префикса
 *
 *   2. Создает документ с новым устройством заданного типа
 *      - генерирует dn и структуру устройства
 *   3. При копировании устройства - генерирует dn
 */

const util = require('util');

// const hut = require('../utils/hut');
const Typo = require('./typo');
const type_struct = require('./type_struct');
const dnpref = require('./dnpref'); // Объект для работы с префиксами устройств
const handlerutils = require('./handlerutil');
const deviceutil = require('./deviceutil');

const typeMap = new Map();

module.exports = {
  start(typeDocs, deviceDocs, dm) {
    this.dm = dm;
    this.defaultType = deviceutil.getDefaultTypeId();
    typeMap.clear();

    deviceutil.embeddedTypes().forEach(item => this.add(item));
    typeDocs.forEach(item => this.add(item));

    deviceDocs.forEach(item => dnpref.updateDnPref(item.dn));

    // Слушать события изменения таблицы device
    // - интересует только dn устройства - для актуализации префикса
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
  },

  /**
   * Создать объект типа из документа на старте
   * @param {Object} typeDoc
   */
  add(typeDoc) {
    if (!typeDoc || !typeDoc._id) return;
    const typeObj = new Typo(type_struct.create(typeDoc));
    typeMap.set(typeDoc._id, typeObj);
  },

  existsType(typeId) {
    return typeMap.has(typeId);
  },

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

  getHandlerFun(typeId, prop) {
    if (!typeMap.has(typeId)) return '';
    const typeObj = typeMap.get(typeId);
    if (!typeObj.onHandlers || !typeObj.onHandlers[prop]) return '';

    // Если функция еще не загружена - нужно ее загрузить!!
    const handlerObj = typeObj.onHandlers[prop];

    if (typeof handlerObj.fn != 'function' && (handlerObj.filename || handlerObj.name)) {
      handlerObj.fn = handlerutils.getHandlerFunction(handlerObj);
    }
    return handlerObj.fn;
  },

  // Вернуть обработчик в виде строки для редактирования
  async getHandlerStr(typeId, prop) {
    if (!typeId || !prop) return '';
    if (prop.startsWith('_On')) {
      return handlerutils.getOnHandlerStr(typeId, prop);
    }

    if (!typeMap.has(typeId)) return '';
    const typeObj = typeMap.get(typeId);
    if (!typeObj || !typeObj.props) return '';

    return handlerutils.getPropHandlerStr(typeId, prop, typeObj);
  },

  async copyHandlers(fromType, toType) {
    const typeItem = typeMap.get(fromType);
    if (!typeItem || !typeItem.props) {
      console.log('WARN: Copy type operation. Not found source type ' + fromType);
      return;
    }

    // Собрать список пользовательских обработчиков, массив строк - имена без типа
    const arr = [];

    // 1. Обработчики уровня всего устройства - scriptOn* - берем плоские свойства
    Object.keys(typeItem.item)
      .filter(prop => prop.startsWith('scriptOn') && typeItem.item[prop])
      // scriptOnChange: 1
      .forEach(prop => {
        arr.push('_' + prop.substr(6)); // scriptOnChange => _OnChange
      });

    // 2. Обработчики свойств
    Object.keys(typeItem.props)
      .filter(prop => typeItem.props[prop].fuse == 2)
      .forEach(prop => {
        arr.push(prop);
      });

    // 3. Функции форматирования свойств
    Object.keys(typeItem.props)
      .filter(prop => typeItem.props[prop].format == 2)
      .forEach(prop => {
        arr.push('_format_' + prop);
      });
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
        props[propItem.prop] = type_struct.getProparrAux(propItem.prop, propItem);
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
