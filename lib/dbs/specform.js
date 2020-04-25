/**
 * Создание специальных форм - для каждой отдельной записи
 */
const util = require('util');

// const dm = require('../datamanager');
const loadsys = require('../utils/loadsys');

const specForms = ['formSceneScript'];
const recordDependentForms = {'scene':['formSceneScript']};


function isSpecForm(id) {
  return specForms.includes(id) || !!getPluginFormName(id);
}


function getRecordDependentForms(table) {
  return recordDependentForms[table];
}

// ['META", type, id, nodeid/unit]
function getMetaCacheIds(query) {
  const { type, id, nodeid } = query;
  if (!id || !isSpecForm(id)) return;

  let res = [type, id, nodeid];

  if (id.indexOf('.') > 0) {
    res = id.split('.'); // channelview.modbus1
    res.unshift(type);
  }
  res.unshift('META');
  return res;
}

function getPluginFormName(id) {
  const plspec = ['formPluginCommon', 'channelview', 'channelfolder', 'formPluginChannelsTable'];
  const formName = id.split('.')[0];
  return plspec.includes(formName) ? formName : '';
}

async function getForm(query, dm) {
  const { id } = query;

  if (id == 'formSceneScript') return getFormSceneScript(query, dm);

  if (getPluginFormName(id)) {
    const ids = getMetaCacheIds(query);
    // Загрузить из папки плагина или стандартная форма для всех плагинов, не зависит от unit
    return loadsys.loadPluginMetaData(ids[1], ids[2], ids[3]); // <META>. type, id, unit
  }
}

async function getFormSceneScript(query, dm) {
  const { id, nodeid } = query;
  const data = await loadsys.loadMeta('form', id);
  if (!data.grid) throw { message: 'Invalid form:' + id + '. Exected grid property!' };
  const pxItem = data.grid.find(item => item.table == 'scenecall');
  if (!pxItem) return data;

  const px = pxItem.id;
  const doc = await dm.dbstore.findOne('scenes', { _id: nodeid });
  if (doc && doc.multi && doc.def && typeof doc.def == 'object' && data[px] && data[px][0] && data[px][0].columns) {
    // Добавить разметку колонок для таблицы
    const keys = Object.keys(doc.def);
    if (keys.length > 0) {
      const width = keys.length < 5 ? Math.round(1000 / keys.length) : 200;
      data[px][0].columns = keys.map(key => ({
        prop: key,
        type: 'droplist',
        data: 'deviceList',
        title: doc.def[key].note,
        width
      }));
    }
  } else {
    // Плашку с таблицей убрать??
    const pxIndex = data.grid.findIndex(item => item.table == 'scenecall');
    // data.grid.pop();
    data.grid.splice(pxIndex, 1);
    delete data[px];
  }

  console.log('FORM =' + util.inspect(data));
  return data;

  /*
  {
    "prop": "dev1",
    "title": "Device 1",
    "type": "droplist",
    "data": "deviceList",
    "width": 300
  },
  */
}

module.exports = {
  getRecordDependentForms,
  isSpecForm,
  getMetaCacheIds,
  getForm
};
