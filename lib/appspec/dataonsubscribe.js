/**
 *  dataonsubscribe.js
 *  Формирует данные по подписке
 */

const util = require('util');
// const dm = require('../datamanager');
// const dataformer = require('../api/dataformer');
const projectdata = require('../appspec/projectdata');

async function formMessageOnSub(event, key, changed, holder) {
  let uppobj;
  switch (event) {
    case 'layout':
    case 'container':
    case 'dialog':
      uppobj = await projectdata.getCachedUpProjectObj({ id: event, nodeid: key });
      // Для контейнера - отправить изменения переменных, связанных с устройствами и globals из changed
      return formChangedForContainer(changed, uppobj.data);

    default:
  }
}

function formChangedForContainer(changed, uppobj) {
  if (!uppobj || !changed) return;

  let res;
  changed.forEach(chItem => {
    if (uppobj[chItem.did] && uppobj[chItem.did][chItem.prop]) {
      const did = chItem.did;
      const prop = chItem.prop;
      if (did != '__template') {
        if (!res) res = {};
        if (!res[did]) res[did] = {};
        res[did][prop] = chItem.value;
      }
    }
  });
  // console.log('WARN: formChangedForContainer res='+util.inspect(res));
  // Для charts - по dn_prop
  /*
  charts: {
    'AD001.value': [ 'c006', 'c016' ],
    'AD002.value': [ 'c006', 'c016' ]
  }
  =>
  chartdata: {
    c006:{[D002.value]:{x:ts, y:val}
  }
  */

  let chartdata;
  if (uppobj.charts) {
    changed.forEach(chItem => {
      const dn_prop = chItem.dn + '.' + chItem.prop;
      const did_prop = chItem.did + '.' + chItem.prop;
      if (uppobj.charts[dn_prop]) {  // multiline графики - подписка на dn_prop
       
        if (!chartdata) chartdata = {};
        if (Array.isArray(uppobj.charts[dn_prop]) && uppobj.charts[dn_prop].length) {
          
          uppobj.charts[dn_prop].forEach(chartId => {
            if (!chartdata[chartId]) chartdata[chartId] = {};
            chartdata[chartId][dn_prop] = { x: chItem.ts, y: chItem.value };
          });
        } else if (uppobj.charts[did_prop] == did_prop) { // график с одним значением - подписка на did_prop
          
          chartdata[did_prop] = { x: chItem.ts, y: chItem.value };
        }  // здесь chartdata.__device не обрабатывается
      }
    });
  }

  if (!res && !chartdata) return;
  const retObj = {};
  if (res) retObj.data = res;
  if (chartdata) retObj.chartdata = chartdata;

  return retObj;
}

function formChangedForContext(changed, contextId) {
  if (!contextId || !changed) return;
  let res;
  const did = contextId;

  changed.forEach(chItem => {
    if (chItem.did == did) {
      if (!res) res = {};
      if (!res[did]) res[did] = {};
      // отправить все измененные свойства
      res[did][chItem.prop] = chItem.value;
    }
  });
  // console.log('WARN: formChangedForContent res=' + util.inspect(res));

  return res;
}

module.exports = {
  formMessageOnSub,
  formChangedForContext
};
