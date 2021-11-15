
// const util = require('util');

const hut = require('../utils/hut');
const logutil = require('../utils/logutil');

const liststore = require('../dbs/liststore');

const logconnector = require('../log/logconnector');

// или для PM - в виде массива
async function getLogRows(query, holder) {
  const { id, rowid, count, allcolumns } = query;
  const doc = await holder.dm.findRecordById('journal', id);
  if (!doc || !doc.src) return [];

  const startTsid = rowid == 0 ? '' : rowid;
  const limit = Number(count) || 1000;
  const sql = 'SELECT * FROM ' + doc.src + logutil.formLogWhere(doc, startTsid) + ' ORDER BY tsid DESC LIMIT ' + limit;
  const recs = await logconnector.read(sql);
  if (allcolumns) return recs;

  const columns = [];
  if (doc.props) {
    Object.keys(doc.props).forEach(el => {
      if (doc.props[el].prop) columns.push(doc.props[el].prop);
    });
  }
  columns.push('level'); // Для раскрашивания
  return recs.map(rec => formRowByColumns(rec));

  function formRowByColumns(rec) {
    const row = { id: rec.tsid };
    columns.forEach(prop => {
      let val = rec[prop] != undefined ? rec[prop] : '';
      if (prop == 'dts') val = hut.getDateTimeFor(new Date(rec.ts));
      row[prop] = val;
    });
    return row;
  }
}


async function getAlertLogRows(query, holder) {
  const { id, allow_deack } = query;
  const doc = await holder.dm.findRecordById('alertjournal', id);
  if (!doc) return [];

  // Данные в таблице alerts - нужно создать фильтр для nedb
  const func = logutil.formLogWhereFunction(doc);
  // console.log('getAlertLogRows typeof func='+typeof func+'  toString='+func.toString());

  const docs = await holder.dm.dbstore.get('alerts', {
    $where: func
  });

  const userList = liststore.getListMap('userList');

  // console.log('getAlertLogRows result =' + util.inspect(docs));

  const arr = docs.sort(hut.byorder('tsStart', 'D')).map(item => ({
    id: item._id,
    txt: item.txt,
    level: item.level,
    toClose: item.toClose,
    _command: item.userId ? 'api_deack_alert' : 'api_ack_alert',
    userId: item.userId,
    username: item.userId && userList.get(item.userId) ? userList.get(item.userId).title : '',
    state: item.tsStop > 0 ? 0 : 1,
    stateStr: item.tsStop > 0 ? 'stopped: ' + item.reason : 'active',
    tsStartStr: getTsStr(item.tsStart),
    tsStopStr: getTsStr(item.tsStop),
    tsAckStr: getTsStr(item.tsAck),
    rowbutton: getRowbutton(item)
  }));
  return arr;
  

  function getTsStr(ts) {
    return hut.isTs(ts) ? hut.getDateTimeFor(new Date(ts), 'dtms') : '';
  }

  //  rowbutton:{title:'Квитировать событие', command: 'api_ack_alert', hide:false, disabled:false},
  function getRowbutton(item) {
    if (item.toClose != 'ack' && item.toClose != 'normAndAck') return { hide: true };

    // let title = 'Подтвердить'; // TODO - учесть, может подтверждение и не требуется
    let title = 'Квитировать'; // TODO - учесть, может подтверждение и не требуется
    let command = 'api_ack_alert';
    let hide = false;

    if (item.userId && item.tsAck) {
      if (allow_deack) {
        title = 'Снять подтверждение';
        command = 'api_deack_alert';
      } else hide = true;
    }
    return { title, hide, command };
  }
}

function getDefaultJournalColumns(table) {
  switch (table) {
    case 'alertjournal':
      return [
        { title: 'Время начала', prop: 'tsStartStr', width: 200 },
        { title: 'Состояние', prop: 'stateStr', width: 200 },
        { title: 'Сообщение', prop: 'txt', width: 400 },
        { title: 'Время завершения', prop: 'tsStopStr', width: 200 },
        { title: 'Действие', prop: 'rowbutton', width: 200 },
        { title: 'Время квитирования', prop: 'tsAckStr', width: 200 },
        { title: 'Оператор', prop: 'username', width: 200 }
      ];
    default:
      return [
        { title: 'Дата', prop: 'dts', width: 200 },
        { title: 'Сообщение', prop: 'txt', width: 500 },
        { title: 'Теги', prop: 'tags', width: 200 }
      ];
  }
}

module.exports = {
  getLogRows,
  getAlertLogRows,
  getDefaultJournalColumns
}