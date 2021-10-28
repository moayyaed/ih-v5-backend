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
const hut = require('../utils/hut');

class Informengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;
  }

  start(docs) {
    // Формировать адреса для отправки
    this.infoaddrSet = {}; // {<infotype=email>:{<userId=admin>:[{addr, sign, allowed}, ...]}}
    docs.forEach(doc => this.addInfoaddr(doc));

    // Определяем синхронную функцию для отправки
    // thow если нет возможности отправить
    // callback - если будет ответ от плагина??
    // Используется алертами и для отправки отладочных сообщений
    this.holder.sendInfo = this.sendInfo.bind(this);

    // От сценария или другого плагина
    this.holder.on('send:info', data => {
      // data = {infotype, sendObj:{txt, dest:'admin', sender:'scene_scen042'}}
      const { infotype, sendObj } = data;
      let sender;
      try {
        if (!infotype) throw { message: 'Missing infotype!' };
        if (!sendObj) throw { message: 'Missing sendObj!' };

        if (sendObj.sender) sender = sendObj.sender;
        this.sendInfo(infotype, sendObj);
      } catch (e) {
        console.log('ERROR: send:info data=' + util.inspect(data) + '. Reason:' + util.inspect(e));
        if (sender && sender.startsWith('scene_')) {
          this.holder.emit(
            'debug',
            sender,
            hut.getDateTimeFor(new Date(), 'shortdtms') + ' ERROR Send info! ' + e.message
          );
        }
      }
    });
  }

  addInfoaddr(doc) {
    if (!doc || !doc.infotype || !doc.userId) return;

    const infotype = doc.infotype;
    if (!this.infoaddrSet[infotype]) this.infoaddrSet[infotype] = {};

    const userId = doc.userId;
    if (!this.infoaddrSet[infotype][userId]) this.infoaddrSet[infotype][userId] = [];
    this.infoaddrSet[infotype][userId].push(doc);
  }

  removeInfoaddr(doc) {
    const { infotype, userId } = doc;
    if (
      !infotype ||
      !userId ||
      !this.infoaddrSet[infotype] ||
      !this.infoaddrSet[infotype][userId] ||
      !this.infoaddrSet[infotype][userId].length
    )
      return;

    const idx = this.infoaddrSet[infotype][userId].findIndex(udoc => udoc._id == doc._id);
    if (idx >= 0) this.infoaddrSet[infotype][userId].splice(idx, 1);
  }

  sendInfo(unitId, sendObj) {
    // Проверка, что плагин может отправить
    const pluginStr = appconfig.getMessage('Plugin') + ' ' + unitId + ' ';

    if (!unitId) throw { message: 'Missing plugin id for information! ' };
    if (!this.holder.unitSet[unitId]) throw { message: pluginStr + appconfig.getMessage('notFound') };
    if (!this.holder.unitSet[unitId].ps) throw { message: pluginStr + appconfig.getMessage('notRunning') };

    // Формирование сообщения для плагина - подбор адресов, если нужно
    // Отправка data = {txt,<img>, sendTo:[{addr, sign}, ..]}
    const data = sendObj;
    if (!sendObj.sendTo) sendObj.sendTo = this.formToSend(unitId, sendObj.dest);
    if (!sendObj.sendTo || !sendObj.sendTo.length) throw { message: appconfig.getMessage('NoAllowedAddr') };

    // Нужно найти id подписки для uobj - sendinfo
    // Если нет - отправить с id='sendinfo'
    const uobj = this.holder.unitSet[unitId];
    const subIds = uobj.getSubs ? uobj.getSubs('sendinfo') : []; // Плагин может не иметь функцию getSubs - pushnot например (системный)
    const subId = subIds && subIds.length ? subIds[0] : 'sendinfo';
    uobj.send({ id: subId, type: 'sub', event: 'sendinfo', data });

    if (unitId == 'pushnotification' && data.txt && data.sendTo && data.sendTo.length) {
      const ts = Date.now();
      const txt = data.txt;
      const toWrite = data.sendTo.map(item => ({ ts, txt, dest: item.userId }));
      this.holder.dm.insertDocs('pushnotifications', toWrite);
    }
  }

  formToSend(infotype, dest) {
    const NoDestMsg = appconfig.getMessage('NoDestAddr') + ' ' + dest;

    if (!this.infoaddrSet[infotype] || !this.infoaddrSet[infotype][dest]) throw { message: NoDestMsg };
    const userRecs = this.infoaddrSet[infotype][dest];
    if (!userRecs) throw { message: NoDestMsg };

    const toSend = [];
    userRecs.forEach(rec => {
      if (rec.allowed) toSend.push({ addr: rec.addr, sign: rec.sign, userId: dest });
    });
    return toSend;
  }
}

module.exports = Informengine;
