const sysinfo = require('../utils/sysinfo');

const info = {
  ip:sysinfo.getIp,
  platform:sysinfo.getPlatform,
  arch: sysinfo.getArch,
  cpuTemp:sysinfo.getCpuTemp
};

/**
 * 
 * @param {*} item 
 */
async function getData(item) {
  const prop = item.props;
  if (info[prop]) {
    const fun =  info[prop];
    const result = fun();
    return result;
  }
   
}

module.exports = {
  getData
}