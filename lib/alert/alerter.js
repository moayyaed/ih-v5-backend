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
        await this.closeAlerts(aleObj);
      } else {
        await this.holder.dm.updateDocs('alerts', [{ _id, $set: { tsAck, userId } }]);
      }
      return { alert: 'info', message: 'Квитирование принято', ok: 1, refresh: true };
    } catch (e) {
      console.log('ERROR: ackAlert ' + util.inspect(e));
      throw { message: 'Квитирование не принято!' };
    }
  },

  async closeAlerts({ _id, owner }, all) {
    const docs = [{ _id }];
    // И все для этого owner, если reason == 'norm' и не требуется квитирование??
    if (all) {
      const others = await this.holder.dm.get('alerts', { owner });
      if (others) {
        others.forEach(doc => {
          if (doc._id != _id) docs.push({ _id: doc._id });
        });
      }
    }
    await this.holder.dm.removeDocs('alerts', docs);
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

  //
  canCloseAlert(aleObj) {
    const { toClose, tsAck, tsStop, reason } = aleObj;
    switch (toClose) {
      case 'norm':
        return !!(tsStop > 0 && reason == 'norm');
      case 'ack':
        return !!(tsAck > 0);
      case 'normAndAck':
        return !!(tsAck > 0 && tsStop > 0 && reason == 'norm');
      default:
    }
  },

  async saveAlertDeviceStatus(aleObj) {
    const { _id, status, toClose, owner, did, prop, txt, normtxt, level, tsStart, tsStop, reason } = aleObj;

    const dobj = this.holder.devSet[did];
    if (!dobj) {
      console.log('ERROR: saveAlertDeviceStatus. Not found device ' + did);
      return;
    }

    const longTxt = dobj.name + ' ' + dobj.dn + '. ' + txt;
    let mainLogObj;
    let devLogObj;
    let changed;
    switch (status) {
      case 'start':
        // Записать в devicelog и mainlog
        devLogObj = { did, prop, ts: tsStart, txt, level };

        await this.holder.dm.insertDocs('alerts', [{ _id, owner, toClose, did, prop, txt: longTxt, level, tsStart }]);
        changed = { id: _id, state: 'add', payload: { ts: tsStart, tsStart, level, txt: longTxt } };
        break;

      case 'stop':
        // Записать в devicelog и mainlog - при нормализации. При переходах up/down не пишем??
        if (reason == 'norm') {
          devLogObj = { did, prop, ts: tsStop, txt: dobj.name + ' ' + dobj.dn + '. ' + normtxt, level };
        }
        // изменить в alerts ВОЗМОЖНО, можно уже закрыть!!
        this.stopAlert(_id, { tsStop, reason });

        changed = { id: _id, state: 'update', payload: { tsStop, reason } };
        break;

      default:
    }
    if (changed) this.holder.emit('alertlog', changed); // Подписка для оперативного журнала или всплывающих ?? алертов??
    if (devLogObj) devicelogger.addLog(did, devLogObj);
    if (mainLogObj) this.holder.logconnector.addLog('mainlog', mainLogObj);
  },

  async stopAlert(_id, { tsStop, reason }) {
    // изменить в alerts ВОЗМОЖНО, можно уже закрыть!!
    // Для этого считать текущую запись чтобы узнать про квитирование
    const aleObj = await this.holder.dm.findRecordById('alerts', _id);
    if (!aleObj) return;

    if (this.canCloseAlert({ ...aleObj, tsStop, reason })) {
      await this.closeAlerts(aleObj, reason == 'norm');
    } else {
      await this.holder.dm.updateDocs('alerts', [{ _id, $set: { tsStop, reason } }]);
    }
  }
};
