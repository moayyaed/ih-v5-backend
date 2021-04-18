/** typestore.js
 *
 * Сервис + mate для работы с типами устройств
 *
 *  Основная функция - создать typeMap с  элементами typeObj (typo)
 *  - typeObj - объект типа, содержит информацию о типе и handlers (обработчики)
 *    которые вызываются устройством
 *
 *  typeMap передается каждому объекту устройства (тип устройства может измениться)
 *
 *   1. Слушает
 *      - изменение type -> изм typeObj + сообщение "changed:typeprops" для изм-я устройств этого типа
 *      - updated:device - изменение dn устройства для актуализации префикса
 *
 *   2. Создает документ с новым устройством заданного типа
 *      - генерирует dn и структуру устройства
 *   3. При копировании устройства - генерирует dn
 *
 * Методы
 *  add - добавить новый тип из документа
 *  onUpdateTypeDoc   - обновление типа при обновлении документа
 *  existsType
 *  getTypeObj
 *  getTypeMap
 *  clearAll
 *  getAllCmd
 *  getAllProp
 *
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
    /*
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
    */
  },

  /**
   * Создать объект типа из документа типа
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

    if (!typeMap.has(typeId)) return;

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

    const typeObj = typeMap.get(typeId);
    // Если изменилось название типа, префикс - изменить item в typestore
    if (flat) this.updateItem(doc._id, flat);

    // Если изменились свойства в табличке - изменить props, proparr - полностью из таблицы
    if (propNeedUpdate) {
      const docType = await this.dm.dbstore.get('types', { _id: typeId }, {});
      if (!docType)
        throw { err: 'SOFTERR', message: 'Not found type ' + typeId + ' in types collection after update!' };

      const newprops = docType[0].props;
      type_struct.updateProps(typeObj, newprops);
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

  // При изменении скрипта
  // Он мог добавиться или просто измениться (но имя файла уже сформировано?)
  // Основная цель - проверить ошибку при загрузке
  // Если ошибка - вернуть ее для записи в таблицу
  // Саму функцию не цепляем, она будет заново подгружена при первом исп-и (возможно, в worker-e)
  updateHandler(typeId, inprop) {
    const typeItem = typeMap.get(typeId);
    // TODO - информировать worker об изменении скрипта!!!
    // Блокировать обработчик, если произошла ошибка - это произойдет по update:types
    return handlerutils.checkHandler(typeItem, inprop);
  
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
