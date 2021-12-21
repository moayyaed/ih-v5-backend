/**
 *
 */

const util = require('util');
const crypto = require('crypto');
const { exec } = require('child_process');

let si;

module.exports = async function() {
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

  function get_hdd() {
    return new Promise((resolve) => {
      exec('lsblk -dro name,type,tran,serial', (error, stdout, stderr) => {
        if (error) {
          resolve({ serialNum: '' })
        } else {
          let serialNum = false;

          stdout.split('\n').slice(1).forEach(str => {
            const items = str.split(' ');

            if (serialNum === false) {
              if (
                items.length === 4 && 
                items[2] !== undefined && items[3] !== undefined && 
                items[2].toLocaleLowerCase() !== 'usb' &&
                items[3] !== '-' && items[3] !== ' '
              ) {
                serialNum = items[3];
              }
            }
          });

          if (serialNum && serialNum !== '-' && serialNum !== ' ') {
            resolve({ serialNum });
          } else {
            resolve({ serialNum: '' });
          }
        }
      });
    });
  }

  async function get_hw_id() {
    // const cpu_info = await si.cpu();
    const system_info = await si.system();
    const hdd_info = await get_hdd();
    const os_info = await si.osInfo();
    
    const hdd = hdd_info.serialNum;
    // const cpu = cpu_info.brand;
    const uuid = system_info.uuid;
    const serial = system_info.serial;
    const osuuid = system_info.model === 'Docker Container' ? os_info.serial : '';

    const params = [hdd, uuid, serial, osuuid];
    const check = params.map(i => (checkValue(i) ? '1' : '0')).join('');

    if (check === '0000') {
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
