/**
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

const appconfig = require('../appconfig');

class Informengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;
  }

  start(docs) {
    // Формировать адреса для отправки
    this.infoaddrSet = {}; // {<infotype=email>:{<userId=admin>:[{addr, sign, allowed}, ...]}}
    docs
      .filter(doc => doc.infotype && doc.userId)
      .forEach(doc => {
        this.addInfoaddr(doc);
      });

    // Определяем синхронную функцию для отправки
    // thow если нет возможности отправить
    // callback - если будет ответ от плагина??
    this.holder.sendInfo = this.sendInfo.bind(this);

    // this.holder.on('info:result', sendResult);
  }

  addInfoaddr(doc) {
    const infotype = doc.infotype;
    if (!this.infoaddrSet[infotype]) this.infoaddrSet[infotype] = {};

    const userId = doc.userId;
    if (!this.infoaddrSet[infotype][userId]) this.infoaddrSet[infotype][userId] = [];
    this.infoaddrSet[infotype][userId].push(doc);
  }

  sendInfo(unitId, sendObj) {
    // Проверка, что плагин может отправить
    const pluginStr = appconfig.getMessage('Plugin') + ' ' + unitId + ' ';

    if (!unitId) throw { message: 'Missing plugin id for information! ' };
    if (!this.holder.unitSet[unitId]) throw { message: pluginStr + appconfig.getMessage('notFound') };
    if (!this.holder.unitSet[unitId].ps) throw { message: pluginStr + appconfig.getMessage('notRunning') };

    // Формирование сообщения для плагина - подбор адресов, если нужно
    const data = sendObj;

    // Отправка data = {txt,<img>, sendTo:[{addr, sign}, ..]}
    this.holder.unitSet[unitId].send({ id: '_', type: 'sub', event: 'sendinfo', data });

    if (unitId == 'pushnotification' && data.txt && data.sendTo && data.sendTo.length) {
      const ts =  Date.now();
      const txt = data.txt;
      const toWrite = data.sendTo.map(item => ({ts, txt, dest:item.userId}))
      this.holder.dm.insertDocs('pushnotifications', toWrite);
    }
  }
}

module.exports = Informengine;
