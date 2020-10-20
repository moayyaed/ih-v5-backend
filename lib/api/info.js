/**
 *  info.js
 */

// const util = require('util');

const xform = require('./xform');

// Обработчик запросов /api/info
// /api/info

module.exports = async function(pathArr, req, user, holder) {
  const dataObj = {};

  dataObj.server = {
    platform: await xform.getData('platform'),
    arch: await xform.getData('arch'),
    osUptime: await xform.getData('osUptime'),
    uptime: await xform.getData('uptime'),
    project: await xform.getData('project')
  };

  dataObj.memory = {
    os_total_free: await xform.getData('osMemory'),
    process_rss: await xform.getData('rss'),
    process_heap_total: await xform.getData('heapTotal'),
    process_heap_used: await xform.getData('heapUsed')
  };

  return dataObj;
};
