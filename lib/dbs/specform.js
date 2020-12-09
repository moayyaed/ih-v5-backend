/**
 * Создание специальных форм (метаданных) - для каждой отдельной записи
 */
const util = require('util');

// const dm = require('../datamanager');
const hut = require('../utils/hut');
const loadsys = require('../utils/loadsys');
const appconfig = require('../appconfig');

const specForms = ['formSceneScript'];
const recordDependentForms = { scene: ['formSceneScript'] };

function isSpecForm(id) {
  return specForms.includes(id) || !!getPluginFormName(id);
}

function getRecordDependentForms(table) {
  return recordDependentForms[table];
}

// ['META", type, id, nodeid <or unit from id>]
function getMetaCacheIds(query) {
  const { type, id, nodeid } = query;
  if (!id || !isSpecForm(id)) return;

  let res = [type, id, nodeid];

  if (id.indexOf('.') > 0) {
    res = id.split('.'); // id=channelview.modbus1 => ['form', 'channelview', 'modbus1']
    res.unshift(type);
  }

  res.unshift('META');
  return res;
}

function getPluginFormName(id) {
  const plspec = ['formPluginCommon', 'channelview', 'channellink', 'channelfolder', 'formPluginChannelsTable', 'formPluginPublish'];

  const formName = id.split('.')[0];
  // if (id.startsWith('channel') && id == formName) return ''; // Это форма без точки - берется с сервера

  return plspec.includes(formName) ? formName : '';
}

async function getForm(query, dm) {
  const { id } = query;

  if (id == 'formSceneScript') return getFormSceneScript(query, dm);
  // if (id == 'formDbagentCommon') return getFormDbagentCommon(query, dm);
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

  if (query.rowid == '__clear')  return loadsys.loadMeta('form', 'channellink');
  const doc = await dm.dbstore.findOne('devhard', { did, prop });
  return  (doc && doc.unit) ? getFormWithPlink('channellink', doc.unit) : loadsys.loadMeta('form', 'channellink');
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


async function getFormDbagentCommon (query, dm) {
  const { id, nodeid } = query;
  const data = await loadsys.loadMeta('form', id);
  // Взять из из файла config_<nodeid>.json раздел form
  const confObj = appconfig.getDbagentConfig(nodeid);
  if (confObj && confObj.form) data.p2 = confObj.form;
  // data.p2 =  [{ "prop": "path_akdb", "title": "Path AKAB", "type": "input" }];
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
