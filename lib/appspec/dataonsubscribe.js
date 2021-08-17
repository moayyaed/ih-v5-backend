/**
 *  dataonsubscribe.js
 *  Формирует данные по подписке
 */

const util = require('util');

const projectdata = require('../appspec/projectdata');

async function formMessageOnSub(event, key, changed, holder) {
  let uppobj;
  switch (event) {
    case 'layout':
    case 'container':
    case 'dialog':
      uppobj = await projectdata.getCachedUpProjectObj({ id: event, nodeid: key }, holder.dm);
      // Для контейнера - отправить изменения переменных, связанных с устройствами и globals из changed
      return formChangedForContainer(changed, uppobj.data, holder);
    default:
  }
}

async function formDeviceLogOnSub(event, key, logobj, contextId, holder) {
  let uppobj;
  switch (event) {
    case 'layout':
    case 'container':
    case 'dialog':
      uppobj = await projectdata.getCachedUpProjectObj({ id: event, nodeid: key }, holder.dm);
      return formChangedDeviceLog(logobj, uppobj.data, contextId);
    default:
  }
}

function formChangedDeviceLog(logobj, uppobj, contextId) {
  if (!uppobj || !uppobj.devicelog || !logobj || !logobj.data) return;

  // uppobj = {TEMP1:'devicelog_1', __device:'devicelog_2', LAMP1:'devicelog_3'}
  const did = logobj.did;
  if (uppobj.devicelog[did]) return { [uppobj.devicelog[did]]: logobj.data };

  if (contextId && did == contextId) {
    return { [uppobj.devicelog.__device]: logobj.data };
  }
}

async function formAlertLogOnSub(event, key, logobj, subsAjarr, holder) {
  let uppobj;
  switch (event) {
    case 'layout':
    case 'container':
    case 'dialog':
      uppobj = await projectdata.getCachedUpProjectObj({ id: event, nodeid: key }, holder.dm);
      return formChangedAlertLog(logobj, uppobj.data, subsAjarr);
    default:
  }
}


function formChangedAlertLog(logobj, uppobj, subsAjarr) {
  if (!subsAjarr || !logobj) return;

  // logObj = {op:'add', payload:[..], ajarr:[] }
  // uppobj.alertlog.aj001 = alertlog_1
  let res = {};
  subsAjarr.forEach(ajId => {
    // logobj содержит  массив ajarr журналов, в которые нужно отправлять данные с учетом фильтров
    // Если массива нет - пишем во все??
    if (!logobj.ajarr || logobj.ajarr.includes(ajId)) {
      if (!res.alertdata) res.alertdata = {};
      res.alertdata[ajId] = logobj;
    }
  });

  return res.alertdata ? res : '';
}

/*
function formChangedAlertLog(logobj, uppobj, contextId) {
  if (!uppobj || !uppobj.alertlog || !logobj) return;

  // logObj = {op:'add', payload:[..], ajarr:[] }
  // uppobj.alertlog.aj001 = alertlog_1
  let res = {};
  Object.keys(uppobj.alertlog).forEach(ajId => {
    // logobj содержит  массив ajarr журналов, в которые нужно отправлять данные с учетом фильтров
    // Если массива нет - пишем во все??
    if (!logobj.ajarr || logobj.ajarr.includes(ajId)) {
      if (!res.alertdata) res.alertdata = {};
      res.alertdata[uppobj.alertlog[ajId]] = logobj;
    }
  });

  return res.alertdata ? res : '';
}
*/

function formChangedForContainer(changed, uppobj, holder) {
  if (!uppobj || !changed) return;

  let res;
  changed.forEach(chItem => {
    if (uppobj[chItem.did] && (uppobj[chItem.did][chItem.prop] || uppobj[chItem.did][chItem.prop + '#string'])) {
      const did = chItem.did;
      const prop = chItem.prop;
      if (did != '__template') {
        if (!res) res = {};
        if (!res[did]) res[did] = {};
        res[did][prop] = chItem.value;
        if (uppobj[chItem.did][chItem.prop + '#string']) {
          res[did][prop + '#string'] = chItem.fvalue != undefined ? chItem.fvalue : chItem.value;
        }
        /*
        if (uppobj[chItem.did][chItem.prop+'#string'] && holder.devSet[did]) {
          res[did][prop+'#string'] = holder.devSet[did].formatValue(prop, chItem.value);
        }
        */
      }
    }
  });

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
      if (uppobj.charts[dn_prop]) {
        // multiline графики - подписка на dn_prop
        if (!chartdata) chartdata = {};
        if (Array.isArray(uppobj.charts[dn_prop]) && uppobj.charts[dn_prop].length) {
          uppobj.charts[dn_prop].forEach(chartId => {
            if (!chartdata[chartId]) chartdata[chartId] = {};
            chartdata[chartId][dn_prop] = { x: chItem.ts, y: chItem.value };
          });
        }
      }

      if (uppobj.charts[did_prop] == did_prop) {
        // график с одним значением - подписка на did_prop
        if (!chartdata) chartdata = {};
        chartdata[did_prop] = { x: chItem.ts, y: chItem.value };
        // здесь chartdata.__device не обрабатывается
      }
    });
  }
  if (!res && !chartdata) return;

  const retObj = {};
  if (res) retObj.data = res;
  if (chartdata) retObj.chartdata = chartdata;
  return retObj;
}

async function formChangedForContext(changed, subsItem, holder) {
  if (!subsItem || !subsItem.contextId || !changed) return;

  let res;
  let resForChart = {};
  const did = subsItem.contextId;

  changed.forEach(chItem => {
    if (chItem.did == did) {
      if (!res) res = {};
      if (!res[did]) res[did] = {};
      // отправить все измененные свойства
      res[did][chItem.prop] = chItem.value;
      if (chItem.fvalue != undefined) {
        res[did][chItem.prop + '#string'] = chItem.fvalue;
      }

      /*
      if (holder.devSet[did] && holder.devSet[did].hasFormat(chItem.prop)) {
        const string = holder.devSet[did].formatValue(chItem.prop, chItem.value);
        if (string != undefined) {
          res[did][chItem.prop+'#string'] = string;
        }
      }
      */

      // Подготовить для графика, если есть
      const did_prop = chItem.did + '.' + chItem.prop;
      resForChart[did_prop] = { x: chItem.ts, y: chItem.value };
    }
  });

  let chartdata;

  // Если есть изменения для контекста -> Для подписок на контейнеры с contextId могут быть графики одиночные
  if (res) {
    const up = await projectdata.getCachedUpProjectObj({ id: subsItem.type, nodeid: subsItem.id }, holder.dm);
    const uppobj = up.data;

    if (uppobj && uppobj.charts && uppobj.charts.__device) {
      // uppobj.charts.__device = ['value', 'setpoint]
      Object.keys(res[did]).forEach(prop => {
        const did_prop = did + '.' + prop;
        if (uppobj.charts.__device.includes(prop) && resForChart[did_prop]) {
          if (!chartdata) chartdata = {};
          chartdata[did_prop] = resForChart[did_prop];
        }
      });
    }
  }
  if (!res && !chartdata) return;

  const retObj = {};
  if (res) retObj.data = res;
  if (chartdata) retObj.chartdata = chartdata;
  return retObj;
}

// => {method: "sub", type: "container", uuid: "l038_frame_1", id: "vc076", contextId: null, frames: ''}
async function formContainerSubConditionWithContext(mes, holder) {
  const res = { ...mes };
  const ajs = new Set();
  // Для контейнера найти элементы, которые требуют подписки
  // type:'alertlog'
  const uppobj = await projectdata.getCachedUpProjectObj({ id: 'container', nodeid: mes.id }, holder.dm);
  //  uppobj={data: { alertlog: { ajr002: 'ajr002', __alertjournal: '__alertjournal' } }

  // console.log('WARN: uppobj='+util.inspect(uppobj))

  if (!uppobj || !uppobj.data || !uppobj.data.alertlog) return res;

  // console.log('WARN: uppobj.alertlog='+util.inspect(uppobj.alertlog))

 
  // Для этих элементов м б жесткая привязка или __alertjournal (любой)
  // Жесткие привязки сохранить сразу
  let needContext;
  Object.keys(uppobj.data.alertlog).forEach(el => {
    if (el.startsWith('__')) {
      needContext = true;
    } else {
      ajs.add(el);
    }
  });

  if (needContext) {
    // Контекст взять из frames
    if (mes.frames) {
      const frame = getFirstFrame(mes.frames); // { vc, device, multichart_id, timelinechart_id, journal_id, alertjournal_id }
      if (frame && frame.alertjournal_id && frame.alertjournal_id.length > 1) {
        ajs.add(frame.alertjournal_id);
      }
    } else {
      // if (mes.layoutId) {
      // Если нет - то дефолтный из layout - widgetlinks для заданного фрейма
      // Временно извлекаю из uuid
      if (mes.uuid) {
        const layoutId = mes.uuid.substr(0, 4);
        const elementId = mes.uuid.substr(5);
        const dataObj = await projectdata.getCachedProjectObj('layout', layoutId, holder.dm);
        if (!dataObj) {
          console.log('WARN: Not found layout='+layoutId)
        } else {
        const defFrames = projectdata.gatherFramesWithWidgetlinksFromLayoutData(dataObj); // { id: name, title,  }
        if (defFrames) {
          defFrames.forEach(frame => {
            if (frame.id == elementId) {
              ajs.add(frame.alertjournal_id);
            }
          });
        }
        }
      }
    }
  }

  if (ajs.size) {
    res.ajarr = Array.from(ajs); // ['ajr001', 'ajr007'];
  }
  return res;
}

// frames - д б один элемент
async function getFirstFrame(frames) {
  let framesObj;
  if (frames && frames != 'null') {
    framesObj = projectdata.parseFrames(frames);
  }

  if (framesObj && Object.keys(framesObj).length > 0) {
    return framesObj[Object.keys(framesObj)[0]];
  }
}

module.exports = {
  formMessageOnSub,
  formChangedForContext,
  formDeviceLogOnSub,
  formAlertLogOnSub,
  formContainerSubConditionWithContext
};
