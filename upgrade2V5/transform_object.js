/**
 * transform_object.js
 */

// const util = require('util');
// const fs = require('fs');
const path = require('path');

const hut = require('../lib/utils/hut');
const fut = require('../lib/utils/fileutil');
const appconfig = require('../lib/appconfig');

module.exports = function(srcData, from, to, devMan) {
  /*
  switch (to) {
    case 'container':
      return from == 'mnemosheme' ? fromMnemoToContainer() : '';
    case 'layout':
      return '';

    default:
  }
  */
  return fromMnemoToContainer();

  function fromMnemoToContainer() {
    const res = hut.clone(getPattern('container'));
    if (!res) return;
    const eleMap = {};

    let xx = 10;
    srcData.forEach(item => {
      const newtype = getNewType(item.type);
      const oneObj = transformOneMnemoItem(newtype, item, xx);
      if (oneObj) {
        // создать element_id и включить в elements и list
        const element_id = getNextElement_Id(newtype); // template_1
        res.elements[element_id] = oneObj;
        res.list.push(element_id);
        xx += 110;
      }
    });
    return res;

    function getNextElement_Id(newtype) {
      if (!eleMap[newtype]) {
        eleMap[newtype] = 1;
      } else eleMap[newtype] += 1;
      return newtype + '_' + eleMap[newtype];
    }

    function getNewType(type) {
      switch (type) {
        case 'device':
          return 'template';
        case 'img':
          return 'image';
        default:
      }
    }
  }

  function transformOneMnemoItem(newtype, item, xx) {
    if (item && item.type == 'device' && item.dn) {
      // формировать новый объект для type:device - Найти устройство в devMan, подготовить links
      if (devMan.getDevice(item.dn)) {
        const dobj = devMan.getDevice(item.dn);

        const robj = hut.clone(elementPattern[newtype]);
        // Выбрать templateId в зависимости от типа  //cherry@t200
        robj.templateId = 'cherry@t200';
        robj.title = 'cherry@t200';
        // Это в зависимости от типа
        robj.links = {
          state1: {
            did: dobj._id,
            prop: 'state', // В зависимости от нового св-ва
            dn: dobj.dn,
            title: dobj.dn + '.state',
            value: { did: dobj._id, prop: 'state' }
          }
        };
        
        if (dobj.type >= 500) {
          robj.actions.action_1.left.push(getDeviceAction("singleClickLeft", dobj._id, "toggle"));
        }

        // settings =>
        if (item.settings) {
          /*
          robj.w = { value: item.settings.w };
          robj.w2 = { value: item.settings.w };
          robj.h = { value: item.settings.h };
          robj.h2 = { value: item.settings.h };
          
          robj.x = { value: item.settings.x };
          robj.y = { value: item.settings.y };
          */

          robj.w = { value: 100 };
          robj.w2 = { value: 100 };
          robj.h = { value: 100 };
          robj.h2 = { value: 100 };

          robj.x = { value: xx };
          robj.y = { value: 10 };
        }

      
        return robj;
      }
    }
  }

  function getPattern(name) {
    const file = path.resolve(appconfig.get('sysbasepath'), 'pattern', name + '.json');
    return fut.readJsonFileSync(file);
  }
};

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
function getDeviceAction(action, did, prop) {
  return {
    action, // singleClickLeft',
    value: {},
    did,
    prop, // 'toggle'
    title: 'LAMP_1_1.toggle',
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
  }
};
