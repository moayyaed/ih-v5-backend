/**
 * sysinfo.js - sysinfo utils
 */

const util = require('util');
const fs = require('fs');
const os = require('os');

const hut = require('./hut');
const appconfig = require('../appconfig');

function isWindows() {
  return process.platform.substr(0, 3) == 'win';
}

function getPlatform() {
  return isWindows() ? 'windows' : process.platform;
}

function getNotCrossPluginFilename(pluginid) {
  let platform = getPlatform();
  let res = pluginid + '_' + platform + '_' + getArch();
  if (isWindows()) {
    res += '.exe';
  }
  return res;
}

function getArch() {
  let result;
  switch (process.arch) {
    case 'arm':
      result = 'arm';
      break;
    case 'ia32':
      result = '386';
      break;
    case 'x64':
      result = 'amd64';
      break;
    default:
      result = process.arch;
  }
  return result;
}

function getOsUptime() {
  return hut.timeFormat(Math.floor(os.uptime()));
  /*
  return hut.timeFormat(Math.floor(os.uptime()), [
    appconfig.getMessage('shortDay'),
    appconfig.getMessage('shortHour'),
    appconfig.getMessage('shortMin')
  ]);
  */
}

function getProcessUptime() {
  return hut.timeFormat(Math.floor(process.uptime()));
  /*
  return hut.timeFormat(Math.floor(process.uptime()), [
    appconfig.getMessage('shortDay'),
    appconfig.getMessage('shortHour'),
    appconfig.getMessage('shortMin')
  ]);
  */
}

function getCpuTemp() {
  try {
    let temp = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    if (isNaN(temp)) throw {};
    return String(Math.round(Number(temp) / 1000)) + 'ºС';
  } catch (e) {
    return '-';
  }
}

function getOsMemory() {
  let totalKb = Math.floor(os.totalmem() / 1024);
  let freeKb = Math.floor(os.freemem() / 1024);
  return memVal(totalKb) + ' / ' + memVal(freeKb);
}

function getIP() {
  let nobj;
  try {
    nobj = os.networkInterfaces();
    if (!nobj) return '';

    let result = '';
    Object.keys(nobj).forEach(elem => {
      if (Array.isArray(nobj[elem])) {
        nobj[elem].forEach(item => {
          if (!item.internal && item.address && item.family == 'IPv4') {
            result += item.address + '  ';
          }
        });
      }
    });
    return result;
  } catch (e) {
    return '';
  }
}

function memVal(val) {
  let gb;
  let mb = Math.floor((val / 1024) * 10) / 10;
  if (mb > 1024) gb = Math.floor((mb / 1024) * 10) / 10;
  return gb > 0 ? gb + ' Gb' : mb + ' Mb';
}

function getProcessMemoryRss() {
  Math.floor(os.totalmem() / 1024);
  return memVal(Math.floor(process.memoryUsage().rss / 1024));
}

function getProcessHeapTotal() {
  return memVal(Math.floor(process.memoryUsage().heapTotal / 1024));
}

function getProcessHeapUsed() {
  return memVal(Math.floor(process.memoryUsage().heapUsed) / 1024);
}

module.exports = {
  isWindows,
  getOsUptime,
  getProcessUptime,
  getOsMemory,
  getCpuTemp,
  getIP,
  getPlatform,
  getArch,
  getNotCrossPluginFilename,
  getProcessMemoryRss,
  getProcessHeapTotal,
  getProcessHeapUsed
};
