/**
 * informservice.js
 *
 * Информирование
 * Принимает запросы на отправку сообщений: {type:'email', }
 *    1. если плагина нет или он не запущен - ошибка
 *    2. формирует адреса для отправки - таблица infoaddr
 *    3. считает число отправленных сообщений адресату (или всего?) за период
 *      (ограничить число сообщений в форс-мажорных ситуациях)
 *    4. Передает для отправки соотв плагину
 *       (каждому сообщению присваивается uuid)
 *    5. Слушает результат отправки??
 */

const util = require('util');

const dm = require('../datamanager');

module.exports = async function(holder) {
  holder.on('info:send', sendInfo);
  holder.on('info:result', sendResult);

  async function sendInfo(sendObj, callback) {}

  async function sendResult(resObj) {}
};
