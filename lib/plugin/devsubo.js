/**
 * devsubo.js
 * Объект работы с подписками плагинов на !!изменения устройств!! (event = 'devices')
 *  Остальные подписки хранятся внутри объекта плагина uobj.subs
 *
 *
 */

const util = require('util');


class DevSubo {
  constructor(holder) {
    this.holder = holder;
    this.unitSubSet = {};
    // {<unitId>:{<did>:{<prop>:<uuid>}}}}
    // {mqtt1:{d003:{state:'main'}}}}

    this.holder.on('changed:device:data', changed => {
      // Отправить по подписке конкретным плагинам
      if (!Object.keys(this.unitSubSet).length) return;

      this.sendOnDeviceEvent(changed);
    });
  }

  // Может быть несколько подписок от плагина
  // Устройство должно входить только в ОДНУ подписку!
  doSub(unitId, m) {
    if (!m || !m.event) return;
    const uid = m.id || 'main';

    if (!this.unitSubSet[unitId]) this.unitSubSet[unitId] = {};

    // В момент подписки - отдать текущие значения по списку
    const currentArr = [];

    const setItem = this.unitSubSet[unitId];
    if (m.filter) {
      // if (!this.unitSubSet[m.event][unitId].devices) this.unitSubSet[m.event][unitId].devices = {};
      // const setItem = this.unitSubSet[m.event][unitId];

      // m= {type:'sub', id:'main',event: 'devices',filter: { did_prop: [ 'd0004.value' ] } }
      if (Array.isArray(m.filter.did_prop)) {
        m.filter.did_prop.forEach(item => {
          let [did, prop] = item.split('.');

          if (this.holder.devSet[did]) {
            const dobj = this.holder.devSet[did];
            if (!prop) {
              prop = '*'; // Все свойства устройства
              const propArr = dobj.getProps();
              propArr.forEach(p => {
                currentArr.push({ did, prop: p, value: dobj[p] });
              });
            } else if (dobj.hasProp(prop)) {
              currentArr.push({ did, prop, value: dobj[prop] });
            } else {
              prop = '';
            }

            if (prop) {
              if (!setItem[did]) setItem[did] = {};
              setItem[did][prop] = uid;
            }
          }
        });
      }
    } 

    // Отдать текущие значения
    // console.log('DEVSUBO DO SUB currentArr='+util.inspect(currentArr))
    if (currentArr.length) {
      const uobj = this.holder.unitSet[unitId];
      uobj.send({ id: uid, type: 'sub', event: 'devices', data: currentArr });
    }

    // console.log('doSub this.unitSubSet='+util.inspect(this.unitSubSet, null, 6));
  }

  doUnsub(unitId, m) {
    if (!m) {
      // Отписать все для unitId
      if (this.unitSubSet[unitId]) this.unitSubSet[unitId] = '';
    }
    // Конкретная отписка по uuid - нужно перебирать
  }

  sendOnDeviceEvent(changed) {
    // Сформировать по плагинам unitId и uuid data:{<uuid>:{  }}
    // console.log('Subsmanager: sendOnDeviceEvent ' + util.inspect(this.unitSubSet.devices));

    Object.keys(this.unitSubSet).forEach(unitId => {
      // Отдать только если плагин запущен
      if (this.holder.unitSet[unitId] && this.holder.unitSet[unitId].ps) {
        const unitDevice = this.unitSubSet[unitId];
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
          const uobj = this.holder.unitSet[unitId];
          // По каждой подписке отдельно
          // console.log('sendOnDeviceEvent data=' + util.inspect(data));
          // this.holder.emit('send:plugin:onsub', unitId, 'devices', data);
          Object.keys(data).forEach(uid => {
            // console.log('SEND ON SUB ' + unitId + util.inspect({ id, type: 'sub', event, data: dataByUid[id] }));
            uobj.send({ id: uid, type: 'sub', event: 'devices', data: data[uid] });
          });
        }
      }
    });
  }
}

module.exports = DevSubo;
