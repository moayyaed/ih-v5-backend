/**
 *  info.js
 */

// const util = require('util');

const xform = require('./xform');
const appconfig = require('../appconfig');

// Обработчик запросов /api/info
// /api/info

module.exports = async function(pathArr, req, user, holder) {
  const dataObj = {};

  dataObj.server = {
    platform: await xform.getData('platform'),
    arch: await xform.getData('arch'),
    osUptime: await xform.getData('osUptime'),
    uptime: await xform.getData('uptime'),
    port: await xform.getData('port'),
    server:appconfig.getConfName(),
    serverVersion:appconfig.get('version'),
    project: await xform.getData('project'),
    projectVersion: appconfig.get('project_version')
    
  };

  dataObj.memory = {
    os_total_free: await xform.getData('osMemory'),
    process_rss: await xform.getData('rss'),
    process_heap_total: await xform.getData('heapTotal'),
    process_heap_used: await xform.getData('heapUsed')
  };

  return dataObj;
};
