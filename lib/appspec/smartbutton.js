/**
 * smartbutton.js
 *
 */

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
  let dialognodeid = null;
  let value = '';
  let did = '';

  if (dataItem.did) {
    dialognodeid = dataItem.did;
    value = { did: dataItem.did, prop: dataItem.prop };

    // Здесь нужно имя устройства и имя свойства
    // Найти устройство: nodeid = devices._id
    const deviceDoc = await dm.dbstore.findOne('devices', { _id: dataItem.did });
    if (!deviceDoc) throw { error: 'ERR', message: 'Device not found: ' + dataItem.did };
    did = dataItem.did;
    title = datagetter.getDeviceTitle(did) + ' ▪︎ ' + dataItem.prop;
  }

  return {
    did,
    prop: dataItem.prop,
    title,
    dialognodeid,
    value,
    anchor: dataItem.unit + '.' + dataItem.chan
  };
}

// Показать связку Устройство - канал
// preNodeid='d0123.setpoint', rowid=devhard._id (но может и не быть!)
async function getSmartbuttonForChannellink(dataItem, preNodeid, rowid) {
  if (!preNodeid) return ''; // Это свойство нужно, используем как anchor!!

  let filter;
  if (rowid) {
    filter = { _id: rowid };
  } else if (preNodeid && datautil.isLink(preNodeid)) {
    const [did, prop] = preNodeid.split('.');
    filter = { did, prop };
  }

  let title = '';
  let value = '';

  if (filter) {
    const hrec = await dm.dbstore.findOne('devhard', filter);
    if (hrec) {
      title = hrec.unit + '.' + hrec.chan;
      value = { unit: hrec.unit, chan: hrec.chan };
    }
  }
  return { title, value, anchor: preNodeid };
}

module.exports = {
  get
};
