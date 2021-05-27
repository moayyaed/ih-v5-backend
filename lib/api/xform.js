// const util = require('util');

const sysinfo = require('../utils/sysinfo');
const appconfig = require('../appconfig');

const info = {
  uptime: sysinfo.getProcessUptime,
  osUptime: sysinfo.getOsUptime,
  osMemory: sysinfo.getOsMemory,
  osTotalMemory: sysinfo.getOsTotalMemory,
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
  conf: appconfig.get,
  newversion: appconfig.getNewversion,
  device: qRecords,
  devhard: qRecords,
  devhardtag: qRecords,
  usedLht: appconfig.get,
  enabledLht: appconfig.get,
  limitLht: appconfig.get,
  type: qRecords,
  scenes: qRecords
};

/**
 *
 * @param {*} item
 */
async function getData(item, holder) {
  const prop = typeof item == 'object' ? item.prop : item;
  
  // Вывод данных с системных индикаторов
  if (prop.startsWith('__UNIT') && prop.indexOf('.') > 0) {
    const [d, p] = prop.split('.');
    return holder.devSet[d] && holder.devSet[d][p] != undefined ? holder.devSet[d][p] : '';
  }

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


/**
 * {
      "id": "tabUpgrade",
      "title": "Обновление",
      "component": [{ "id": "formDashboardUpgrade", "type": "xform" }]
    },

 */