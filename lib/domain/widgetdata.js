/**
 *  widgetdata.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const projectdata = require('./projectdata');

// const liststore = require('../dbs/liststore');
const deviceutil = require('../device/deviceutil');
const domaindata = require('../domain/domaindata');
const mobiledeviceutil = require('../mobile/mobiledeviceutil');

// layout?id=l036&frames=frame_1,vc075,,c002,tc003,,&widgetdata=1
async function getWidgetdata(cmd, query, holder) {
  // if (cmd == 'containers') return getWidgetdataForContainers(query, holder);
  if (cmd == 'containers') return {}; // Этот запрос больше не используется
  if (cmd == 'layout') {
    query.layoutid = query.id;

    // То что стоит на экране + во фреймах
    const inFrames = await getWidgetdataForLayoutFrames(query, holder);
    const inLayout = await getWidgetdataForOne('layout', query, holder);
    return hut.merge(inFrames, inLayout);
  }

  return getWidgetdataFor(cmd, query, holder);
}

// frames - д б один элемент
async function getWidgetdataFor(cmd, query, holder) {
  let framesObj;
  let firstFrame;
  if (query.frames && query.frames != 'null') {
    framesObj = projectdata.parseFrames(query.frames);
  }

  if (framesObj && Object.keys(framesObj).length > 0) {
    firstFrame = framesObj[Object.keys(framesObj)[0]];
  }
  return getWidgetdataForOne(cmd, { ...firstFrame, id: query.id, contextId: query.contextId }, holder);
}

async function getWidgetdataForLayoutFrames(query, holder) {
  if (!query.layoutid) throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

  const resObj = {};
  const dataObj = await projectdata.getCachedProjectObj('layout', query.layoutid, holder.dm);
  const defFrames = projectdata.gatherFramesWithWidgetlinksFromLayoutData(dataObj); // { id: name, title,  }

  /* defFrames=[
  {
    id: 'frame_1',
    title: 'frame_1',
    containerId: 'vc157',
    device: {
      id: 'd0238',
      title: 'dance_air_temp ▪︎ Датчик температуры с уставкой'
    },
    multichart_id: '',
    timelinechart_id: '',
    journal_id: '',
    alertjournal_id: ''
  }
]

] */

  let framesObj;
  let contextId = query.contextId;
  if (query.frames && query.frames != 'null') {
    framesObj = projectdata.parseFrames(query.frames);
  }

  // Все frames экрана
  for (const frame of defFrames) {
    const frameId = frame.id;
    let id;
    let frameObj;
    if (framesObj && framesObj[frameId]) {
      // Передали в url
      //  { vc, device, multichart_id, timelinechart_id }
      id = framesObj[frameId].vc;
      frameObj = framesObj[frameId];

      if (!contextId && frameObj.device) contextId = frameObj.device;
    } else {
      id = frame.containerId;
      frameObj = frame;
      if (!contextId && frame.device && frame.device.id) contextId = frame.device.id;
    }

    if (id) {
      const data = await getWidgetdataForOne('container', { ...frameObj, id, contextId }, holder);
      resObj[frameId] = data;
    }
  }
  return resObj;
}

/*
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
*/

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
        if (doc.colors) fillColors(doc.colors);
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
      let id = elObj.widgetlinks.link.id;
      if (id == '__journal' && table == 'journal') {
        if (query.journal_id) {
          id = query.journal_id;
        }
      }
      if (id == '__alertjournal' && table == 'alertjournal') {
        if (query.alertjournal_id) {
          id = query.alertjournal_id;
        }
      }
      resObj.id = id;
      const doc = await holder.dm.findRecordById(table, id);

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
          resObj.columns.sort(hut.byorder('order'));
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
  // console.log('WARN: getOneWidgetData widgetType='+widgetType+' did='+did)

  switch (widgetType) {
    case 'devicelog':
      if (!did) return [];
      dobj = holder.devSet[did];
      if (!dobj) throw { message: 'Device not found:' + did };

      arr = await dm.datagetter.getVirttable('devicelogTable', {}, 'devicelog', did, '', holder);
      return arr.map(item => deviceutil.getLogTitleAndMessage(dobj, item)).filter(item => item.title && item.message);

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
  // console.log('WARN: getExtPropArrayByScenes '+dobj.dn);
  const extPropsByScenes = getExtPropsByScenes(dobj, holder); // {scen001:[{name, note,..}]}
  // console.log('WARN: getExtPropArrayByScenes '+dobj.dn+' extPropsByScenes='+util.inspect(extPropsByScenes));
  // let extPropsByScenes;

  const result = {
    style: {
      margin: 8,
      padding: 16
    },
    schema: [],
    data: {}
  };

  const oneLineTypes = ['cb', 'number', 'time'];
  // const oneLineTypes = [];
  if (extPropsByScenes) {
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
  }
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
    // const sceneListItem = liststore.getItemFromList('sceneList', scene);
    // const header = 'Сценарий ' + sceneListItem.name;
    const header = domaindata.getSceneStr(scene);

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
}

function getExtPropsByScenes(dobj, holder) {
  const devExtProps = dobj.extProps;
  if (!dobj || typeof devExtProps != 'object') return;
  const dn = dobj.dn;

  const res = {};
  Object.keys(devExtProps).forEach(prop => {
    if (devExtProps[prop].scenes.length > 0) {
      const id = devExtProps[prop].scenes[0]; // Всегда берем первый сценарий, где свойство упоминается
      if (holder.sceneExtprops[id] && holder.sceneExtprops[id][dn][prop] && holder.sceneExtprops[id][dn][prop]) {
        if (!holder.sceneExtprops[id][dn][prop].hide) {
          if (!res[id]) res[id] = [];
          res[id].push(holder.sceneExtprops[id][dn][prop]);
        }
      }
    }
  });
  return res;
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

    case 'input':
      return inputItem(prop);

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
  // return { prop, type: 'time', align: 'left' };
}

function inputItem(prop) {
  return { prop, type: 'input', align: 'right' };
  // return { prop, type: 'time', align: 'left' };
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
  return { type: 'divider', size: 1, color: 'grey', offsetTop: 4, offsetBottom: 16 };
}

async function getMobileWidgetdata(widgetname, dobj, holder) {
  let result;
  if (widgetname == 'devicesettingsV5') {
    result = {
      style: {
        margin: 8,
        padding: 16
      },
      schema: [],
      data: {}
    };

    // учесть флаги для устройства
    const mobdevDoc = await holder.dm.findRecordById('mobiledevice', dobj._id);
    const { typesetting, scenesetting } = mobdevDoc;

    if (typesetting) {
      // Получить свойства из mobiletype
      const elsFromType = await mobiledeviceutil.getDeviceSettingFromType(dobj, holder);
      elsFromType.forEach(el => {
        const titleProps = {};
        addOneLineItem(el.prop, el, titleProps);
        addDivider();
      });
    }

    if (scenesetting) {
      const extPropsByScenes = getExtPropsByScenes(dobj, holder);

      Object.keys(extPropsByScenes).forEach(scene => {
        extPropsByScenes[scene].forEach(item => {
          const prop = item.name;
          let title = item.note;
          let type = item.type;
          if (item.type == 'time') {
            type = 'number';
            title += ', ' + appconfig.getMessage('sec');
          }

          // const titleProps = getTitleProps(el);
          const titleProps = {};

          addOneLineItem(prop, { title, type }, titleProps);
          addDivider();
        });
      });
    }
    return result;
  }

  function addOneLineItem(prop, el, titleProps) {
    const dn = dobj.dn;
    const value = dobj[prop];
    const title = el.title;
    const inputObj = { dn, title, ...getInputObject(prop, el), ...titleProps };
    // inputObj.title = el.note;
    inputObj.proportion = '55%'; // ???

    result.schema.push(inputObj);
    result.data[prop] = value;
  }

  function addDivider() {
    result.schema.push(divider());
  }
}

/**
 * Артем Иванов, [16 авг. 2021 г., 12:19:48]:
const temp = {
  style: {
    margin: 8,
    padding: 16,
  },
  schema: [
    { type: 'text', title: 'Text', titleSize: 14, titleColor: 'black', titleBold: true, titleItalic: true },
    { type: 'divider', size: 1, color: 'grey', offsetTop: 8, offsetBottom: 12 },

    { type: 'text', title: 'Text Align: left', titleAlign: 'left' },
    { type: 'text', title: 'Text Align: center', titleAlign: 'center' },
    { type: 'text', title: 'Text Align: right', titleAlign: 'right' },

    { type: 'text', title: 'Text Color: red', titleColor: 'red' },
    { type: 'text', title: 'Text Size: 24', titleSize: 24 },

    { type: 'text', title: 'Number', titleSize: 14, titleColor: 'black', titleBold: true, titleItalic: true, offsetTop: 18 },
    { type: 'divider', size: 1, color: 'grey', offsetTop: 8, offsetBottom: 12 },

    { prop: 'number1', type: 'number'},
    { prop: 'number2', type: 'number', title: 'Number title:' },
    { prop: 'number3', type: 'number', title: 'Number title: 55%', proportion: '55%' },
    { prop: 'number4', type: 'number', title: 'Number range: 0-100', proportion: '55%', min: 0, max: 100 },
    { prop: 'number5', type: 'number', title: 'Number step: 10', proportion: '55%', step: 10 },

    { prop: 'number6', type: 'number', title: 'Number', proportion: '35%', align: 'left', size: 14, },
    { prop: 'number6', type: 'number', title: 'Number', proportion: '35%', align: 'center', size: 18, },
    { prop: 'number6', type: 'number', title: 'Number', proportion: '35%', align: 'right', size: 24, },

    { prop: 'number6', type: 'number', title: 'Number', proportion: '75%', titleAlign: 'left' },
    { prop: 'number6', type: 'number', title: 'Number', proportion: '75%', titleAlign: 'center' },
    { prop: 'number6', type: 'number', title: 'Number', proportion: '75%', titleAlign: 'right' },

    { prop: 'number6', type: 'number', title: 'Number', proportion: '75%', titleColor: 'red' },
    { prop: 'number6', type: 'number', title: 'Number', proportion: '75%', titleSize: 24 },
  
    { type: 'text', title: 'Checkbox', titleSize: 14, titleColor: 'black', titleBold: true, titleItalic: true,  offsetTop: 18 },
    { type: 'divider', size: 1, color: 'grey', offsetTop: 8, offsetBottom: 12 },
    
    { prop: 'checkbox1', type: 'cb', align: 'left' },
    { prop: 'checkbox1', type: 'cb', align: 'center'  },
    { prop: 'checkbox1', type: 'cb', align: 'right'  },

    { prop: 'checkbox2', type: 'cb', title: 'Checkbox title:' },
    { prop: 'checkbox2', type: 'cb', title: 'Checkbox title: 55%', proportion: '55%', align: 'left' },
    { prop: 'checkbox2', type: 'cb', title: 'Checkbox title: 55%', proportion: '55%', align: 'center' },
    { prop: 'checkbox2', type: 'cb', title: 'Checkbox title: 55%', proportion: '55%', align: 'right' },

    { prop: 'checkbox3', type: 'cb', title: 'Checkbox title: 85%', proportion: '85%', align: 'left', size: 14 },
    { prop: 'checkbox3', type: 'cb', title: 'Checkbox title: 85%', proportion: '85%', align: 'center', size: 18 },
    { prop: 'checkbox3', type: 'cb', title: 'Checkbox title: 85%', proportion: '85%', align: 'right', size: 24 },

    { prop: 'checkbox4', type: 'cb', title: 'Checkbox', proportion: '75%', titleAlign: 'left' },
    { prop: 'checkbox4', type: 'cb', title: 'Checkbox', proportion: '75%', titleAlign: 'center' },
    { prop: 'checkbox4', type: 'cb', title: 'Checkbox', proportion: '75%', titleAlign: 'right' },

    { prop: 'checkbox4', type: 'cb', title: 'Checkbox', proportion: '75%', titleColor: 'red' },
    { prop: 'checkbox4', type: 'cb', title: 'Checkbox', proportion: '75%', titleSize: 24 },

    { type: 'text', title: 'Slider', titleSize: 14, titleColor: 'black', titleBold: true, titleItalic: true,  offsetTop: 18 },
    { type: 'divider', size: 1, color: 'grey', offsetTop: 8, offsetBottom: 12 },

    { prop: 'slider1', type: 'slider' },

    { prop: 'slider2', type: 'slider', title: 'Slider 35%', proportion: '35%' },
    { prop: 'slider2', type: 'slider', title: 'Range: 0-100', proportion: '35%', min: 0, max: 100 },

    { prop: 'slider2', type: 'slider', title: 'Step: 10', proportion: '35%', step: 10, min: 0, max: 100 },
    { prop: 'slider2', type: 'slider', title: 'Marks: 10', proportion: '35%', step: 10, marks: true, min: 0, max: 100},

    { prop: 'slider3', type: 'slider', title: 'Slider', proportion: '60%', titleAlign: 'left' },
    { prop: 'slider4', type: 'slider', title: 'Slider', proportion: '60%', titleAlign: 'center' },
    { prop: 'slider5', type: 'slider', title: 'Slider', proportion: '60%', titleAlign: 'right' },

    { prop: 'slider6', type: 'slider', title: 'Slider', proportion: '60%', titleColor: 'red' },
    { prop: 'slider6', type: 'slider', title: 'Slider', proportion: '60%', titleSize: 24 },

    { type: 'text', title: 'Time', titleSize: 14, titleColor: 'black', titleBold: true, titleItalic: true,  offsetTop: 18 },
    { type: 'divider', size: 1, color: 'grey', offsetTop: 8, offsetBottom: 12 },

    { prop: 'time1', type: 'time' },
    { prop: 'time1', type: 'time', title: 'Time 0%' },
    { prop: 'time2', type: 'time', title: 'Time 45%', proportion: '45%'},
    { prop: 'time3', type: 'time', title: 'Time', proportion: '45%', align: 'left' },
    { prop: 'time3', type: 'time', title: 'Time', proportion: '45%', align: 'center' },
    { prop: 'time3', type: 'time', title: 'Time', proportion: '45%', align: 'right' },
  ],
  data: {
    number1: 0,
    number2: 10,
    number3: 30,
    number4: 50,
    number5: 50,
    number6: 0,
    checkbox1: false,
    checkbox2: true,
    checkbox3: false,
    checkbox4: false,
    slider1: 25,
    slider2: 50,
    slider3: 25,
    slider4: 50,
    slider5: 75,
    slider6: 45,
    time1: 0,
    time2: 10,
    time3: 30,
  },
};
 */

module.exports = {
  getWidgetdata,
  getMobileWidgetdata,
  getExtPropsByScenes
};
