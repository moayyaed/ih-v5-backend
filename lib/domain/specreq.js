/**
 * specreq.js
 */
// const util = require('util');

const appconfig = require('../appconfig');

const linkmethods = require('./linkmethods');
const projectdata = require('../appspec/projectdata');
const portal = require('./portal');
const pluginpopup = require('./pluginpopup');

const datautil = require('../api/datautil');

function isSpecType(type) {
  const SPEC = ['link'];
  return SPEC.includes(type);
}

function isSpecPopup(id) {
  return id.startsWith('plugin') || id.startsWith('dyn_');
}

async function getSpecPopup(id, nodeid) {
  return id.startsWith('plugin')
    ? pluginpopup.getPopupPlugin(id, nodeid)
    : id.startsWith('dyn_')
    ? getDynPopup(id, nodeid)
    : '';
}

async function getSpecXFormData(query, holder) {
  return query.id == 'formDashboardUpgrade' ? getformDashboardUpgrade(query, holder) : '';
}

async function getformDashboardUpgrade(query, holder) {
  // Сделать запрос
  let registryState = 'no';
  let portalauth = {};
  let login = '';

  const registry = appconfig.getRegistry();
  if (typeof registry == 'object' && typeof registry.payload == 'object') {
    const resObj = await portal.auth({ hwid: registry.hwid, ...registry.payload }, 'sessioncheck');
    // console.log('INFO: sessioncheck result '+JSON.stringify(resObj));
    if (resObj && resObj.res) {
      registryState = 'OK';
      login = registry.payload.login || '';
    } else {
      portalauth.message = resObj.message;
    }
  }
  return { registryState, portalauth, login };
}

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

async function getFramesArrayForLayout(nodeid) {
  return projectdata.getFramesArrayForLayout(nodeid);
}

async function getLayoutFrameList(nodeid) {
  const res = [{ id: '-', title: '' }];
  if (nodeid) {
    const arr = await getFramesArrayForLayout(nodeid);
    // Собрать элементы type: 'container' на экране

    arr.forEach(el => {
      res.push({ id: el, title: el });
    });
  }
  return { data: res };
}

async function getDynPopup(id, nodeid) {
  if (id == 'dyn_resapifolder') return { data: await getRestapifolderPopup(nodeid) };
  return { data: [] };
}

async function getRestapifolderPopup(nodeid) {
  if (nodeid == 'restapihandlergroup') {
    // Корневая - можно загрузить frontend
    const rec = await datautil.getRecord('restapihandlergroup', nodeid);
    const res = [
      { id: '1', type: 'item', title: appconfig.getMessage('NewRoute'), command: 'addNode' },
      { id: '2', type: 'item', title: appconfig.getMessage('NewFolder'), command: 'addFolder' },
      { id: '3', type: 'divider' },
      { id: '5', type: 'item', title: appconfig.getMessage('Paste'), command: 'paste', check: 'disablePaste' }
    ];

    if (rec.useproject_frontend) {
      res.push({ id: '7', type: 'divider' });
      res.push({ id: '8', type: 'item', title: 'Load Frontend', command: 'upload', param: 'frontend' });
    }
    return res;
  }

  return [
    { id: '1', type: 'item', title: appconfig.getMessage('NewRoute'), command: 'addNode' },
    { id: '2', type: 'item', title: appconfig.getMessage('NewFolder'), command: 'addFolder' },
    { id: '3', type: 'divider' },
    { id: '4', type: 'item', title: appconfig.getMessage('Copy'), command: 'copy' },
    { id: '5', type: 'item', title: appconfig.getMessage('Paste'), command: 'paste', check: 'disablePaste' },
    { id: '6', type: 'item', title: appconfig.getMessage('Delete'), command: 'delete' },
    { id: '7', type: 'divider' },
    { id: '10', type: 'item', title: appconfig.getMessage('NewTab'), command: 'newtab' }
  ];
}

module.exports = {
  getSpecXFormData,
  processSpec,
  needFinishing,
  finishing,
  getDynPopup,
  isSpecPopup,
  getSpecPopup,
  isSpecType
};
