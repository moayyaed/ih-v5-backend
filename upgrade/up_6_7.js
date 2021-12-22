/**
 * Upgrade 5.6 => 5.7
 *
 * 1. Изменение алгоритма расчета hwid
 *    Проекты не затрагиваются
 *
 */

const util = require('util');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const si = require('systeminformation');
const https = require('https');

const newhwid = require('../lib/utils/hwid');
const appcrypto = require('../lib/utils/appcrypto');
const appconfig = require('../lib/appconfig');
const hut = require('../lib/utils/hut');

module.exports = async function(projectPath) {
  // Перенос private/users
  // console.log('INFO: Update privates');
  // transform(`${projectPath}/private`);

  try {
    const mainPath = appconfig.get('mainbasepath');
    const upLabel = path.join(mainPath, 'upgrade_v5_7.json');
    if (fs.existsSync(upLabel)) {
      console.log('INFO: System has already been updated 5.7');
      return;
    }

    const h_old = await get_hw_id();
    const h_new = await newhwid();
    if (h_old != h_new) {
      // Отправить на сервер!!
      upgrade_hwid(h_old, h_new)
        .then(res => {
          console.log('INFO: upgrade_hwid ' + res);
        })
        .catch(e => {
          console.log('ERROR: upgrade_hwid ' + util.inspect(e));
        });
      // Обработать лицензии
      await processLicenses(h_old, h_new);
    }
    return createUpLabel(upLabel, h_old, h_new);
  } catch (e) {
    console.log('ERROR: FAIL UPGRADE => 5.7 ' + util.inspect(e));
  }
};

async function createUpLabel(filename, o, n) {
  return fs.promises.writeFile(filename, JSON.stringify({ o, n }), 'utf8');
}

async function processLicenses(h_old, h_new) {
  const arr = appconfig.getLicenses();

  // item - зашифрованное содержимое файлов лицензий, key - номер
  for (const item of arr) {
    try {
      const decData = appcrypto.decrypt(item, h_old);
      const resObj = JSON.parse(decData);
      // {status: 1, payload: {id: 'qdHnMFRDF',key: '86b0ae73-79f1-44d5-a8ed-cffba40ae14d',
      // userid: 'cOV6GFDTgl', platform: 'intrahouse', product: 'module_multichart', startActivation: 1631184378930 }}

      if (!resObj || !resObj.payload || !resObj.payload.key) throw { message: 'Missing payload.key!' };

      const encData = appcrypto.encrypt(JSON.stringify(resObj), h_new);
      await appconfig.saveLicense(resObj.payload.key, encData);
    } catch (e) {
      console.log('ERROR: Upgrade =>5.7. Fail processLicenses ' + util.inspect(e));
    }
  }
}

// ------------------------------------------
// Старый метод расчета hwid
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

  // console.log('up_6_7: OLD ' + JSON.stringify(params));

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

function upgrade_hwid(prev, hwid) {
  return new Promise((resolve, reject) => {
    const data = new TextEncoder().encode(JSON.stringify({ prev, hwid }));

    const options = {
      hostname: 'license.ih-systems.com',
      port: 443,
      path: '/restapi/upgrade_hwid?sec=799hDIlfgP0kGBXULjVRLswnhuHybRIZ',
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, res => {
      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk;
      });

      res.on('end', () => {
        resolve(buffer);
      });
    });

    req.on('error', e => {
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

function transform(privatePath) {
  try {
    const filename = privatePath + '/users.db';
    const old = getFile(filename);
    const data = update(old);
    if (data) saveFile(filename, data);
  } catch (e) {
    const errStr = typeof e == 'object' && e.message ? e.message : util.inspect(e);
    console.log('ERROR: Upgrade project, file ' + path + ': ' + errStr + '. Skipped');
  }
}

function getFile(filename) {
  return fs.readFileSync(filename, 'utf8');
}

function update(data) {
  if (!data) return;

  const lines = data.split('\n');
  const recObj = {};
  try {
    lines.forEach(line => {
      const str = hut.allTrim(line);
      if (str) {
        const obj = JSON.parse(str);
        if (obj && obj._id) {
          if (obj.pwd) {
            obj.pwdx = Buffer.from(obj.pwd).toString('base64');
          }
          recObj[obj._id] = obj;
        }
      }
    });

    let res = '';
    Object.keys(recObj).forEach(id => {
      res += JSON.stringify(recObj[id]) + '\n';
    });
    return res;
  } catch (e) {
    console.log('ERROR: Fail update users.db! ' + util.inspect(e));
  }
}

function saveFile(filename, data) {
  fs.writeFileSync(filename, data, 'utf8');
}
