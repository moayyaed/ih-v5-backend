/**
 * subsmanager.js
 * Объект работы с подписками плагинов
 *  -
 */

const util = require('util');

class Subsmanager {
  constructor(holder) {
    this.holder = holder;
    this.unitSubSet = {}; // {mqtt1:{device:{d003:{state:<uuid>}}}}

    this.holder.on('changed:device:data', changed => {
      // Отправить по подписке конкретным плагинам
      if (!this.unitSubSet.devices) return;

      this.sendOnDeviceEvent(changed);
    });
  }

  doSub(unitId, m) {
    if (!m || !m.event) return;

    if (!this.unitSubSet[m.event]) this.unitSubSet[m.event] = {};
    if (!this.unitSubSet[m.event][unitId]) this.unitSubSet[m.event][unitId] = {};

    if (m.event == 'devices') {
      const setItem = this.unitSubSet[m.event][unitId];
      if (m.filter) {
        // if (!this.unitSubSet[m.event][unitId].devices) this.unitSubSet[m.event][unitId].devices = {};
        // const setItem = this.unitSubSet[m.event][unitId];

        // m= {type:'sub', id:'main',event: 'devices',filter: { did_prop: [ 'd0004.value' ] } }
        if (Array.isArray(m.filter.did_prop)) {
          m.filter.did_prop.forEach(item => {
            let [did, prop] = item.split('.');
            if (!prop) prop = '*'; // Все свойства устройства
            if (!setItem[did]) setItem[did] = {};
            setItem[did][prop] = m.id;
          });
        }
      } else {
        // Если это интеграция - подписка на все устройства этой интеграции

        // Получить список активных устройств и сформировать [did][prop]
        this.formDeviceSubSetForIntegration(unitId, m.id);
      }
    }
    // console.log('doSub this.unitSubSet='+util.inspect(this.unitSubSet, null, 6));
  }

  async formDeviceSubSetForIntegration(unitId, id) {
    const setItem = this.unitSubSet.devices[unitId];
    const docs = await this.holder.dm.get('integrations', { app: unitId, active: 1 });
    docs.forEach(doc => {
      if (!setItem[doc.did]) setItem[doc.did] = {};
      const prop = '*';
      setItem[doc.did][prop] = id;
    });
  }

  doUnsub(unitId, m) {
    if (!m) {
      // Отписать все для unitId
      Object.keys(this.unitSubSet).forEach(event => {
        if (this.unitSubSet[event][unitId]) this.unitSubSet[event][unitId] = '';
      });
    }
    // Конкретная отписка по uuid - нужно перебирать
  }

  sendOnDeviceEvent(changed) {
    // Сформировать по плагинам unitId и uuid data:{<uuid>:{  }}
    // console.log('Subsmanager: sendOnDeviceEvent ' + util.inspect(this.unitSubSet.devices));
    

    Object.keys(this.unitSubSet.devices).forEach(unitId => {
      const unitDevice = this.unitSubSet.devices[unitId];
      // console.log('Subsmanager: sendOnDeviceEvent unitId=' + unitId + ' unitDevice=' + util.inspect(unitDevice));
      let data;
      changed.forEach(chItem => {
        // if (unitDevice[chItem.did] && (unitDevice[chItem.did][chItem.prop] || unitDevice[chItem.did]['*'])) {
        if (unitDevice[chItem.did]) {
          let uid;

          if (unitDevice[chItem.did][chItem.prop]) {
            uid = unitDevice[chItem.did][chItem.prop];
          } else if (unitDevice[chItem.did]['*']) {
            uid = unitDevice[chItem.did]['*'];
          }

          // const uid = unitDevice[chItem.did][chItem.prop];
          if (uid) {
            if (!data) data = {};
            if (!data[uid]) data[uid] = [];
            data[uid].push({ did: chItem.did, prop: chItem.prop, value: chItem.value });
          }
        }
      });

      if (data) {
        // console.log('sendOnDeviceEvent data=' + util.inspect(data));
        this.holder.emit('send:plugin:onsub', unitId, 'devices', data);
      }
    });
  }
}

module.exports = Subsmanager;
