/**
 * apicommand.js
 *
 */

const alerter = require('../alert/alerter');

/**
 * Выполнить команду с кнопки
 * @param {*} query
 * @param {*} holder
 *
 *  throw если ошибка
 */
async function exec(query, holder) {
  try {
    switch (query.command) {
      case 'api_ack_alert':
        return alerter.ackAlert(query.payload);

      case 'api_deack_alert':
        return alerter.deackAlert(query.payload);

      default:
        throw { message: 'Unknown command  ' + query.command + ' IN ' + JSON.stringify(query) };
    }
  } catch (e) {
    throw e;
  }
}

module.exports = {
  exec
};
