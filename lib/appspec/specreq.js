const util = require('util');

const appconfig = require('../appconfig');
const linkmethods = require('./linkmethods');
const projectdata = require('./projectdata');

const datautil = require('../api/datautil');

/**
 *  Обработка запросов для типов из spec: пока type:link
 *
 * @param {Object} query - объект запроса
 * @return {Object}: {data}
 */
async function processSpec(query, dm, holder) {
  const { type, method } = query;
  if (type == 'link') {
    const apiFun = linkmethods[method];
    if (!apiFun) throw { error: 'SORTERR', message: 'Unexpected type or method for type:link' };
    return apiFun(query, dm, holder);
  }

  throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
}

function needFinishing(query) {
  const { method, id } = query;
  if (method != 'getmeta') return;

  const needFin = ['formLayoutx'];
  return id && needFin.includes(id);
}

async function finishing(query, data) {
  const { id, nodeid } = query;
  if (id == 'formLayoutx') return updateFormLayoutx(nodeid, data);
  return data;
}

async function updateFormLayoutx(nodeid, formBody) {
  const p1 = formBody.data.p1;

  if (p1 && p1[0] && p1[0].columns) {
    for (let item of p1[0].columns) {
      if (item.data == '__layout_frame_list') {
        const frames = await getLayoutFrameList(nodeid);
        item.data = frames.data;
      }
    }
  }
  return formBody;
}

async function getLayoutFrameList(nodeid) {
  const res = [{ id: '-', title: '' }];
  if (nodeid) {
    const arr = await projectdata.getFramesArrayForLayout(nodeid);
    // Собрать элементы type: 'container' на экране

    arr.forEach(el => {
      res.push({ id: el, title: el });
    });
  }
  return { data: res };
}

async function getDynPopup(id, nodeid) {
  if (id == 'dyn_multiscenefolder') return {data: await getMultiscenefolderPopup(nodeid)};
  if (id == 'dyn_multiscenechild') return {data: await getMultiscenefolderPopup(nodeid)};
  return {data:[]};
}

async function getMultiscenefolderPopup(nodeid) {
  console.log('getMultiscenefolderPopup ');
  if (nodeid == 'multiscenegroup') {
    return [{ id: '1', type: 'item', title: 'Новый мультисценарий', command: 'addFolder' }];
  }
  return [];
  // Новый экземпляр сценария - генерировать id
  /*
 const newId = await datautil.calcNewInstanseId('multiscenes', nodeid+'_')
  return [
    {id: newId, type: 'item',
      command: 'addNodeByContext',
      title: appconfig.getMessage('AddInstance') +' '+newId
    },
    { id: '3', type: 'divider' },
    { id: '4', type: 'item', title: '$Copy', command: 'copy' },
    { id: '5', type: 'item', title: '$Paste', command: 'paste', check: 'disablePaste' },
    { id: '6', type: 'item', title: '$Delete', command: 'delete' },

    { id: '12', type: 'divider' },

    { id: '13', type: 'item', title: '$NewTab', command: 'newtab' }
  ];
  */
}

module.exports = {
  processSpec,
  needFinishing,
  finishing,
  getDynPopup
};
