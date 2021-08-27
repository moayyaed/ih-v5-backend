/**
 * specreq.js
 */
const util = require('util');

const appconfig = require('../appconfig');

const linkmethods = require('./linkmethods');
const projectdata = require('../appspec/projectdata');
const pluginpopup = require('./pluginpopup');
const channelpopup = require('./channelpopup');
const typestore = require('../device/typestore');

function isSpecType(type) {
  const SPEC = ['link'];
  return SPEC.includes(type);
}

function isSpecPopup(id) {
  return id.startsWith('channel') || id.startsWith('plugin') || id.startsWith('dyn_');
}

function isSpecDroplist(id) {
  return id.startsWith('__');
}

async function getSpecPopup(query, holder) {
  const { id } = query;
  if (id.startsWith('channel')) {
    const pluginPopupItem = await getPopupFromManifest(query.navnodeid, id, holder);
    return { data: await channelpopup(id, query, pluginPopupItem, holder) };
  }

  return id.startsWith('plugin')
    ? pluginpopup.getPopupPlugin(query, holder)
    : id.startsWith('dyn_')
    ? getDynPopup(query, holder)
    : '';
}

async function getPopupFromManifest(unitId, popupName, holder) {
  if (unitId) {
    const plugin = appconfig.getPluginIdFromUnitId(unitId);
    const res = await holder.dm.getManifestItem(plugin, popupName);
    return res;
  }
}

async function getSpecDroplist(query, holder) {
  const { id, nodeid } = query;
  if (id == '__layout_frame_list') {
    // const res = [{ id: '-', title: '' }];
    if (nodeid) {
      /*
      const arr = await getFramesArrayForLayout(nodeid, holder.dm);
      // Собрать элементы type: 'container' на экране

      arr.forEach(el => {
        res.push({ id: el, title: el });
      });
    }
    */
      const data = await getFramesForLayout(nodeid, holder.dm);
      data.unshift({ id: '-', title: '' });
      return { data };
    }
  }

  if (id == '__devcmd') {
    let data = [];

    const typeObj = typestore.getTypeObj(nodeid);
    if (typeObj  && typeObj.commands) {
      data = typeObj.commands.map (el => ({id:el, title:el}));
    } 
    data.unshift({ id: '-', title: '' });
    return { data };
  }

  if (id == '__devprop') {
    let data = [];

    const propArr = typestore.getPropNameArray(nodeid);
    if (propArr ) {
      data = propArr.map (el => ({id:el, title:el}));
    } 
    data.unshift({ id: '-', title: '' });
    return { data };
  }

}

/**
 *  Обработка запросов для типов из spec: пока type:link
 *
 * @param {Object} query - объект запроса
 * @return {Object}: {data}
 */
async function processSpec(query, holder) {
  const { type, method } = query;
  if (type == 'link') {
    const apiFun = linkmethods[method];
    if (!apiFun) throw { error: 'SORTERR', message: 'Unexpected type or method for type:link' };
    return apiFun(query, holder);
  }

  throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
}

function needFinishing(query) {
  const { method, id } = query;
  if (method != 'getmeta') return;

  const needFin = ['formLayoutx'];
  return id && needFin.includes(id);
}

async function finishing(query, data, dm) {
  const { id, nodeid } = query;
  if (id == 'formLayoutx') return updateFormLayoutx(nodeid, data, dm);
  return data;
}

async function updateFormLayoutx(nodeid, formBody, dm) {
  const p1 = formBody.data.p1;

  if (p1 && p1[0] && p1[0].columns) {
    for (let item of p1[0].columns) {
      if (item.data == '__layout_frame_list') {
        const frames = await getLayoutFrameList(nodeid, dm);
        // console.log('WARN: updateFormLayoutx frames=' + util.inspect(frames));
        item.data = frames.data;
      }
    }
  }
  return formBody;
}

async function getFramesArrayForLayout(nodeid, dm) {
  return projectdata.getFramesArrayForLayout(nodeid, dm);
}

async function getFramesForLayout(nodeid, dm) {
  return projectdata.getFramesForLayout(nodeid, dm);
}

async function getLayoutFrameList(nodeid, dm) {
  // const res = [{ id: '-', title: '' }];
  let data = [];
  if (nodeid) {
    /*

    const arr = await getFramesArrayForLayout(nodeid, dm);
    // Собрать элементы type: 'container' на экране

    arr.forEach(el => {
      res.push({ id: el, title: el });
    });
    */
    data = await getFramesForLayout(nodeid, dm);
  }
  data.unshift({ id: '-', title: '' });
  return { data };
}

async function getDynPopup({ id, nodeid }, holder) {
  // if (id == 'dyn_resapifolder') return { data: await getRestapifolderPopup(nodeid) };
  return { data: [] };

  /*
  async function getRestapifolderPopup() {
    if (nodeid == 'restapihandlergroup') {
      // Корневая - можно загрузить frontend
      // const rec = await datautil.getRecord('restapihandlergroup', nodeid);
      const rec = await holder.dm.findRecordById('restapihandlergroup', nodeid);
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
  */
}

module.exports = {
  processSpec,
  needFinishing,
  finishing,
  isSpecPopup,
  getSpecPopup,
  isSpecType,
  isSpecDroplist,
  getSpecDroplist
};
