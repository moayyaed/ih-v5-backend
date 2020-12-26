/**
 * transform_object.js
 */

const util = require('util');
// const fs = require('fs');
const path = require('path');

const hut = require('../lib/utils/hut');
const fut = require('../lib/utils/fileutil');
const appconfig = require('../lib/appconfig');
const tut = require('./transfer_utils');

/**
 *
 * @param {Object} listItem  { "id": "1", "name": "Меню", "width": 140, "height": 760 }
 */
module.exports = function(srcData, from, to, devMan, listItem) {
  switch (to) {
    case 'container':
      return fromContainer();
    case 'layout':
      return fromLayout();
    default:
  }

  function fromLayout() {
    const res = hut.clone(getPattern('layout'));
    if (!res) return;
    const eleMap = {};

    // Это взять из listItem
    res.settings.w.value = listItem.width;
    res.settings.h.value = listItem.height;
    res.settings.backgroundImage.value = listItem.img;

    srcData.forEach(item => {
      const oneObj = transformOnLayoutItem(item);
      if (oneObj) {
        setSettings(oneObj, item);
        // создать element_id и включить в elements и list
        const type = oneObj.type == 'container' ? 'frame' : oneObj.type;
        const element_id = getNextElement_Id(eleMap, type); // frame_1
        res.elements[element_id] = oneObj;
        res.list.push(element_id);
      }
    });
    return res;
  }

  //   "type": "WIDGET_USER",
  //   "settings": { "w": 70, "h": 260, "zIndex": 100, "itemId": "2", "x": 20, "y": 100 },
  function transformOnLayoutItem(item) {
    if (!item && !item.type) return;
    switch (item.type) {
      case 'WIDGET_USER':
        return formFrameForWidget(item);
      case 'WIDGET_MNEMOSCHEMES':
        return formFrameForMnemo(item);
      default:
    }
  }

  function formFrameForWidget(item) {
    const robj = hut.clone(elementPattern.frame);
    robj.widget = true;
    const id = tut.formNewObjectId('widgets', item.settings.itemId);
    robj.widgetlinks = {
      link: { id, title: id }
    };
    return robj;
  }

  function formFrameForMnemo(item) {
    //  "params": { "name": "", "defmnemo": "2" }
    const robj = hut.clone(elementPattern.frame);
    robj.widget = true;
    const id = tut.formNewObjectId('mnemoschemes', item.params.defmnemo);
    robj.widgetlinks = {
      link: { id, title: id }
    };
    return robj;
  }

  function fromContainer() {
    const res = hut.clone(getPattern('container'));
    if (!res) return;
    const eleMap = {};

    // Это взять из listItem
    res.settings.w.value = listItem.width;
    res.settings.h.value = listItem.height;
    srcData.forEach(item => {
      const oneObj = transformOneMnemoItem(item);
      if (oneObj) {
        setSettings(oneObj, item);
        // создать element_id и включить в elements и list
        const element_id = getNextElement_Id(eleMap, oneObj.type); // template_1
        res.elements[element_id] = oneObj;
        res.list.push(element_id);
      }
    });
    return res;

    function transformOneMnemoItem(item) {
      if (!item && !item.type) return;
      switch (item.type) {
        case 'img':
          return formImg(item);

        case 'button':
          return formButton(item);

        case 'device':
          if (!item.dn || !devMan.getDevice(item.dn)) {
            console.log('ERROR: Transfer device. Missing dn in ' + util.inspect(item));
            return;
          }
          return item.params.view == 'icon' ? formDeviceWithTemplate(item) : formDeviceWithText(item);
        default:
      }
    }

    function formImg(item) {
      const robj = hut.clone(elementPattern.image);
      if (item.elementStyle.img) robj.img = { value: item.elementStyle.img };
      return robj;
    }

    function formButton(item) {
      const robj = hut.clone(elementPattern.button);
      robj.img = { value: item.elementStyle.img };
      robj.text = { value: item.elementStyle.text };
      return robj;
    }

    function formDeviceWithText(item) {
      const dobj = devMan.getDevice(item.dn);
      const robj = hut.clone(elementPattern.text);
      robj.text.value = '00.00';
      robj.text.did = dobj._id;
      robj.text.prop = 'value';
      robj.text.title = dobj.dn + '.value';
      robj.text.func = 'return inData;'; // Можно добавить единицу измерения если есть
      robj.text.text = dobj.dn;
      return robj;
    }

    function formDeviceWithTemplate(item) {
      const dobj = devMan.getDevice(item.dn);
      const robj = hut.clone(elementPattern.template);

      // Выбрать templateId в зависимости от типа  //cherry@t200
      robj.templateId = 'cherry@t' + dobj.oldtype;
      robj.title = robj.templateId;
      if (dobj.oldtype < 200) {
        // Это в зависимости от типа - state3
        robj.links.state3 = getLinkObj(dobj, dobj._id, 'state');
      } else if (dobj.oldtype < 300) {
        robj.links.state1 = getLinkObj(dobj, dobj._id, 'setpoint');
        robj.links.state3 = getLinkObj(dobj, dobj._id, 'value');
      } else {
        robj.links.state1 = getLinkObj(dobj, dobj._id, 'state');
      }

      if (dobj.oldtype >= 500) {
        robj.actions.action_1.left.push(getDeviceAction('singleClickLeft', dobj, 'toggle'));
      }
      return robj;
    }
  }
};

function setSettings(newObj, item) {
  if (item.settings) {
    newObj.w = { value: item.settings.w };
    newObj.w2 = { value: item.settings.w };
    newObj.h = { value: item.settings.h };
    newObj.h2 = { value: item.settings.h };

    newObj.x = { value: item.settings.x };
    newObj.y = { value: item.settings.y };
    newObj.zIndex = { value: item.settings.zIndex };
  } else {
    console.log('ERROR: transfer ' + util.inspect(item) + '. No settings!');
  }
}

function getNextElement_Id(eleMap, newtype) {
  if (!eleMap[newtype]) {
    eleMap[newtype] = 1;
  } else eleMap[newtype] += 1;
  return newtype + '_' + eleMap[newtype];
}

function getLinkObj(dobj, did, prop) {
  return { did, prop, dn: dobj.dn, title: dobj.dn + prop, value: { did, prop } };
}

function getPattern(name) {
  const file = path.resolve(appconfig.get('sysbasepath'), 'pattern', name + '.json');
  return fut.readJsonFileSync(file);
}

/*
  {
    "action": "singleClickLeft",
    "value": {},
    "did": "d0066",
    "prop": "toggle",
    "title": "LAMP_1_1.toggle",
    "command": "device"
  },
  {
    "action": "longClickLeft",
    "value": {}
  }
*/
function getDeviceAction(action, dobj, prop) {
  return {
    action, // singleClickLeft',
    value: {},
    did: dobj._id,
    prop, // 'toggle'
    title: dobj.dn + '.' + prop,
    command: 'device'
  };
}

const elementPattern = {
  template: {
    animation: {},
    zIndex: {
      value: 100
    },
    opacity: {
      value: 100
    },
    visible: {
      value: true
    },
    overflow: {
      value: true
    },
    type: 'template',
    x: {
      value: 102
    },
    y: {
      value: 101
    },
    w: {
      value: 250
    },
    h: {
      value: 250
    },
    w2: {
      value: 250
    },
    h2: {
      value: 250
    },
    links: {},
    templateId: '',
    title: '',
    actions: {
      type: 'multi',
      action_1: {
        left: [],
        right: []
      }
    }
  },
  image: {
    img: {
      folder: 'img12',
      value: 'animals120.svg'
    },
    imgColor: {
      type: 'fill',
      value: 'transparent',
      fill: 'transparent',
      angle: 90,
      shape: 'circle',
      positionX: 50,
      positionY: 50,
      extent: 'closest-side',
      palette: [
        {
          offset: '0.00',
          color: '#4A90E2',
          opacity: 1
        },
        {
          offset: '1.00',
          color: '#9013FE',
          opacity: 1
        }
      ]
    },
    imgSize: {
      value: 0
    },
    imgRotate: {
      value: 0
    },
    borderSize: {
      value: 1
    },
    borderRadius: {
      value: 0
    },
    borderStyle: {
      value: {
        id: 'solid',
        title: 'Solid'
      }
    },
    borderColor: {
      value: 'rgba(0,0,255,1)'
    },
    backgroundColor: {
      type: 'fill',
      value: 'transparent',
      fill: 'transparent',
      angle: 90,
      shape: 'circle',
      positionX: 50,
      positionY: 50,
      extent: 'closest-side',
      palette: [
        {
          offset: '0.00',
          color: '#4A90E2',
          opacity: 1
        },
        {
          offset: '1.00',
          color: '#9013FE',
          opacity: 1
        }
      ]
    },
    rotate: {
      value: 0
    },
    animation: {},
    flipH: {
      value: false
    },
    flipV: {
      value: false
    },
    boxShadow: {
      active: false,
      value: '2px 2px 4px 0px #000000'
    },
    zIndex: {
      value: 100
    },
    opacity: {
      value: 100
    },
    visible: {
      value: true
    },
    overflow: {
      value: true
    },
    type: 'image',
    x: {
      value: 298
    },
    y: {
      value: 170
    },
    w: {
      value: 140
    },
    h: {
      value: 90
    },
    w2: {
      value: 140
    },
    h2: {
      value: 90
    }
  },

  text: {
    text: {
      value: 'Text 1',
      enabled: true,
      did: 'd0031',
      prop: 'value',
      title: 'STEMP1.value',
      func: 'return inData;',
      text: 'Text 1'
    },
    textSize: { value: 14 },
    textBold: { value: 0 },
    textItalic: { value: 0 },
    textFontFamily: { value: { id: 'Arial', title: 'Arial' } },
    textAlignH: { value: { id: 'center', title: 'Center' } },
    textAlignV: { value: { id: 'center', title: 'Center' } },
    textRotate: { value: 0 },
    textColor: { value: 'rgba(0,0,0,1)' },
    borderSize: { value: 1 },
    borderRadius: { value: 0 },
    borderStyle: { value: { id: 'solid', title: 'Solid' } },
    borderColor: { value: 'rgba(0,255,0,1)' },
    backgroundColor: {
      type: 'fill',
      value: 'transparent',
      fill: 'transparent',
      angle: 90,
      shape: 'circle',
      positionX: 50,
      positionY: 50,
      extent: 'closest-side',
      palette: [
        { offset: '0.00', color: '#4A90E2', opacity: 1 },
        { offset: '1.00', color: '#9013FE', opacity: 1 }
      ]
    },
    rotate: { value: 0 },
    animation: {},
    flipH: { value: false },
    flipV: { value: false },
    boxShadow: { active: false, value: '2px 2px 4px 0px #000000' },
    zIndex: { value: 100 },
    opacity: { value: 100 },
    visible: { value: true },
    overflow: { value: true },
    type: 'text',
    x: { value: 390 },
    y: { value: 200 },
    w: { value: 120 },
    h: { value: 60 },
    w2: { value: 120 },
    h2: { value: 60 }
  },
  button: {
    text: {
      value: ''
    },
    textSize: {
      value: 14
    },
    textBold: {
      value: 0
    },
    textItalic: {
      value: 0
    },
    textFontFamily: {
      value: {
        id: 'Arial',
        title: 'Arial'
      }
    },
    textAlignH: {
      value: {
        id: 'center',
        title: 'Center'
      }
    },
    textAlignV: {
      value: {
        id: 'center',
        title: 'Center'
      }
    },
    textRotate: {
      value: 0
    },
    textColor: {
      value: 'rgba(0,0,0,1)'
    },
    img: {
      folder: 'img6',
      value: 'valve310.svg'
    },
    imgColor: {
      value: 'transparent'
    },
    imgSize: {
      value: 0
    },
    imgRotate: {
      value: 0
    },
    borderSize: {
      value: 1
    },
    borderRadius: {
      value: 0
    },
    borderStyle: {
      value: {
        id: 'solid',
        title: 'Solid'
      }
    },
    borderColor: {
      value: 'rgba(139,87,42,1)'
    },
    backgroundColor: {
      type: 'fill',
      value: 'transparent',
      fill: 'transparent',
      angle: 90,
      shape: 'circle',
      positionX: 50,
      positionY: 50,
      extent: 'closest-side',
      palette: [
        {
          offset: '0.00',
          color: '#4A90E2',
          opacity: 1
        },
        {
          offset: '1.00',
          color: '#9013FE',
          opacity: 1
        }
      ]
    },
    rotate: {
      value: 0
    },
    animation: {},
    flipH: {
      value: false
    },
    flipV: {
      value: false
    },
    boxShadow: {
      active: false,
      value: '2px 2px 4px 0px #000000'
    },
    zIndex: {
      value: 100
    },
    opacity: {
      value: 100
    },
    visible: {
      value: true
    },
    overflow: {
      value: true
    },
    colorRipple: {
      value: 'rgba(255,255,255,1)'
    },
    colorHover: {
      value: 'rgba(0,0,0,0.2)'
    },
    actions: {
      left: [
        {
          action: 'singleClickLeft',
          value: {}
        },
        {
          action: 'doubleClickLeft',
          value: {}
        },
        {
          action: 'longClickLeft',
          value: {}
        },
        {
          action: 'mouseDownLeft',
          value: {}
        },
        {
          action: 'mouseUpLeft',
          value: {}
        }
      ],
      right: [
        {
          action: 'singleClickRight',
          value: {}
        }
      ]
    },
    type: 'button',
    x: {
      value: 244
    },
    y: {
      value: 130
    },
    w: {
      value: 170
    },
    h: {
      value: 50
    },
    w2: {
      value: 170
    },
    h2: {
      value: 50
    }
  },
  frame: {
    fitW: {
      value: true
    },
    fitH: {
      value: true
    },
    alignW: {
      value: {
        id: 'center',
        title: 'Center'
      }
    },
    alignH: {
      value: {
        id: 'center',
        title: 'Center'
      }
    },
    scrollX: {
      value: false
    },
    scrollY: {
      value: false
    },
    animation: {},
    zIndex: {
      value: 100
    },
    opacity: {
      value: 100
    },
    visible: {
      value: true
    },
    overflow: {
      value: true
    },
    widget: true,
    widgetlinks: {
      link: {
        id: 'wdg002',
        title: 'меню '
      }
    },
    data: {},
    type: 'container',
    x: {
      value: 0
    },
    y: {
      value: 0
    },
    w: {
      value: 50
    },
    h: {
      value: 50
    },
    w2: {
      value: 50
    },
    h2: {
      value: 50
    }
  }
};
