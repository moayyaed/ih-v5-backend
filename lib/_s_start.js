/**
 * start.js
 * 
 */

const globalvarservice = require('./globalvar/globalvarservice');
const deviceservice = require('./device/deviceservice');
const pluginservice = require('./plugin/pluginservice');
const sceneservice = require('./scene/sceneservice');
const snippetservice = require('./snippet/snippetservice');
const trendservice = require('./trend/trendservice');
const informservice = require('./inform/informservice');
const scheduler = require('./schedule/scheduler');
const logservice = require('./log/logservice');

const webserver = require('./web/webserver');
const lm = require('./dbs/lm');

module.exports = async function (holder) {
    await lm(holder);
    await scheduler(holder);
    await logservice(holder);
    await deviceservice(holder);
    await globalvarservice(holder);

    await pluginservice(holder);
    await sceneservice(holder);
    await snippetservice(holder);
    await trendservice(holder);
    await informservice(holder);
    await webserver(holder);
}
 