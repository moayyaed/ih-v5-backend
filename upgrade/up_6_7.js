/**
 *
 */

const util = require('util');
const crypto = require('crypto');
const si = require('systeminformation');

async function hwid_Old() {
  try {
    si = require('systeminformation');
    const hwid = await get_hw_id();
    return hwid;
  } catch (e) {
    console.log('ERROR: hwid ' + util.inspect(e));
  }

  function checkValue(value) {
    return value && value !== '' && value !== '-' && value !== ' ';
  }

  async function get_hdd() {
    const disk = await si.diskLayout();
    const devices = await si.blockDevices();

    const hdd_list = disk.filter(i => checkValue(i.serialNum));

    if (hdd_list.length) {
      if (hdd_list.length === 1) {
        return hdd_list[0];
      }
      if (devices && devices.length && checkValue(devices[0].name)) {
        const device_name = devices[0].name;
        const found_hdd = disk.reduce((prev, item) => {
          if (prev === null) {
            if (checkValue(item.device)) {
              const disk_name = item.device;
              if (disk_name.length > device_name.length) {
                if (disk_name.indexOf(device_name) !== -1) {
                  return item;
                }
              } else if (device_name.indexOf(disk_name) !== -1) {
                return item;
              }
            }
          }
          return prev;
        }, null);
        if (found_hdd) {
          return found_hdd;
        }
      }
      return { serialNum: '' };
    }

    return { serialNum: '' };
  }

  async function get_hw_id() {
    // const cpu_info = await si.cpu();
    const system_info = await si.system();
    const hdd_info = await get_hdd();
    const os_info = await si.osInfo();
    const uuids = await si.uuid();
    
    const hdd = hdd_info.serialNum;
    // const cpu = cpu_info.brand;
    const uuid = system_info.uuid;
    const serial = system_info.serial;
    const osuuid = system_info.model === 'Docker Container' ? os_info.serial : '';

    const params = [hdd, uuid, serial, osuuid];
    const check = params.map(i => (checkValue(i) ? '1' : '0')).join('');

    if (check === '0000') {
      const mac = uuids.macs[0];
      if (mac) {
        const hash = crypto
          .createHash('sha256')
          .update(mac)
          .digest('hex');
        return `${hash}-9999`;
      }
      const hash = crypto
        .createHash('sha256')
        .update(os_info.serial)
        .digest('hex');
      return `${hash}-${check}`;
    }

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex');
    return `${hash}-${check}`;
  }
};
