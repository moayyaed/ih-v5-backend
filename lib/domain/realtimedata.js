/**
 * realtimedata.js
 */

const util = require('util');
const hut = require('../utils/hut');

function getUnitchannelsTableRtObject(unitItem, holder) {
  if (!unitItem || !unitItem.chano || !unitItem.chano.channels) return {};
  const robj = {};

  const unitChanObj = unitItem.chano;

  unitChanObj.charr.forEach(item => {
    robj[item.chan] = {
      realtime_chan_value: '',
      realtime_chan_ts: '',
      realtime_chan_chstatus: '',
      realtime_dev_value: '',
      realtime_dev_ts: '',
      realtime_dev_err: '',
      realtime_dev_cts: ''
    };

    if (unitChanObj.channels[item.chan]) {
      robj[item.chan].realtime_chan_val = unitChanObj.channels[item.chan].val;
      robj[item.chan].realtime_chan_ts = unitChanObj.channels[item.chan].ts;
      robj[item.chan].realtime_chan_chstatus = unitChanObj.channels[item.chan].chstatus;
    }

    if (item.did && item.prop && holder.devSet[item.did]) {
      const devRaw = holder.devSet[item.did]._raw;
      if (devRaw[item.prop]) {
        robj[item.chan].realtime_dev_val = devRaw[item.prop].val;
        robj[item.chan].realtime_dev_ts = devRaw[item.prop].ts;
        robj[item.chan].realtime_dev_cts = devRaw[item.prop].cts;
        robj[item.chan].realtime_dev_err = devRaw[item.prop].err;
      }
    }
  });
  return robj;
}

// function getDevicecommonTableRtObject(devItem, holder) {
async function getDevicecommonTableRtObject(dobj, holder) {
  if (!dobj) return {};
  const robj = {};

  // Внутри устройства по свойствам
  // const devRaw = devItem._raw;
  try {
    // const devRaw = await getDeviceRaw(dobj, holder);
    const devRaw = dobj._raw;
    Object.keys(devRaw).forEach(prop => {
      robj[prop] = {};
      robj[prop].realtime_dev_val = devRaw[prop].val;
      robj[prop].realtime_dev_fval = devRaw[prop].fval;
      robj[prop].realtime_dev_ts = devRaw[prop].ts;
      robj[prop].realtime_dev_cts = devRaw[prop].cts;
      robj[prop].realtime_dev_err = devRaw[prop].err;
    });

    return robj;
  } catch (e) {
    console.log('ERROR:  getDeviceRaw ' + util.inspect(e));
    return {};
  }
}

function getOneDevicePropRtObject(did, prop, holder) {
  const dobj = holder.devSet[did];
  if (!dobj || !dobj._raw || !dobj._raw[prop]) return {};
  return {
    dn: dobj.dn,
    realtime_dev_val: dobj._raw[prop].val,
    realtime_dev_fval: dobj._raw[prop].fval,
    realtime_dev_ts: dobj._raw[prop].ts > 0 ? hut.getDateTimeFor(new Date(dobj._raw[prop].ts)) : '',
    realtime_dev_cts: dobj._raw[prop].cts > 0 ? hut.getDateTimeFor(new Date(dobj._raw[prop].cts)) : '',
    realtime_dev_err: dobj._raw[prop].err
  };
}

module.exports = {
  getUnitchannelsTableRtObject,
  getDevicecommonTableRtObject,
  getOneDevicePropRtObject
}