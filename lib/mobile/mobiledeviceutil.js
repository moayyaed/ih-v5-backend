/**
 * mobiledeviceutil.js
 */

const util = require('util');

const typestore = require('../device/typestore');

//  doc={ _id: 'R5Rb42czE', order: 4000, parent: 'mobiledevicegroup' }
//  popupid: 'd0025',
async function createMobileDeviceDoc(doc, popupid, dm) {
  const devDoc = await dm.findRecordById('device', popupid);
  if (!devDoc) throw { message: 'Not found device ' + popupid };

  const typeObj = typestore.getTypeObj(devDoc.type);

  const res = {
    _id: doc._id,
    parent: doc.parent,
    order: doc.order,
    did: popupid,
    dn: devDoc.dn,
    title: devDoc.dn,
    name: devDoc.name,
    stval: getProp('state'),
    aval: getProp('value'),
    defval: getProp('setpoint'),
    wmode: getProp('auto'),
    err:'error',
    on: getCommand('on'),
    off: getCommand('off'),
    toggle: getCommand('toggle'),
    /*
    props: {
      stval: 'state',
      wmode: 'auto',
      on: 'on',
      off: 'off',
      toggle: 'toggle'
    },
    */
    color0: 'transparent',
    image0: 'lamp101.svg',
    color1: 'transparent',
    image1: 'lamp101.svg'
  };

  res.cl = getV4Cl(doc);
  console.log('RES='+util.inspect(res));

  return res;

  function getProp(prop) {
    if (typeObj) {
      if (typeObj.props[prop]) return prop;
    }
    return '';
  }

  function getCommand(cmd) {
    if (typeObj) {
      if (typeObj.commands && typeObj.commands.length) {
        if (typeObj.props[cmd]) return cmd;
      }
    }
    return '';
  }

  function getV4Cl() {
    if (res.on && res.stval) {
      return res.value ? 'ActorA' : 'ActorD';
    }
    return res.aval ? 'SensorA' : 'SensorD';
  }
}

module.exports = {
  createMobileDeviceDoc
};
