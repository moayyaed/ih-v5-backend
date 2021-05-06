/**
 * apicommand.js
 *
 */

const ackAlert = require('../alert/acknowledgment');

/**
 * Выполнить команду с кнопки
 * @param {*} query
 * @param {*} holder
 *
 *  throw если ошибка
 */
async function exec(query, holder) {
 
    switch (query.command) {
      case 'api_ack_alert':
        return ackAlert.exec(query, 'ack', holder);
       
      case 'api_deack_alert':
        return ackAlert.exec(query, 'deack', holder);
      default:
        throw { message: 'Unknown command  ' + query.command + ' IN ' + JSON.stringify(query) };
    }
  
}

module.exports = {
  exec
};
