/**
 *
 */
const util = require('util');

const hut = require('../utils/hut');
const dbstore = require('./dbstore');

const virtTables = {
  devicecommonTable: devicecommon,
  typepropsTable: typeprops
};

exports.get = async function(tableName, nodeid) {
  if (virtTables[tableName]) {
    return virtTables[tableName](nodeid);
  }
};

async function devicecommon(nodeid) {
  const trec = await dbstore.get('devprops', { _id: nodeid });
  const arr = trec[0] && trec[0].aux ? trec[0].aux.map(aitem => aitem) : [];

  // Добавить данные каналов
  const hrec = await dbstore.get('devhard', { did: nodeid });
  const hObj = hut.arrayToObject(hrec, 'prop');

  arr.forEach(item => {
    if (hObj[item.prop]) {
      item.unit = hObj[item.prop].unit;
      item.chan = hObj[item.prop].chan;
    }
  });

  // Добавить текущее состояние
  const crec = await dbstore.get('devcurrent', { _id: nodeid });

  if (crec && crec[0] && crec[0].raw) {
    const cObj = hut.arrayToObject(crec[0].raw, 'prop');
    arr.forEach(item => {
      if (cObj[item.prop]) {
        item.val = cObj[item.prop].val;
        if (cObj[item.prop].ts > 0) {
          try {
            item.ts = hut.getDateTimeFor(new Date(cObj[item.prop].ts), 'reportdt');
          } catch (e) {
            console.log('Error data format. ' + cObj[item.prop].ts + ' ' + util.inspect(e));
          }
        }
      }
    });
  }

  return arr;
}

async function typeprops(nodeid) {
  const trec = await dbstore.get('types', { _id: nodeid });
  
  // props развести в массив
  const pObj = trec[0] && trec[0].props ? trec[0].props : '';
  if (!pObj) return [];
  const arr = hut.objectToArray(pObj, 'prop');
 
  // Добавить поля, которых нет
  arr.forEach(item => {
    if (item.min == undefined) item.min=0; 
    if (item.max == undefined) item.max=null; 
    if (item.dig == undefined) item.dig=0; 
    if (item.mu == undefined) item.mu=""; 
    
  });

  return arr;
}
