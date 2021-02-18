/**
 * Создание специальных форм (метаданных) - для каждой отдельной записи
 */
const util = require('util');

const hut = require('../utils/hut');
const loadsys = require('../utils/loadsys');
// const appconfig = require('../appconfig');

const specForms = ['formSceneScript', 'formCustomtableCommon'];
const recordDependentForms = { scene: ['formSceneScript'], customtable: ['formCustomtableCommon'] };

function isSpecForm(id) {
  return specForms.includes(id) || !!getPluginFormName(id);
}

function getRecordDependentForms(table) {
  return recordDependentForms[table];
}

// ['META", type, id, nodeid <or unit from id>]
// {type:'form', id:'formPluginCommon', nodeid:'modbus1'}
// {type:'form', id:'channelview.modbus1'}
// Не нужно кэшировать для экземпляров, только для плагина в целом
function getMetaCacheIds(query) {
  let { type, id, nodeid } = query;
  if (!id || !isSpecForm(id)) return;

  if (id.indexOf('.') > 0) {
    [id, nodeid] = id.split('.'); // id=channelview.modbus1 => ['form', 'channelview', 'modbus']
  }

  const plugin = nodeid ? hut.removeLastNumFromStr(nodeid) : '';
  return plugin ? ['META', type, id, plugin] : ['META', type, id];
}

function getPluginFormName(id) {
  const plspec = [
    'formPluginCommon',
    'formDbagentCommon',
    'channelview',
    'channellink',
    'channelfolder',
    'formPluginChannelsTable',
    'formPluginPublish',
    'formPluginExtra'
  ];

  const formName = id.split('.')[0];
  // if (id.startsWith('channel') && id == formName) return ''; // Это форма без точки - берется с сервера

  return plspec.includes(formName) ? formName : '';
}

async function getForm(query, dm) {
  const { id } = query;

  if (id == 'formSceneScript') return getFormSceneScript(query, dm);
  if (id == 'formCustomtableCommon') return getFormCustomtableCommon(query, dm);
  if (id == 'channellink') return getChannellinkForm(query, dm); // Вызывают channellink без указания плагина

  if (getPluginFormName(id)) {
    const ids = getMetaCacheIds(query);

    // Загрузить из папки плагина или стандартная форма для всех плагинов, не зависит от unit
    // Для channelview и channellink объединить 2 формы
    if (isFormWithPlink(ids[2])) {
      return getFormWithPlink(ids[2], ids[3]);
    }
    return loadsys.loadPluginMetaData(ids[1], ids[2], ids[3]); // ids=[META, type, id, unit]
  }
}

async function getChannellinkForm(query, dm) {
  const { nodeid } = query;
  const [did, prop] = nodeid.split('.');
  // Могут быть разные формы в зависимости от привязки?
  // Если есть привязка к каналу - показываем channellink.<unit>
  // Если нет привязки или rowid=__clear - показываем channellink

  if (query.rowid == '__clear') return loadsys.loadMeta('form', 'channellink');
  const doc = await dm.dbstore.findOne('devhard', { did, prop });
  return doc && doc.unit ? getFormWithPlink('channellink', doc.unit) : loadsys.loadMeta('form', 'channellink');
}

function isFormWithPlink(id) {
  return id == 'channellink' || id == 'channelview';
}

async function getFormWithPlink(id, unit) {
  // Получить форму channelform от плагина. Добавить из channellink или channelview сервера
  const channelform = await loadsys.loadPluginMetaData('form', 'channelform', unit);
  const addedForm = await loadsys.loadMeta('form', id);

  if (!channelform) throw { err: 'SOFTERR', message: 'Not found base form: "channelform"!' };
  if (!channelform.grid)
    throw { err: 'SOFTERR', message: 'Invalid  "channelform" for unit ' + unit + '! Expected grid property!' };
  if (!Array.isArray(channelform.grid))
    throw { err: 'SOFTERR', message: 'Invalid  "channelform" for unit ' + unit + '! Expected grid property as ARRAY!' };

  if (!addedForm) throw { err: 'SOFTERR', message: 'Missing added form:' + id + '!' };
  if (!addedForm.grid) throw { err: 'SOFTERR', message: 'Invalid form:' + id + '. Exected grid property!' };
  if (!addedForm.plink) throw { err: 'SOFTERR', message: 'Invalid form:' + id + '. Exected plink property!' };

  const gridItem = addedForm.grid.find(item => item.id == 'plink');
  const result = hut.clone(channelform);

  result.plink = addedForm.plink;
  result.grid.unshift(gridItem);
  return result;
}

async function getFormCustomtableCommon(query, dm) {
  const { id, nodeid } = query;
  const data = await loadsys.loadMeta('form', id);
  if (!data.grid) throw { message: 'Invalid form:' + id + '. Exected grid property!' };
  const pxItem = data.grid.find(item => item.table == 'customdataTable');
  if (!pxItem) return data;

  const px = pxItem.id;
  const doc = await dm.dbstore.findOne('customtables', { _id: nodeid });
  if (doc && doc.props && data[px] && data[px][0] && data[px][0].columns) {
    const keys = Object.keys(doc.props);
    if (keys.length > 0) {
      data[px][0].columns = keys.map(key => ({
        prop: key,
        type: doc.props[key].type,
        title: doc.props[key].title,
        width: doc.props[key].width > 0 ? Number(doc.props[key].width) : 100
      }));
    }
  }
  return data;
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
        title: doc.def[key].note || key,
        width
      }));
    }
    data[px][0].columns.unshift({ prop: '_id', type: 'text', title: 'ID', width: 64 });
  } else {
    // Плашку с таблицей убрать??
    const pxIndex = data.grid.findIndex(item => item.table == 'scenecall');
    // data.grid.pop();
    data.grid.splice(pxIndex, 1);
    delete data[px];
  }

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
