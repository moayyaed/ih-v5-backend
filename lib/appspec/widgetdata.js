/**
 *  enginereq.js
 */

// const util = require('util');

const projectdata = require('./projectdata');
const virttables = require('../appspec/virttables');



async function getWidgetdata(cmd, query, holder) {
  if (cmd != 'dialog') throw { err: 'SOFTERR', message: 'Unknown command in query for widgetdata: ' + cmd };
  const res = {};
  // Найти виджеты внутри диалога (элементы заданного типа)
  const wtypes = ['devicelog'];

  const pobj = await projectdata.getCachedProjectObj(cmd, query.id);

  if (!pobj.elements) throw { err: 'SOFTERR', message: 'Missing elements in ' + cmd + ' ' + query.id };

  for (const el of Object.keys(pobj.elements)) {
    if (
      pobj.elements[el] != null &&
      typeof pobj.elements[el] == 'object' &&
      pobj.elements[el].type &&
      wtypes.includes(pobj.elements[el].type)
    ) {
      // Для каждого виджета сформировать данные
      // Устройство м б в widgetlinks напрямую или через contextId
      const did = await getDidForWidget(pobj.elements[el]);
      res[el] = await getOneWidgetData(pobj.elements[el].type, did, holder);
    }
  }
  return res;

  async function getDidForWidget(elObj) {
    if (elObj.widgetlinks && elObj.widgetlinks.link) {
      let wdid;

      /* "widgetlinks": {
            "link": {
              "prop": "state",
              "title": "template.state",
              "value": {
                "did": "vt085",
                "prop": "state1",
                "template": true
              }
            }
      */

      if (elObj.widgetlinks.link.title && elObj.widgetlinks.link.title.startsWith('template.')) {
        // Искать по контексту
        // const prop = elObj.widgetlinks.link.prop;
        const prop = elObj.widgetlinks.link.value.prop;
        const dids = await projectdata.getDidsFromLinksByContext(query);
        // нужен link для prop?
        wdid = dids[prop];
      } else {
        wdid = elObj.widgetlinks.link.did;
      }
      return wdid;
    }
  }
}

async function getOneWidgetData(widget, did, holder) {
  // Для каждого виджета сформировать данные
  // Устройство м б в widgetlinks напрямую или через contextId
  let arr = [];

  let dobj = holder.devSet[did];

  switch (widget) {
    case 'devicelog':
    
      // if (!did) throw {message:'Device id not assigned!'}
      if (!did)  return [];
      dobj = holder.devSet[did];
      if (!dobj) throw {message:'Device not found:'+did}
      
      arr = await virttables.devicelogTable({}, 'devicelog', did);
      
      // item: {did, prop, val, realtime_ts}
      return arr.map(item => ({
        title: item.realtime_ts,
        message: getMessage(dobj, item, holder)
      })).reverse();  // Первое сообщение наверху

    default:
      return {};
  }
}

function getMessage(dobj, item, holder) {
  const prop = item.cmd ?  item.cmd : item.prop;
  const title = dobj.getPropTitle(prop);

  // TODO - sender??
  if (item.cmd) return 'Команда ' + title;
 
  if (item.prop && item.val != undefined) return title + ': ' + item.val;
  
  //  
  return '??';
}

module.exports = {
  getWidgetdata
}