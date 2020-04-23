/**
 * Создание специальных форм - для каждой отдельной записи
 */
const util = require('util');

// const dm = require('../datamanager');
const loadsys = require('../utils/loadsys');


function isSpecForm(id) {
  const spec = ['formSceneScript'];
  return spec.includes(id);
}

async function createForm({ id, nodeid }, dm) {
  switch (id) {
    case 'formSceneScript':
      return createFormSceneScript();
    default:
  }


async function createFormSceneScript() {
 
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
    const width = keys.length < 5 ? Math.round(1000/keys.length) : 200;
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

  console.log('FORM ='+util.inspect(data))
  return data;
}
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
  isSpecForm,
  createForm
};
