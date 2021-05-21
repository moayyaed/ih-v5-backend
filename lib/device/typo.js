/**
 *  typo.js
 */

const util = require('util');

const type_struct = require('./type_struct');
// const handlerutils = require('./handlerutil');
const defaulthandlers = require('./defaulthandlers');

class Typo {
  /**
   * Объект типа с обработчиками
   * @param {Object} typeObj - анемичный объект типа
   *
   * { item: {}, props: {}, proparr: [], calc: [], onHandlers: {} });
   *
   */

  constructor(typeObj) {
    Object.assign(this, typeObj);
  }

  hasProp(propname) {
    return this.props && this.props[propname];
  }

  getPropAndCommandNameArray() {
    return this.props ? Object.keys(this.props) : [];
  }

  // Изменение плоских полей
  changeFlatFields(newitem) {
    // {item: {_id, name, ruledn_pref}, proparr:[{ prop: 'value', name: 'Значение', vtype: 'B', op: 'r' },]
    Object.assign(this.item, newitem);
  }

  // Изменение свойств
  changeProps(newprops) {
    type_struct.updateProps(this, newprops);
  }

  changeAlerts(newalerts) {
    type_struct.updateAlerts(this, newalerts);
  }

  getHandlerObjToRun(prop) {
    const hobj = this.getHandlerObj(prop);

    if (!hobj || hobj.blk) return hobj;

    if (hobj.fn) return hobj;

    // Если нет функции - загрузить ее
     // hobj.fn = handlerutils.getHandlerFunction(hobj);
      // console.log('LOAD FUNCTION fn='+handlerObj.fn.toString())
      if (!hobj.name && !hobj.filename) return '';
      if (!hobj.filename) return defaulthandlers[hobj.name];

      try {
        return require(hobj.filename);
      } catch (e) {
        console.log('ERROR: Handler ' + hobj.filename + ' ' + util.inspect(e));
      }
    
    return hobj;
  }

 
  getHandlerObj(prop) {
    // _OnChange
    // format_state
    // format_my_state
    // state
    if (prop.startsWith('_On')) {
      return this.onHandlers && this.onHandlers[prop] ? this.onHandlers[prop] : '';
    }
    let xprop = prop;
    let xhandler = 'handler';
    if (prop.startsWith('_format_')) {
      xprop = prop.substr(8);
      xhandler = 'formathandler';
    }

    return this.props[xprop] ? this.props[xprop][xhandler] : '';
  }

  setHandlerBlk(prop, val) {
    const handlerObj = this.getHandlerObj(prop);
    // console.log('setHandlerBlk handlerObj=' + util.inspect(handlerObj));
    if (handlerObj) handlerObj.blk = val;
  }

  clearFn(prop, blk = 0) {
    const handlerObj = this.getHandlerObj(prop);
    if (handlerObj) {
      handlerObj.fn = '';
      handlerObj.blk = blk;
    }
    console.log('CLEAR ' + prop + ' handlerObj=' + util.inspect(handlerObj));
  }
}

module.exports = Typo;
