/**
 * specreq.js
 */
const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');

const projectdata = require('./projectdata');
const pluginpopup = require('./pluginpopup');
const channelpopup = require('./channelpopup');
const typestore = require('../device/typestore');
// const domaindata = require('../domain/domaindata');
const liststore = require('../dbs/liststore');
const toolmanager = require('../tool/toolmanager');

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

async function getSpecDroplist(query, dm) {
  const { id, nodeid } = query;
  // console.log('getSpecDroplist nodeid=' + nodeid + util.inspect(query));
  if (id == '__layout_frame_list') {
    // const res = [{ id: '-', title: '' }];
    if (nodeid) {
      const data = await getFramesForLayout(nodeid, dm);
      data.unshift({ id: '-', title: '' });
      return { data };
    }
  }

  if (id == '__devcmd') {
    let data = [];
    if (nodeid) {
      const typeId = getTypeId(nodeid);

      if (typeId) {
        const typeObj = typestore.getTypeObj(typeId);
        if (typeObj && typeObj.commands) {
          data = typeObj.commands.map(el => ({ id: el, title: el }));
        }
      }
    }
    data.unshift({ id: '-', title: '' });
    return { data };
  }

  if (id == '__devprop') {
    let data = [];
    if (nodeid) {
      const typeId = getTypeId(nodeid);

      if (typeId) {
        const propArr = typestore.getPropNameArray(typeId);
        if (propArr) {
          data = propArr.map(el => ({ id: el, title: el }));
        }
      }
    }
    data.unshift({ id: '-', title: '' });
    return { data };
  }

  if (id == '__tool.comports') {
    // TODO - имя после tool м б переменное!
    let data = [];
    try {
      const res = await runTool('comports', []);
      // data = JSON.parse(res);
      data = res;
      data.unshift({ id: '-', title: '' });
    } catch (e) {
      console.log('ERROR: comports ' + util.inspect(e));
    }
    return { data };
  }

  function getTypeId(key) {
    // Может придти id типа или устройства
    if (liststore.hasItem('typeList', key)) return key;

    let res = '';
    if (liststore.hasItem('deviceList', key)) {
      const dItem = liststore.getItemFromList('deviceList', key);
      res = dItem && dItem.type ? dItem.type : '';
    }
    return res;
  }
}

function runTool(toolName) {
  // Запустить модуль
  return new Promise((resolve, reject) => {
    toolmanager.runTool(toolName, [], (err, res) => {
      if (err) {
        reject(err);
      } else {
        console.log(' runTool resolve res=' + util.inspect(res));
        resolve(res);
      }
    });
  });
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
  needFinishing,
  finishing,
  isSpecPopup,
  getSpecPopup,
  isSpecDroplist,
  getSpecDroplist
};
