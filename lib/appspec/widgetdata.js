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

  const oneLineTypes = ['cb'];

  Object.keys(extPropsByScenes).forEach(scene => {
    // Получить название сценария, вывести отдельной строкой с разделителями
    addSceneHeader(scene);

    extPropsByScenes[scene].forEach(el => {
      const prop = el.name;
      const type = el.type;
      if (oneLineTypes.includes(type)) {
        addOneLineItem(prop, el, dobj[prop]);
      } else {
        addText(prop + '_note', el.note);
        addItem(prop, el, dobj[prop]);
      }
    });
  });
  return result;

  function addSceneHeader(scene) {
    const sceneListItem = liststore.getItemFromList('sceneList', scene);
    const header = 'Сценарий ' + sceneListItem.name;
    const prop = scene + '_text';

    result.schema.push(divider());
    addText(prop, header);
    result.schema.push(divider());
  }

  function addText(prop, text) {
    result.schema.push({ prop, type: 'text', size: 14, color: 'red' });
    result.data[prop] = text;
  }

  function addOneLineItem(prop, el, value) {
    
    const inputObj = getInputObject(prop, el);
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
        return numberItem(prop, 1, 0, 100);      

      case 'cb':
        return cbItem(prop);
       
      case 'slider':
          return sliderItem(prop, 10, 0, 100);

      default:
        return textItem(prop);
    }
  }
  function numberItem(prop, step, min, max) {
    return { prop, type: 'number', step, min, max, size: 18, color: 'blue' };
  }

  function cbItem(prop, step, min, max) {
    return { prop, type: 'number', step, min, max, size: 18, color: 'blue' };
  }

  function sliderItem(prop, step, min, max) {
    return { prop, type: 'slider',  step, min, max};
  }

  function textItem(prop) {
    return { prop, type: 'text', size: 14, color: 'blue' };
  }
  function divider() {
    return { prop: '_divider', type: 'divider', size: 1, color: 'grey', offsetTop: 16, offsetBottom: 16 };
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
