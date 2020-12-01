/**
 *  widgetdata.js
 */

const util = require('util');

const dm = require('../datamanager');
const projectdata = require('./projectdata');
const virttables = require('../appspec/virttables');
const liststore = require('../dbs/liststore');

async function getWidgetdata(cmd, query, holder) {
  // if (cmd != 'dialog') throw { err: 'SOFTERR', message: 'Unknown command in query for widgetdata: ' + cmd };

  return cmd == 'containers' ? getWidgetdataForContainers(query, holder) : getWidgetdataForOne(cmd, query, holder);
}

async function getWidgetdataForContainers(query, holder) {
  if (!query.layoutid) throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

  const resObj = {};
  const dataObj = await projectdata.getCachedProjectObj('layout', query.layoutid);
  const ids = projectdata.gatherContainerIdsFromLayoutData(dataObj);

console.log('WARN: getWidgetdataForContainers '+ids.join(','))
  for (const id of ids) {
    const data = await getWidgetdataForOne('container', {id}, holder);
    resObj[id] = data;
  }
  return resObj;
}

async function getWidgetdataForOne(cmd, query, holder) {
  const res = {};
  const pobj = await projectdata.getCachedProjectObj(cmd, query.id);

  if (!pobj.elements) throw { err: 'SOFTERR', message: 'Missing elements in ' + cmd + ' ' + query.id };

  for (const el of Object.keys(pobj.elements)) {
    if (pobj.elements[el] != null && typeof pobj.elements[el] == 'object' && pobj.elements[el].widget) {
      let did;
      if (pobj.elements[el].type == 'chart_multi') {
        res[el] = await getChartMetaData(pobj.elements[el]);
      } else {
        try {
          // Для каждого виджета сформировать данные
          did = getDidForWidget(pobj.elements[el], query.contextId);
          res[el] = await getOneWidgetData(pobj.elements[el].type, did, pobj.elements[el], holder);
        } catch (e) {
          console.log('ERROR: getWidgetdataForOne did='+did+' query.contextId='+query.contextId +util.inspect(e))
        }
      }
    }
  }
  return res;

  async function getChartMetaData(elObj) {
    const resObj = {};
    if (elObj.widgetlinks && elObj.widgetlinks.link && elObj.widgetlinks.link.id) {
      // Вернуть описание графика
      const doc = await dm.findRecordById('chart', elObj.widgetlinks.link.id);

      if (doc) {
        // "name":"Температура и влажность","data_type":"trend","chart_type":"line","rightaxis":1,"discrete":"hour","leftaxis_title":"С","leftaxis_min":"0","leftaxis_max":"50","rightaxis_title":"%","rightaxis_min":"0","rightaxis_max":"100","props":{"":{"id":"","name":"Температура","legend":"C","linecolor":"","dn":"","prop":"","dn_prop":"vvv150.value"}}
        resObj.data_type = doc.data_type;
        resObj.chart_type = doc.chart_type;
        resObj.leftaxis_title = doc.leftaxis_title;
        resObj.leftaxis_min = doc.leftaxis_min;
        resObj.leftaxis_max = doc.leftaxis_max;
        resObj.rightaxis = doc.rightaxis;
        resObj.rightaxis_title = doc.rightaxis_title;
        resObj.rightaxis_min = doc.rightaxis_min;
        resObj.rightaxis_max = doc.rightaxis_max;
        resObj.lines = [];
        if (doc.props) {
          Object.keys(doc.props).forEach(prop => {
            if (prop) {
              resObj.lines.push(doc.props[prop]);
            }
          });
        }
      }
    }
    return resObj;
  }

  function getDidForWidget(elObj, contextId) {
    // Устройство м б в widgetlinks напрямую (жесткая привязка) или через contextId
    // Если жесткая привязка - то использовать ее иначе contextId
    if (elObj.widgetlinks && elObj.widgetlinks.link && elObj.widgetlinks.link.id && elObj.widgetlinks.link.id != '__device') return elObj.widgetlinks.link.id;
    if (contextId && contextId != 'undefined' && contextId != 'null') return contextId;
  }
}

async function getOneWidgetData(widgetType, did, elObj, holder) {
  let arr = [];

  let dobj = holder.devSet[did];
 

  switch (widgetType) {
    case 'devicelog':
      if (!did) return [];
      dobj = holder.devSet[did];
      if (!dobj) throw { message: 'Device not found:' + did };

      arr = await virttables.devicelogTable({}, 'devicelog', did);

      // item: {did, prop, val, realtime_ts}
      return arr
        .map(item => ({
          title: item.realtime_ts,
          message: getMessage(dobj, item, holder)
        }))
        .reverse(); // Первое сообщение наверху

    case 'devicesettings':
      if (!did) return [];
      dobj = holder.devSet[did];
      if (!dobj) throw { message: 'Device not found:' + did };

      // Вытащить параметры этого устройства, которые от сценариев, сгруппированные по сценариям
      return getExtPropArrayByScenes(dobj, holder);

    default:
      // Элементы для ввода - slider, checkbox,...
      return elObj.control ? getControlData(did, elObj, holder) : {};
  }

}

function getControlData(did, elObj, holder) {
  if (did.startsWith('gl')) {
    return {value:holder.glSet.getValue(did)};
  }

  const prop =
    elObj.widgetlinks && elObj.widgetlinks.link && elObj.widgetlinks.link.prop ? elObj.widgetlinks.link.prop : '';
  const dobj = holder.devSet[did];
  
  if (!dobj || !prop || dobj[prop] == undefined) return {};

  const res = { value: dobj[prop] };
  if (dobj.getMin(prop) != null) res.min = dobj.getMin(prop);
  if (dobj.getMax(prop) != null) res.max = dobj.getMax(prop);
  return res;
}

function getExtPropArrayByScenes(dobj, holder) {
  const extPropsByScenes = dobj.getExtPropsByScenes(); // {scen001:[{name, note,..}]}

  const result = {
    style: {
      margin: 8,
      padding: 16
    },
    schema: [],
    data: {}
  };

  const oneLineTypes = ['cb', 'number', 'time'];

  Object.keys(extPropsByScenes).forEach(scene => {
    // Получить название сценария, вывести отдельной строкой с разделителями
    addSceneHeader(scene);

    extPropsByScenes[scene].forEach(el => {
      const prop = el.name;
      const type = el.type;
      const titleProps = getTitleProps(el);
      if (oneLineTypes.includes(type)) {
        addOneLineItem(prop, el, titleProps);
      } else {
        addText(el.note, titleProps);
        addItem(prop, el);
      }
      addDivider();
    });
  });
  return result;

  function getTitleProps(el) {
    const res = {};
    if (el.size) res.size = el.size;
    if (el.titleSize) res.titleSize = el.titleSize;
    if (el.titleColor) res.titleColor = el.titleColor;
    if (el.titleBold) res.titleBold = el.titleBold;
    if (el.titleItalic) res.titleItalic = el.titleItalic;
    return res;
  }

  function addSceneHeader(scene) {
    const sceneListItem = liststore.getItemFromList('sceneList', scene);
    const header = 'Сценарий ' + sceneListItem.name;

    // addDivider();
    addHeader(header);
    addDivider();
  }

  function addDivider() {
    result.schema.push(divider());
  }

  function addText(text, titleProps) {
    result.schema.push({ type: 'text', title: text, ...titleProps });
  }

  function addHeader(text) {
    result.schema.push({ type: 'text', title: text, titleBold: true });
  }

  function addOneLineItem(prop, el, titleProps) {
    const did = dobj._id;
    const value = dobj[prop];
    const inputObj = { did, ...getInputObject(prop, el), ...titleProps };
    inputObj.title = el.note;
    inputObj.proportion = '55%'; // ???

    result.schema.push(inputObj);
    result.data[prop] = value;
  }

  function addItem(prop, el) {
    const did = dobj._id;
    const value = dobj[prop];
    const inputObj = { did, ...getInputObject(prop, el) };
    result.schema.push(inputObj);
    result.data[prop] = value;
  }

  function getInputObject(prop, el) {
    switch (el.type) {
      case 'number':
        return numberItem(prop, el);

      case 'cb':
        return cbItem(prop);

      case 'slider':
        return sliderItem(prop, el);

      case 'time':
        return timeItem(prop);

      default:
        return textItem(prop);
    }
  }

  function numberItem(prop, el) {
    const step = el.step || 1;
    const min = el.min || 0;
    const max = el.max || 100;
    return { prop, type: 'number', step, min, max };
  }

  function cbItem(prop) {
    return { prop, type: 'cb', align: 'right' };
  }

  function timeItem(prop) {
    return { prop, type: 'time', align: 'right' };
  }

  function sliderItem(prop, el) {
    const step = el.step || 1;
    const min = el.min || 0;
    const max = el.max || 100;
    return { prop, type: 'slider', step, min, max };
  }

  function textItem(prop) {
    return { prop, type: 'text' };
  }
  function divider() {
    return { type: 'divider', size: 1, color: 'grey', offsetTop: 16, offsetBottom: 16 };
  }
}

function getMessage(dobj, item, holder) {
  const prop = item.cmd ? item.cmd : item.prop;
  const title = dobj.getPropTitle(prop);

  // TODO - sender??
  if (item.cmd) return 'Команда ' + title;

  if (item.prop && item.val != undefined) return title + ': ' + item.val;

  //
  return '??';
}

module.exports = {
  getWidgetdata
};
