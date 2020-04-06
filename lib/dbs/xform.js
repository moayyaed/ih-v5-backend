
const util = require('util');

const sysinfo = require('../utils/sysinfo');

const info = {
  uptime:sysinfo.getProcessUptime,
  osUptime:sysinfo.getOsUptime,
  osMemory:sysinfo.getOsMemory,
  platform:sysinfo.getPlatform,
  arch: sysinfo.getArch,
  ip:sysinfo.getIP,
  cpuTemp:sysinfo.getCpuTemp
};

/**
 * 
 * @param {*} item 
 */
async function getData(item) {
  console.log('getData item='+util.inspect(item))
  const prop = item.prop;
  if (info[prop]) {
    const fun =  info[prop];
   
    const result = fun();
    console.log('getData result= '+result)
    return result;
  } 
    console.log('NOT FOUND prop '+prop)
  
   
}

module.exports = {
  getData
}