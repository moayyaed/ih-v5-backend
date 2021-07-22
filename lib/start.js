/**
 * start.js
 * 
 */

const deviceservice = require('./device/deviceservice_wt');
// const deviceservice = require('./device/deviceservice');
const pluginservice = require('./plugin/pluginservice');
// const sceneservice = require('./scene/sceneservice');
const snippetservice = require('./snippet/snippetservice');
const trendservice = require('./trend/trendservice');
const alertservice = require('./alert/alertservice');
const informservice = require('./inform/informservice');
const scheduler = require('./schedule/scheduler');
const logservice = require('./log/logservice');
const webserver = require('./web/webserver');
const confmanager = require('./domain/confmanager');

module.exports = async function (holder) {
  
    await confmanager(holder);
    await logservice(holder);
    await scheduler(holder);
    await deviceservice(holder);
    await pluginservice(holder);
    // await sceneservice(holder);
    await snippetservice(holder);
    await trendservice(holder);
    await informservice(holder);
    await alertservice(holder);
    await webserver(holder);
}
 