/**
 *  enginereq.js
 */

// const util = require('util');

const projectdata = require('./projectdata');
const virttables = require('../appspec/virttables');
const liststore = require('../dbs/liststore');

async function getWidgetdata(cmd, query, holder) {
  if (cmd != 'dialog') throw { err: 'SOFTERR', message: 'Unknown command in query for widgetdata: ' + cmd };
  const res = {};
  // Найти виджеты внутри диалога (элементы заданного типа)
  const wtypes = ['devicelog', 'devicesettings'];

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
    // return dobj.getExtPropsByScenes();

    default:
      return {};
  }
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

  /*
  {
  style: {
    margin: 8,
    padding: 16,
  },
  schema: [
    { prop: '_text', type: 'text', size: 14, color: 'red' },
    { prop: '_number', type: 'number', step: 10, min: 0, max: 100, size: 18, color: 'blue' },
    { prop: '_cb', type: 'cb', color: 'orange' },
    { prop: '_slider', type: 'slider', step: 10, min: 0, max: 100, },
    { prop: '_divider', type: 'divider', size: 1, color: 'grey', offsetTop: 16, offsetBottom: 16, },
    { prop: '_number2', type: 'number', title: 'Number:', step: 10, min: 0, max: 100, proportion: '55%' },
    { prop: '_cb2', type: 'cb', title: 'Checkbox:', proportion: '55%' },
    { prop: '_slider2', type: 'slider', title: 'Slider:', proportion: '25%', step: 10, min: 0, max: 100, },
  ],
  data: {
    _text: 'Hello world!',
    _number: 20,
    _cb: false,
    _slider: 20,
    _number2: 50,
    _cb2: true,
    _slider2: 50,
  },
}
  */

  const oneLineTypes = ['cb', 'number', 'time'];

  Object.keys(extPropsByScenes).forEach(scene => {
    // Получить название сценария, вывести отдельной строкой с разделителями
    addSceneHeader(scene);

    extPropsByScenes[scene].forEach(el => {
      const prop = el.name;
      const type = el.type;
      const titleProps = getTitleProps(el);
      if (oneLineTypes.includes(type)) {
        addOneLineItem(prop, el, dobj[prop], titleProps);
      } else {
        addText(el.note, titleProps);
        addItem(prop, el, dobj[prop]);
      }
      addDivider();
    });
  });
  return result;

  function getTitleProps(el) {
    const res = {};
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
    result.schema.push({ type: 'text', title:text, ...titleProps });
  }

  function addHeader(text) {
    result.schema.push({ type: 'text', title:text, titleBold: true });
  }

  function addOneLineItem(prop, el, value, titleProps) {
    
    const inputObj = {...getInputObject(prop, el), ...titleProps};
    inputObj.title = el.note;
    inputObj.proportion =  '55%'; // ???

    result.schema.push(inputObj);
    result.data[prop] = value;
  }

  function addItem(prop, el, value) {
    result.schema.push(getInputObject(prop, el));
    result.data[prop] = value;
  }


  function getInputObject(prop, el){
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
    return { prop, type: 'slider',  step, min, max};
  }

  function textItem(prop) {
    return { prop, type: 'text'};
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
