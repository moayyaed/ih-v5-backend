/**
 * mobiledeviceutil.js
 */

const util = require('util');

const appconfig = require('../appconfig');
const typestore = require('../device/typestore');

// Создается запись при установке галки Использовать в мобильном
// Нужно проверить, что класс в типе задан. Иначе не пропускать!?
async function tryAddMobileDeviceDoc(id, dm) {
  const devDoc = await dm.findRecordById('device', id);
  if (!devDoc) throw { message: 'Not found device ' + id };

  const message = devDoc.dn + ': ' + appconfig.getMessage('NoMobileSetting');
  const mobiletypeDoc = await dm.findRecordById('mobiletype', devDoc.type);
  if (!mobiletypeDoc) throw { message };

  const { color0, image0, color1, image1, cl } = mobiletypeDoc;
  if (!cl || cl == '-') throw { message };

  const mobdevDoc = await dm.findRecordById('mobiledevice', id);

  // Если запись была и совпадает cl - оставить как есть иначе создать новую запись
  if (mobdevDoc && mobdevDoc.cl == cl) return;

  const subs = devDoc.tags && devDoc.tags.length ? devDoc.tags[0] : '';
  const placeItem = dm.datagetter.getDroplistItem('mobilePlaceList', devDoc.parent); // найти в списке
  const place_room = placeItem ? placeItem.id : '';

  return {
    _id: id,
    name: devDoc.name,
    cl,
    subs,
    place_room,
    color0,
    image0,
    color1,
    image1
  };
}
// Создается запись при установке галки Использовать в мобильном
// Нужно проверить, что класс в типе задан. Иначе не пропускать!?
async function upsertMobileDeviceDoc(id, dm) {
  const newdoc = await tryAddMobileDeviceDoc(id, dm);
  if (newdoc) {
    return dm.upsertDocs('mobiledevice', [newdoc]);
  }
}

function createMobileTypeDoc(type, dm) {
  const typeObj = typestore.getTypeObj(type);

  const res = {
    _id: type,

    stval: getProp('state'),
    aval: getProp('value'),
    defval: getProp('setpoint'),
    wmode: getProp('auto'),
    err: 'error',
    on: getCommand('on'),
    off: getCommand('off'),
    toggle: getCommand('toggle'),

    color0: 'transparent',
    image0: 'lamp101.svg',
    color1: 'transparent',
    image1: 'lamp101.svg'
  };
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
}

/**
 *
 * @param {*} dobj
 * @param {*} holder
 */
async function getDeviceSettingFromType(dobj, holder) {
  const type = dobj.type;
  const rec = await holder.dm.findRecordById('mobiletype', type);

  const pObj = rec && rec.props ? rec.props : '';
  if (!pObj) return [];
  const res = [];
  Object.keys(pObj).forEach(id => {
    const item = pObj[id];
    if (item && item.mobprop) {
      res.push({ id, prop: item.mobprop, type: item.widget, title: dobj.getPropTitle(item.mobprop) });
    }
  });
  return res;
}

function getDeviceSettingFromExt(dobj, holder) {}

module.exports = {
  upsertMobileDeviceDoc,
  tryAddMobileDeviceDoc,
  createMobileTypeDoc,
  getDeviceSettingFromType,
  getDeviceSettingFromExt
};
