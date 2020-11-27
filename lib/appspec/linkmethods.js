/**
 * linkmethods.js
 *  Экспортирует таблицу функций для type:link
 */

const util = require('util');

const datagetter = require('./datagetter');
const projectdata = require('./projectdata');
const dataformer = require('../api/dataformer');

/**
 * Возвращает данные для привязки
 *
 * @param {Object} query - объект запроса
 * @return {Object}
 *
 */
async function get(query, dm, holder) {
  if (!query.id) throw { error: 'SOFTERR', message: 'Expected "id"!' };
  if (!query.nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };

  switch (query.id) {
    case 'devicelink':
      if (!query.dialogid) throw { error: 'SOFTERR', message: 'Expected "dialogid"!' };
      if (query.dialogid == 'devices') return getDevicelink(query, dm, holder);
      if (query.dialogid == 'visitems') return getElementlink(query, dm, holder);
      if (query.dialogid == 'devicesdn') return getElementlink(query, dm, holder);
      if (query.dialogid == 'visitemsAndVistemplates') return getElementlink(query, dm, holder);
      if (query.dialogid == 'devcmd') return query.root == 'anydevcmd' ? getAllCmd() : getCmdlink(query, dm, holder);
      if (query.dialogid == 'devcmdAndAny')
        return query.root == 'anydevcmd' ? getAllCmd() : getCmdlink(query, dm, holder);
        
      if (query.dialogid == 'devprops') return getElementlink(query, dm, holder);

      if (query.dialogid == 'devpropsAndAny')
        return query.root == 'anydevprops' ? getAllProps(query, dm, holder) : getElementlink(query, dm, holder);

      throw { error: 'SOFTERR', message: 'Unexpected dialogid: ' + query.dialogid };

    case 'elementlink':
      return query.root == 'anydev' ? getAllProps(query, dm, holder) : getElementlink(query, dm, holder);

    case 'setvalue':
      return getElementlink(query, dm, holder);

    case 'channellink':
      return getChannellink(query, dm, holder);

    case 'imagegrid':
      return dataformer.getImagegrid(query.nodeid);

    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + query.id + ' IN ' + util.inspect(query) };
  }
}

/*
async function getImagegrid({ nodeid }, dm, holder) {
 
  const treeData = await dataformer.getDataFromTree('images', nodeid);
  const data = treeData.map(item => item.id);
  return { data };
}
*/

async function getAllProps(query, dm, holder) {
  const did = query.nodeid;

  // const dynProps = ['state', 'value', 'setpoint', 'error', 'blk'];
  const dynProps = datagetter.getAllTypeProps();
  dynProps.push('error');

  const statProps = ['dn', 'name', 'placeStr', 'placePath'];
  const arr = did == '__device' ? dynProps : statProps;

  const properties = arr.map(prop => getItem(did, prop, 'Свойство ' + prop));
  return { data: { properties } };
}

// Формирует массив команд всех устройств в системе

async function getAllCmd(dm, holder) {
  const cmdProps = datagetter.getAllTypeCommands();
  const did = '__device';
  const properties = cmdProps.map(prop => getItem(did, prop, 'Команда ' + prop));
  return { data: { properties } };
}

// Формирует массив свойств одного устройства для привязки к команде
// Включаются только команды
async function getCmdlink({ nodeid }, dm, holder) {
  if (!holder.devSet[nodeid]) throw { error: 'ERR', message: 'Device not found: ' + nodeid };

  const dobj = holder.devSet[nodeid];
  const did = nodeid;
  // const properties = dobj.getCommands().map(prop => getItem(did, prop, datagetter.getDeviceTitle(did) + ' ▪︎ ' + prop));
  const properties = dobj.getCommands().map(prop => getItem(did, prop, datagetter.getDeviceDn(did) + '.' + prop));
  return { data: { properties } };
}

// Формирует массив свойств одного устройства для привязок на визуализации
// Команды исключаются
async function getElementlink({ nodeid, root, anchor }, dm, holder) {
  let properties;
  let dobj;
  let did;
  if (root == 'vistemplate') return getElementlinkFromTemplate(nodeid, dm, holder);

  if (nodeid.startsWith('gl')) {
    // Глобальные переменные
    did = nodeid;
    const item = datagetter.getListItem('globalList', did);
    if (!item) throw { error: 'ERR', message: 'Global variable not found: ' + did };

    const prop = item.dn;
    properties = [getItem(did, prop, 'globals.' + prop, item.dn)];
  } else if (nodeid.startsWith('local')) {
    // Локальные переменные
    did = nodeid;
    const item = datagetter.getListItem('localList', did);
    if (!item) throw { error: 'ERR', message: 'Local variable not found: ' + did };

    const prop = item.dn;
    properties = [getItem(did, prop, 'locals.' + prop, item.dn)];
    properties[0].local = true;
  } else {
    if (!holder.devSet[nodeid]) throw { error: 'ERR', message: 'Device not found: ' + nodeid };

    dobj = holder.devSet[nodeid];
    did = nodeid;
    properties = dobj.getPropsForVislink().map(prop => getItem(did, prop, datagetter.getDeviceDn(did) + '.' + prop, dobj.dn ));
    // .map(prop => getItem(did, prop, datagetter.getDeviceTitle(did) + ' ▪︎ ' + prop));
  }
  return { data: { properties } };
}

async function getElementlinkFromTemplate(nodeid, dm, holder) {
  const properties = [];
  const templateObj = await projectdata.getCachedProjectObj('template', nodeid);
  if (templateObj && templateObj.state && typeof templateObj.state == 'object') {
    Object.keys(templateObj.state).forEach(stateId => {
      if (stateId.startsWith('state') && templateObj.state[stateId].title) {
        const prop = templateObj.state[stateId].title;
        const title = 'template.' + prop;
        const result = { prop, title, value: { did: nodeid, prop: stateId, template: true } };
        properties.push({ prop, title: 'template.' + prop, link: '', enable: true, result });
      }
    });
  }
  return { data: { properties } };
}

function getItem(did, prop, title, dn) {
  const result = { did, prop, title, dn, value: { did, prop } };
  
  return {
    prop,
    title,
    link: '',
    enable: true,
    result
  };
}

// Формирует массив свойств одного устройства для привязок к каналу
async function getDevicelink({ nodeid, anchor, dialogid }, dm, holder) {
  if (!dialogid) throw { error: 'SOFTERR', message: 'Expected "dialogid"!' };
  if (!holder.devSet[nodeid]) throw { error: 'ERR', message: 'Device not found: ' + nodeid };

  const dobj = holder.devSet[nodeid];
  const did = nodeid;
  const properties = await forHardlink();
  return { data: { properties } };

  async function forHardlink() {
    // типовые свойства, calc не берем
    const res = dobj
      .getPropsForHardlink()
      .map(prop => getItem(did, prop, datagetter.getDeviceDn(did) + '.' + prop), anchor);
    // .map(prop => getItem(did, prop, datagetter.getDeviceTitle(did) + ' ▪︎ ' + prop), anchor);

    // Найти существующие привязки этого устройства
    const linkObj = {};
    const devhardDocs = await dm.dbstore.get('devhard', { did });
    // Привязок может не быть, это нормально.
    if (devhardDocs && devhardDocs.length) {
      devhardDocs.forEach(doc => {
        linkObj[doc.prop] = doc.unit + '.' + doc.chan;
      });
    }

    res.forEach(item => {
      if (linkObj[item.prop]) {
        item.link = linkObj[item.prop];
        item.enable = false;
      }
    });
    return res;
  }
}

// async function getChannellink({ nodeid, anchor }, dm, holder) {
async function getChannellink({ nodeid, anchor }, dm) {
  if (!anchor) throw { error: 'SOFTERR', message: 'Expected "anchor"!' };

  // Найти просто список каналов данного плагина
  const unit = nodeid;
  const docs = await dm.dbstore.get('devhard', { unit });

  // Сформировать результат, anchor нужен обязательно для формирования новой привязки!!

  const properties = [];

  // Первый пункт - новый канал, если плагин позволяет добавление нового канала вручную
  // Если в манифесте есть chdefault - добавить
  /*
  const chdefault = await dm.getManifestItem(unit, 'chdefault');
  if (chdefault) {
    properties.push({
      id: '__new.' + unit,
      prop: nodeid + ' Создать новый канал',
      title: nodeid + ' Создать новый канал',
      link: '',
      enable: true,
      formreq: { id: 'channellink.' + nodeid, nodeid: anchor, rowid: '__new.' + unit }
    });
  }
  */

  docs.forEach(doc => {
    if (!doc.folder) {
      const prop = doc.unit + '.' + doc.chan;
      const link = doc.did ? datagetter.getDeviceDn(doc.did) + '.' + doc.prop : '';
      // const formreq = !link ? { id: 'channellink.' + doc.unit, nodeid: anchor, rowid: doc._id } : null;

      properties.push({
        id: doc._id, // id записи в devhard
        prop, // Это д б канал для показа?
        title: prop,
        link, // Существующая привязка к устройству?
        enable: !link
      });
    }
  });
  return { data: { properties } };
}

module.exports = {
  get
};

// /api/admin?method=getmeta&type=tree&id=elements
// /api/admin?method=get&type=link&id=elementlink&nodeid=d0002

// По подписке
// {"uuid":"container_1","data":{"template_1":{"state1":1},"rectangle_1":{"d0015":{"state":1}}},"response":1}
