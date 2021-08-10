/**
 *  widgetdata.js
 */

const util = require('util');

const projectdata = require('./projectdata');

const liststore = require('../dbs/liststore');
const deviceutil = require('../device/deviceutil');

// layout?id=l036&frames=frame_1,vc075,,c002,tc003,,&widgetdata=1
async function getWidgetdata(cmd, query, holder) {
  if (cmd == 'containers') return getWidgetdataForContainers(query, holder);
  if (cmd == 'layout') {
    query.layoutid = query.id;
    return getWidgetdataForFrames(query, holder);
  }
  return getWidgetdataForOne(cmd, query, holder);
}

async function getWidgetdataForFrames(query, holder) {
  if (!query.layoutid) throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

  const resObj = {};
  const dataObj = await projectdata.getCachedProjectObj('layout', query.layoutid, holder.dm);
  const defFrames = projectdata.gatherFramesWithWidgetlinksFromLayoutData(dataObj); // { id: name, title,  }

  console.log('WARN: query.frames='+util.inspect(query.frames)+'  defFrames='+util.inspect(defFrames))
  let framesObj;
  if (query.frames && query.frames != 'null') {
    framesObj = projectdata.parseFrames(query.frames);
  }
  console.log('WARN: getWidgetdataForFrames framesObj='+util.inspect(framesObj));

  // Все frames экрана
  for (const frame of defFrames) {
    const frameId = frame.id;
    let id;
    let frameObj;
    if (framesObj && framesObj[frameId]) {  // Передали в url
      //  { vc, device, multichart_id, timelinechart_id }
      id = framesObj[frameId].vc;
      frameObj = framesObj[frameId]
    } else {
      id = frame.containerId;
      frameObj = frame;
    }

    if (id) {
      const data = await getWidgetdataForOne('container', { id, ...frameObj}, holder);
      resObj[frameId] = data;
    }
    
  }
  return resObj;
}

async function getWidgetdataForContainers(query, holder) {
  if (!query.layoutid) throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

  const resObj = {};
  const dataObj = await projectdata.getCachedProjectObj('layout', query.layoutid, holder.dm);
  const ids = projectdata.gatherContainerIdsFromLayoutData(dataObj);

  for (const id of ids) {
    const data = await getWidgetdataForOne('container', { id }, holder);
    resObj[id] = data;
  }
  return resObj;
}

async function getWidgetdataForOne(cmd, query, holder) {
  const res = {};
  const pobj = await projectdata.getCachedProjectObj(cmd, query.id, holder.dm);

  if (!pobj.elements) throw { err: 'SOFTERR', message: 'Missing elements in ' + cmd + ' ' + query.id };

  for (const el of Object.keys(pobj.elements)) {
    if (pobj.elements[el] != null && typeof pobj.elements[el] == 'object' && pobj.elements[el].widget) {
      let did;
      if (pobj.elements[el].type == 'chart_multi') {
        res[el] = await getChartMetaData(pobj.elements[el]);
      } else if (pobj.elements[el].type == 'chart_timeline') {
        res[el] = await getChartTimelineMetaData(pobj.elements[el]);
      } else if (pobj.elements[el].type == 'journal') {
        res[el] = await getJournalMetaData(pobj.elements[el], 'journal', holder);
      } else if (pobj.elements[el].type == 'alertlog') {
        res[el] = await getJournalMetaData(pobj.elements[el], 'alertjournal', holder);
      } else {
        try {
          // Для каждого виджета сформировать данные
          did = getDidForWidget(pobj.elements[el], query.contextId);
          res[el] = await getOneWidgetData(pobj.elements[el].type, did, pobj.elements[el], holder);
        } catch (e) {
          console.log(
            'ERROR: getWidgetdataForOne did=' + did + ' query.contextId=' + query.contextId + util.inspect(e)
          );
        }
      }
    }
  }
  return res;

  async function getChartMetaData(elObj) {
    const resObj = {};
    if (elObj.widgetlinks && elObj.widgetlinks.link && elObj.widgetlinks.link.id) {
      // Вернуть описание графика
      let id = elObj.widgetlinks.link.id;
      if (id == '__chart') {
        if (query.multichart_id) {
          id = query.multichart_id;
        }
      }
      resObj.id = id; // id графика
      const doc = await holder.dm.findRecordById('chart', id);
      // const doc = await holder.dm.findRecordById('chart', elObj.widgetlinks.link.id);

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

  async function getChartTimelineMetaData(elObj) {
    const resObj = {};
    if (elObj.widgetlinks && elObj.widgetlinks.link && elObj.widgetlinks.link.id) {
      // Вернуть описание графика
      let id = elObj.widgetlinks.link.id;
      if (id == '__timelinechart') {
        if (query.timelinechart_id) {
          id = query.timelinechart_id;
        }
      }
      resObj.id = id; // id графика
      const doc = await holder.dm.findRecordById('timelinechart', id);

      if (doc) {
        resObj.lines = [];
        if (doc.props) {
          Object.keys(doc.props).forEach(prop => {
            if (!doc.props[prop].colorgroup) doc.props[prop].colorgroup = 'default';
            resObj.lines.push(doc.props[prop]);
          });
        }
        resObj.colors = {};
        if (doc.colors) fillColors(doc.colors) 
      }
    }
    return resObj;

    function fillColors(colors) {
      Object.keys(colors).forEach(id => {
        const item = colors[id];
        const colorgroup = item.colorgroup || 'default';
        if (!resObj.colors[colorgroup]) resObj.colors[colorgroup] = {};
        const state = item.state || '0';
        if (!resObj.colors[colorgroup][state]) resObj.colors[colorgroup][state] = item.color;
      });
    }
  }

  async function getJournalMetaData(elObj, table, holder) {
    const resObj = {};
    if (elObj.widgetlinks && elObj.widgetlinks.link && elObj.widgetlinks.link.id) {
      // Вернуть описание журнала
      const doc = await holder.dm.findRecordById(table, elObj.widgetlinks.link.id);

      if (doc) {
        resObj.name = doc.name;

        // Столбцы журнала
        resObj.columns = [];
        if (doc.props) {
          Object.keys(doc.props).forEach(prop => {
            if (prop) {
              resObj.columns.push(doc.props[prop]);
            }
          });
        } else {
          resObj.columns = holder.dm.datagetter.getDefaultJournalColumns(table);
        }

        resObj.color = {};
        resObj.fontcolor = {};
        const defFontColor = 'rgba(0,0,0,1)';
        // Цвета для раскраски по level
        if (doc.uselevelcolor) {
          const jlevelsId = table == 'alertjournal' ? 'alertjournalgroup' : doc.src;

          const rec = await holder.dm.findRecordById('jlevels', jlevelsId);
          if (rec && rec.props) {
            Object.keys(rec.props).forEach(prop => {
              const item = rec.props[prop];
              if (item.level != undefined) {
                if (item.color) resObj.color[item.level] = item.color;
                resObj.fontcolor[item.level] = item.fontcolor ? item.fontcolor : defFontColor;
              }
            });
          }
        }
      }
    }
    return resObj;
  }

  function getDidForWidget(elObj, contextId) {
    // Устройство м б в widgetlinks напрямую (жесткая привязка) или через contextId
    // Если жесткая привязка - то использовать ее иначе contextId
    if (
      elObj.widgetlinks &&
      elObj.widgetlinks.link &&
      elObj.widgetlinks.link.id &&
      elObj.widgetlinks.link.id != '__device'
    )
      return elObj.widgetlinks.link.id;
    if (contextId && contextId != 'undefined' && contextId != 'null') return contextId;
  }
}

async function getOneWidgetData(widgetType, did, elObj, holder) {
  let arr = [];

  let dobj = holder.devSet[did];
  const dm = holder.dm;

  switch (widgetType) {
    case 'devicelog':
      if (!did) return [];
      dobj = holder.devSet[did];
      if (!dobj) throw { message: 'Device not found:' + did };

      arr = await dm.datagetter.getVirttable('devicelogTable', {}, 'devicelog', did, '', holder);
      return arr.map(item => deviceutil.getLogTitleAndMessage(dobj, item));
    // return arr.map(item => deviceutil.getLogTitleAndMessage(dobj, item)).reverse();

    case 'devicesettings':
      if (!did) return [];
      dobj = holder.devSet[did];
      if (!dobj) throw { message: 'Device not found:' + did };

      // Вытащить параметры этого устройства, которые от сценариев, сгруппированные по сценариям
      return getExtPropArrayByScenes(dobj, holder);

    default:
      // Элементы для ввода - slider, checkbox,...
      return did && elObj.control ? getControlData(did, elObj, holder) : {};
  }
}

function getControlData(did, elObj, holder) {
  if (did.startsWith('gl')) {
    return { value: holder.global.getValue(did) };
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

module.exports = {
  getWidgetdata
};
