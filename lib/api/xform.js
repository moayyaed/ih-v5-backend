// const util = require('util');

const sysinfo = require('../utils/sysinfo');
const appconfig = require('../appconfig');

const info = {
  uptime: sysinfo.getProcessUptime,
  osUptime: sysinfo.getOsUptime,
  osMemory: sysinfo.getOsMemory,
  platform: sysinfo.getPlatform,
  arch: sysinfo.getArch,
  ip: sysinfo.getIP,
  cpuTemp: sysinfo.getCpuTemp,
  rss: sysinfo.getProcessMemoryRss,
  heapTotal: sysinfo.getProcessHeapTotal,
  heapUsed: sysinfo.getProcessHeapUsed,
  project: appconfig.get,
  port: appconfig.get,
  version: appconfig.get,
  newversion: appconfig.getNewversion,
  device: qRecords,
  devhard: qRecords,
  devhardtag: qRecords,
  type: qRecords,
  scenes: qRecords
};

/**
 *
 * @param {*} item
 */
async function getData(item, holder) {
  const prop = typeof item == 'object' ? item.prop : item;
  if (info[prop]) {
    const fun = info[prop];
    return fun(prop, holder);
  }

  //  console.log('WARN: xform, NOT FOUND prop '+prop)
}

async function qRecords(item, holder) {
  return holder.dm.qRecords(item);
}



module.exports = {
  getData
};
