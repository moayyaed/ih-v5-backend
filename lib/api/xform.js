// const util = require('util');

const sysinfo = require('../utils/sysinfo');
const appconfig = require('../appconfig');
const datagetter = require('../appspec/datagetter');

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
  devices: datagetter.qRecords,
  devhard: datagetter.qRecords,
  devhardtag: datagetter.qFilteredRecords,
  types: datagetter.qRecords,
  scenes: datagetter.qRecords
  // registryState: appconfig.getRegistryState
};

/**
 *
 * @param {*} item
 */
async function getData(item) {
  const prop = typeof item == 'object' ? item.prop : item;
  if (info[prop]) {
    const fun = info[prop];
    return fun(prop);
  }

  //  console.log('WARN: xform, NOT FOUND prop '+prop)
}

module.exports = {
  getData
};
