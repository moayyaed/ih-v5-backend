/**
 *  typo.js
 */

const util = require('util');

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

  getPropHandler( prop, htype = 'handler') {
    // handler:{name, filename, fn},
    // formathandler: {name, filename, fn},
    if (this.props && this.props[prop] && this.props[prop][htype]) {
      const handlerObj = this.props[prop][htype];
      if (!handlerObj.fn) {
        handlerObj.fn = handlerutils.getHandlerFunction(handlerObj)
      }
      return handlerObj.fn || '';
    }
  }
  
}

module.exports = Typo;


