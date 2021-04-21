/**
 *  typo.js
 */

const util = require('util');

const type_struct = require('./type_struct');
const handlerutils = require('./handlerutil');
// const defaulthandlers = require('./defaulthandlers');

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

  getPropHandler(prop, htype = 'handler') {
    // handler:{name, filename, fn},
    // formathandler: {name, filename, fn},
    if (this.props && this.props[prop] && this.props[prop][htype]) {
      const handlerObj = this.props[prop][htype];
      if (!handlerObj.fn) {
        handlerObj.fn = handlerutils.getHandlerFunction(handlerObj);
      }
      return handlerObj.fn || '';
    }
  }

  getOnHandlerFunction(event) {
    
    const handlerObj= this.getHandlerObj(event);
    if (!handlerObj) return;

    if (handlerObj.blk) {
      console.log('getOnHandlerFunction. Handler blocked: '+handlerObj.filename)
      return;
    }
    
    if (!handlerObj.fn) {
        handlerObj.fn = handlerutils.getHandlerFunction(handlerObj);
        // console.log('LOAD FUNCTION fn='+handlerObj.fn.toString())
    }
    return handlerObj.fn || '';
    
  }

  getHandlerObj(prop) {
    // _OnChange
    // format_state
    // format_my_state
    // state
    if (prop.startsWith('_On')) {
      return this.onHandlers && this.onHandlers[prop] ? this.onHandlers[prop] : '';
    }

    return this.props[prop]
      ? prop.startsWith('format_') > 0
        ? this.props[prop].formathandler
        : this.props[prop].handler
      : '';
  }

  setHandlerBlk(prop, val) {
    const handlerObj= this.getHandlerObj(prop);
    console.log('setHandlerBlk handlerObj='+util.inspect(handlerObj));
    if (handlerObj) handlerObj.blk = val;
  }

  clearFn(prop) {
    const handlerObj = this.getHandlerObj(prop);
    if (handlerObj) handlerObj.fn = '';
  }
}

module.exports = Typo;
