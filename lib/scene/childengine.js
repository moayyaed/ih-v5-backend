/**
 *  childengine.js
 *   Дочерний процесс для запуска сценариев
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const { Sceno } = require('./sceno');
const agent = require('./childagent');

const sceneSet = {};
const dnCastSet = {}; // Слепки устройств

start();

async function start() {
  process.on('message', message => {
    if (!message) return;
    // console.log('CHILD: GET message.type ' + message.type);

    if (typeof message == 'string') {
      if (message == 'SIGTERM') process.exit(0);
    }

    if (typeof message == 'object') {
      try {
        if (message.type) parseMessage(message);
      } catch (e) {
        console.log('CHILD: No type in message: ' + util.inspect(message));
      }
    }
  });
}

async function parseMessage(message) {
  switch (message.type) {
    case 'addscene':
      return addScene(message);

    case 'adddevs':
      return addDevs(message);

    case 'devicedata':
      return getDeviceData(message);   

    case 'startscene':
      return startScene(message);
    case 'stopscene':
      return stopScene(message);
    default:
      console.log('Unknown type in message: ' + util.inspect(message));
  }
}

async function addScene({ id, filename, doc }) {
  // const actualParams = getActualParams(doc.devs, doc.def, doc.extprops, id);
  // sceneSet[id] = new Sceno(id, agent, filename, doc.devs);
  sceneSet[id] = new Sceno(id, agent, filename, {});
}

function addDevs({ payload }) {
 
  payload.forEach(dobj => {
    if (dobj && dobj.dn) {
      // Если уже есть - полностью заменяется
      dnCastSet[dobj.dn] = hut.clone(dobj);
    }
  });
  console.log('CHILD dnCastSet ' + util.inspect(dnCastSet, null, 4));
}

function getDeviceData({ payload }) {
  /* [{
    did: 'd0042',
    dn: 'DD01',
    prop: 'state',
    ts: 1610305882834,
    value: 1,
    changed: 1,
    prev: 0
  }]*/

 /*
  payload.forEach(dobj => {
    
    if (dobj && dobj.dn) {
      // Если уже есть - полностью заменяется
      dnCastSet[dobj.dn] = hut.clone(dobj);
    }
  });
  */
  // console.log('CHILD getDeviceData ' + util.inspect(payload, null, 4));
}

async function startScene({ id }) {
  if (sceneSet[id].isReady()) {
    // process.send({ type: 'started', id });
    sceneSet[id].start();
  } else {
    process.send({ type: 'started', id, err: 'Not ready' });
  }
}

function stopScene(id) {
  if (sceneSet[id]) {
    sceneSet[id].exit();
    process.send({ type: 'stopped', id });
  }
}
