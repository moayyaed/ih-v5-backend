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
      // console.log('Subsmanager: changed:device:data ' + util.inspect(changed));
      // Отправить по подписке конкретным плагинам
      if (!this.unitSubSet.devices) return;

      this.sendOnDeviceEvent(changed);
    });
  }

  doSub(unitId, m) {
    if (!m || !m.event) return;

    if (!this.unitSubSet[m.event]) this.unitSubSet[m.event] = {};
    if (!this.unitSubSet[m.event][unitId]) this.unitSubSet[m.event][unitId] = {};

    if (m.event == 'devices' && m.filter) {
      // if (!this.unitSubSet[m.event][unitId].devices) this.unitSubSet[m.event][unitId].devices = {};
      const setItem = this.unitSubSet[m.event][unitId];

      // m= {type:'sub', id:'main',event: 'devices',filter: { did_prop: [ 'd0004.value' ] } }
      if (Array.isArray(m.filter.did_prop)) {
        m.filter.did_prop.forEach(item => {
          let [did, prop] = item.split('.');
          if (!prop) prop = '*'; // Все свойства устройства
          if (!setItem[did]) setItem[did] = {};
          setItem[did][prop] = m.id;
        });
      }
    }
    console.log('doSub this.unitSubSet='+util.inspect(this.unitSubSet, null, 6));
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
    Object.keys(this.unitSubSet.devices).forEach(unitId => {
      const unitDevice = this.unitSubSet.devices[unitId];
      let data;
      changed.forEach(chItem => {
        if (unitDevice[chItem.did] && unitDevice[chItem.did][chItem.prop]) {
          const uid = unitDevice[chItem.did][chItem.prop];
          if (!data) data = {};
          if (!data[uid]) data[uid] = [];
          data[uid].push({ did: chItem.did, prop: chItem.prop, value: chItem.value });
        }
      });
      
      if (data) {
        console.log('sendOnDeviceEvent data='+util.inspect(data))
        this.holder.emit('send:plugin:onsub', unitId, 'devices', data);
      }
    });
  }
}

module.exports = Subsmanager;
