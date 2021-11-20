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
 *
 * Также формирует событие для звукового оповещения {type:'sound'} => emit('playsound')
 *
 */

const util = require('util');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const liststore = require('../dbs/liststore');

class Informengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;
  }

  async start() {
    // Формировать список адресов для отправки
    this.infoaddrSet = {}; // {<infotype=email>:{<userId=admin>:[{addr, sign, allowed}, ...]}}
    const docs = await this.dm.get('infoaddr');
    docs.forEach(doc => this.addInfoaddr(doc));

    // Формировать список групп пользователей для отправки (отправить группе)
    this.groupSet = {}; // {<groupId>: new Set([userId1, userId2])}
    const arr = await this.dm.get('agroup_tab'); // {groupId, userId}
    arr.forEach(doc => this.addGroupItem(doc)); // Здесь все пользователи, включенные в группы

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

        if (infotype == 'sound') {
          this.sendPlaySound(sendObj);
        } else {
          this.sendInfo(infotype, sendObj, sender);
        }
      } catch (e) {
        console.log('ERROR: send:info data=' + util.inspect(data) + '. Reason:' + util.inspect(e));
        this.emitDebugMsg(sender, 'ERROR Send info! ' + e.message);
      }
    });
  }

  sendPlaySound(sendObj) {
    // console.log('sendPlaySound '+util.inspect(sendObj));
    // Возможно отправка группе - тогда нужно добавить всех пользователей
    // sendObj:{txt, dest:'admin', sender:'scene_scen042'}
    const { dest } = sendObj;

    if (dest && this.groupSet[dest]) {
      // Это группа
      if (!this.groupSet[dest].size) throw { message: appconfig.getMessage('EmptyGroup') + ': ' + dest };
      sendObj.dest = Array.from(this.groupSet[dest]);

      // Проверить, что пользователь существует, он может быть не включени никуда
    } else if (!liststore.hasItem('userList', dest)) {
      throw { message: appconfig.getMessage('UserNotFound') + ': ' + dest };
    }

    this.holder.emit('playsound', sendObj);
  }

  emitDebugMsg(sender, msg) {
    if (sender && sender.startsWith('scene_')) {
      this.holder.emit('debug', sender, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
    }
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

  addGroupItem({ groupId, userId }) {
    if (!groupId || !userId) return;

    // {<groupId>: new Set([userId1, userId2])}
    if (!this.groupSet[groupId]) this.groupSet[groupId] = new Set();
    this.groupSet[groupId].add(userId);
  }

  removeGroupItem({ groupId, userId }) {
    if (!groupId || !userId || !this.groupSet[groupId]) return;

    // {<groupId>: new Set([userId1, userId2])}
    if (this.groupSet[groupId].has(userId)) this.groupSet[groupId].delete(userId);
  }

  sendInfo(unitId, sendObj, sender) {
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

    if (sender) {
      const lst = sendObj.sendTo.map(item => '\n ' + item.addr);
      this.emitDebugMsg(sender, 'Send to: ' + lst);
    }

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

    // if (this.infoaddrSet[infotype] || !this.infoaddrSet[infotype][dest]) throw { message: NoDestMsg };

    // Нет адресов для этого канала
    if (!this.infoaddrSet[infotype]) throw { message: NoDestMsg };

    // dest - Получателем может быть пользователь или группа
    let userRecs;
    if (this.infoaddrSet[infotype][dest]) {
      userRecs = this.infoaddrSet[infotype][dest];
    } else if (this.groupSet[dest] && this.groupSet[dest].size) {
      // Собрать id пользователей группы
      userRecs = [];
      this.groupSet[dest].forEach(userId => {
        if (this.infoaddrSet[infotype][userId] && this.infoaddrSet[infotype][userId].length) {
          this.infoaddrSet[infotype][userId].forEach(rec => {
            userRecs.push(rec);
          });
        }
      });
    }

    if (!userRecs || !userRecs.length) throw { message: NoDestMsg };

    const toSend = [];
    userRecs.forEach(rec => {
      if (rec.allowed) toSend.push({ addr: rec.addr, sign: rec.sign, userId: dest });
    });

    return toSend;
  }
}

module.exports = Informengine;
