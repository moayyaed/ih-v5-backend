/**
 *
 * dbagent.js
 *
 */
const util = require('util');

const Datastore = require('nedb');

const hut = require('../../utils/hut');

const db = {};

const dbopt = getDbExtOpts();
if (!dbopt.databases || !dbopt.databases.length) processExit(1, 'Not found databases defenition in config!');

// dbopt.databases =[{name, folder}]
dbopt.databases.forEach(item => {
  const filename = item.folder + '/' + item.name + '.db';
  db[item.name] = new Datastore({ filename, autoload: true });
});

process.on('message', message => {
  if (!message) return;
  // console.log('AGENT GET MESS ' + util.inspect(message));

  if (typeof message === 'string') {
    if (message === 'SIGTERM') processExit(10, 'ipc message SIGTERM handle: exit from DBagent');
    return;
  }

  if (typeof message === 'object') {
    if (!message.method) return traceMsg('not found "method" property, message: ' + util.inspect(message));
    const collection = message.collection || 'tsdb';


    switch (message.method) {
      case 'add':
        add(collection, message.data);
        break;

      case 'get':
        get(collection, message.filter);
        break;

      default:
        process.send({ id: message.id, err: { message: 'Invalid DB method ' + message.method } });
    }
  }
});

function add(collection, docs) {
  if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

  return new Promise((resolve, reject) => {
    db[collection].insert(docs, (err, newDocs) => {
      console.log('after insert err=' + util.inspect(err) + ' newDocs=' + util.inspect(newDocs));
      if (!err) {
        resolve(newDocs);
      } else reject(err);
    });
  });
}

function get(collection, filter = {}, opt = {}) {
  if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

  const { order, fields } = opt;
  const projection = fields || {}; // Передается projection - список полей: {name:1, txt:1}
  return new Promise((resolve, reject) => {
    db[collection].find(filter, projection, (err, data) => {
      // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
      if (!err) {
        resolve(order ? data.sort(hut.byorder(order)) : data);
      } else reject(err);
    });
  });
}

function getDbExtOpts() {
  try {
    return JSON.parse(process.argv[2]);
  } catch (e) {
    console.log('Invalid Db options: ' + process.argv[2]);
    return {};
  }
}

function processExit(code, text) {
  if (typeof text !== 'undefined') {
    errMsg(text, code);
  }

  process.exit(code);
}

process.on('exit', () => {
  // console.log('dbagent has stopped');
  // close??
});

function traceMsg(text) {
  console.log('Dbagent: ' + util.inspect(text));
}

function logMsg(text) {
  traceMsg(text);
  process.send('log?dbagent: ' + text);
}

function errMsg(text, code) {
  traceMsg('ERROR ' + text);
  process.send('log?dbagent error ' + (typeof code !== 'undefined' ? code : '') + ': ' + text);
}
