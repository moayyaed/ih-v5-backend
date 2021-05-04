/**
 * alerter.js
 *  - Отслеживание статуса алертов
 *  - Отрабатывает квитирование
 *  - Закрывает алерты по правилу toClose
 *
 *  - TODO Информирование по алертам
 */

const util = require('util');
const devicelogger = require('../device/devicelogger');

module.exports = {
  start(holder) {
    this.holder = holder;
    // от Worker-a
    holder.on('alert:device:status', aleObj => {
      if (aleObj) this.saveAlertDeviceStatus(aleObj);
    });
  },

  async ackAlert(payload) {
    try {
      const _id = payload.id;
      const tsAck = Date.now();
      const userId = 'admin';
      // Считать алерт и проставить tsAck и userId
      const aleObj = await this.holder.dm.findRecordById('alerts', _id);
      if (!aleObj) throw { message: 'Not found alert with _id=' + _id };

      aleObj.tsAck = tsAck;
      aleObj.userId = userId;

      // Нужно фиксировать эту операцию в журналах

      // Затем можно попробовать закрыть алерт
      // Если да - удалить его, иначе записать
      if (this.canCloseAlert(aleObj)) {
        console.log('CAN CLOSE '+util.inspect(aleObj))
        await this.holder.dm.removeDocs('alerts', [{ _id }]);
      } else {
        await this.holder.dm.updateDocs('alerts', [{ _id, $set: { tsAck, userId } }]);
      }
      return { alert: 'info', message: 'Квитирование принято', ok: 1, refresh: true };
    } catch (e) {
      console.log('ERROR: ackAlert ' + util.inspect(e));
      throw { message: 'Квитирование не принято!' };
    }
  },

  async deackAlert(payload) {
    try {
      const _id = payload.id;
      await this.holder.dm.updateDocs('alerts', [{ _id, $set: { tsAck: 0, userId: '' } }]);
      return { alert: 'info', message: 'Квитирование снято', ok: 1, refresh: true };
    } catch (e) {
      console.log('ERROR: deackAlert ' + util.inspect(e));
      throw { message: 'Снятие квитирования не удачно!' };
    }
  },

  // Пока правило не проверяю - закрывать, если есть квитирование и не активный
  canCloseAlert(aleObj) {
    return !!(aleObj && aleObj.tsAck>0 && aleObj.tsStop>0);
  },

  async saveAlertDeviceStatus(aleObj) {
    // Нужно также генерировать сообщение по подписке для оперативного журнала!!
    const { _id, status, did, prop, message, level, tsStart, tsStop, reason } = aleObj;
    // console.log('saveAlertDeviceStatus '+status)
    let mainLogObj;
    let devLogObj;
    let changed;
    switch (status) {
      case 'start':
        // Записать в devicelog и mainlog
        devLogObj = { did, prop, ts: tsStart, txt: message, level };
        // Добавить в alerts - предварительно подготовить текст!!
        await this.holder.dm.insertDocs('alerts', [{ _id, did, prop, txt: message, level, tsStart }]);
        changed = { id: _id, state: 'add', payload: { ts: tsStart, tsStart, level, txt: message } };
        break;

      case 'stop':
        // Записать в devicelog и mainlog
        devLogObj = { did, prop, ts: tsStop, txt: 'STOP: ' + message, level };
        // изменить в alerts ВОЗМОЖНО, можно уже закрыть!!
        await this.holder.dm.updateDocs('alerts', [{ _id, $set: { tsStop, reason } }]);
        console.log('updateDocs '+util.inspect( [{ _id, $set: { tsStop, reason } }]))
        changed = { id: _id, state: 'update', payload: { tsStop, reason } };
        break;

      default:
    }
    if (changed) this.holder.emit('alertlog', changed); // Подписка для оперативного журнала или всплывающих ?? алертов??
    if (devLogObj) devicelogger.addLog(did, devLogObj);
    if (mainLogObj) this.holder.logconnector.addLog('mainlog', mainLogObj);
  }
};
