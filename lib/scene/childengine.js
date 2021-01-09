/**
 *  childengine.js
 *   Дочерний процесс для запуска сценариев
 *
 */

const util = require('util');

const { Sceno } = require('./sceno');
const agent = require('./childagent');

const sceneSet = {};

start();

async function start() {
  process.on('message', message => {
    if (!message) return;
    console.log('CHILD: GET message: ' + util.inspect(message));

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

async function startScene({ id }) {
  console.log('CHILD startScene '+id)
  if (sceneSet[id].isReady()) {
    sceneSet[id].start();
    process.send({ type: 'debug', id, message: 'started' });
  } else {
    process.send({ type: 'debug', id, message: 'Not ready' });
  }
}

function stopScene(id) {
  if (sceneSet[id]) {
    sceneSet[id].exit();
    process.send({ type: 'stopped', id });
  }
}
