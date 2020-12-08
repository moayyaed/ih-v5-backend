

const util = require('util');

const linkmethods = require('./linkmethods');
const projectdata = require('./projectdata');

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
 console.log('WARN: updateFormLayoutx ')
  if (p1 && p1[0] && p1[0].columns) {
    for (let item of p1[0].columns) {
      if (item.data == '__layout_frame_list') {
        const frames = await getLayoutFrameList(nodeid);
        console.log('WARN: frames '+util.inspect(frames))
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

module.exports = {
  processSpec,
  needFinishing,
  finishing
};
