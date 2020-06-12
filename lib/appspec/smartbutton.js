/**
 * smartbutton.js
 *
 */

const util = require('util');
const dm = require('../datamanager');

const datautil = require('../api/datautil');
const datagetter = require('./datagetter');

/**
 *
 * @param {*} dialog
 * @param {*} dataItem
 * @param {*} nodeid
 */
async function get(dialog, dataItem, nodeid, rowid) {
  switch (dialog) {
    case 'devicelink':
      return getSmartbuttonForDevicelink(dataItem, nodeid);
    case 'channellink':
      return getSmartbuttonForChannellink(dataItem, nodeid, rowid);
    default:
      throw { err: 'SOFTERR', message: 'Unexpected params.dialog for type:"smartbutton": ' + dialog };
  }
}

async function getSmartbuttonForDevicelink(dataItem) {
  // if (!dataItem) throw { err: 'SOFTERR', message: 'Not found dataItem for devicelink, nodeid= ' + nodeid };
  let title = '';
  // let dialognodeid = null;
  let value = '';
  let did = '';
  let path = '';

  if (dataItem.did) {
    // dialognodeid = dataItem.did;
    value = { did: dataItem.did, prop: dataItem.prop };

    // Здесь нужно имя устройства и имя свойства
    // Найти устройство: nodeid = devices._id
    const deviceDoc = await dm.dbstore.findOne('devices', { _id: dataItem.did });
    if (!deviceDoc) throw { error: 'ERR', message: 'Device not found: ' + dataItem.did };
    did = dataItem.did;
    title = datagetter.getDeviceTitle(did) + ' ▪︎ ' + dataItem.prop;
    const linkobj = datagetter.getDeviceLinkObj(did);
    if (linkobj) path = linkobj.path;
  }

  return {
  //  did,
  //  prop: dataItem.prop,
    anchor: dataItem.unit + '.' + dataItem.chan,
    title,
  //  dialognodeid,
    value,
    path
  };
}

// Показать связку Устройство - канал
// preNodeid='d0123.setpoint', rowid=devhard._id (но может и не быть!)
async function getSmartbuttonForChannellink(dataItem, preNodeid, rowid) {
  // if (!preNodeid) return ''; // Это свойство нужно, используем как anchor!!
  if (!preNodeid || !datautil.isLink(preNodeid))
    throw { err: 'SOFTERR', message: 'Expected nodeid as link: ' + preNodeid };

  console.log('getSmartbuttonForChannellink dataItem = ' + util.inspect(dataItem));
  const [did, prop] = preNodeid.split('.');

  let value = "";
  let title = '';
  let path = '';
  let changed = false;

  if (datautil.isNewRecord(rowid)) {
    // Привязка к новому каналу, записи еще нет - unit и chan вытаскиваем из
    title = dataItem.unit + '.' + dataItem.chan;
    value = { did, prop };
  } else if (rowid == '__clear') {
    // 
  } else {
    const filter = rowid ? { _id: rowid } : { did, prop };

    const hrec = await dm.dbstore.findOne('devhard', filter);
    if (hrec) {
      title = hrec.unit + '.' + hrec.chan;
      const linkobj = datagetter.getChannelLinkObj(hrec._id, hrec.unit, hrec.chan);
      if (linkobj) path = linkobj.path;

      // Сравнить с тем, что есть фактически в БД? Или всегда при rowid выставлять changed?
      // changed = (did != hrec.did) || (prop != hrec.prop) ;
    } // Иначе привязки нет
  }
  changed = !!rowid;

  return {
    title,
    value,
    anchor: preNodeid,
    path,
    formreset: title ? { id: 'channellink', nodeid:preNodeid, rowid:"__clear" } : null,
    changed
  };
}

module.exports = {
  get
};
