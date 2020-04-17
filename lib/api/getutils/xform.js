
// const util = require('util');

const sysinfo = require('../../utils/sysinfo');
const appconfig = require('../../appconfig');

const info = {
  uptime:sysinfo.getProcessUptime,
  osUptime:sysinfo.getOsUptime,
  osMemory:sysinfo.getOsMemory,
  platform:sysinfo.getPlatform,
  arch: sysinfo.getArch,
  ip:sysinfo.getIP,
  cpuTemp:sysinfo.getCpuTemp,
  rss:sysinfo.getProcessMemoryRss,
  heapTotal:sysinfo.getProcessHeapTotal,
  heapUsed:sysinfo.getProcessHeapUsed,
  project:appconfig.get
};

/**
 * 
 * @param {*} item 
 */
async function getData(item) {

  const prop = item.prop;
  if (info[prop]) {
    const fun =  info[prop];
    const result = fun(prop);
    return result;
  } 

    console.log('NOT FOUND prop '+prop)
  
}



module.exports = {
  getData
}