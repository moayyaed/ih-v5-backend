/**
 *  virttables.js
 *  Подготовка виртуальных таблиц
 *
 *  module.exports = {имя виртуальной таблицы : функция, ...}
 *
 *   Функция обработки добавляет поля к массиву данных из хранилища или полностью формирует данные
 *   Результат - массив для показа в виде таблицы
 *
 *   Функция вызывается с параметрами: (не все функции используют все параметры)
 *
 * @param {*} dataFromTable - массив данных из хранилища (dbstore)
 * @param {*} table - имя таблицы
 * @param {*} nodeid - id узла (_id записи)
 * @param {*} pitem - объект описания строки таблицы для показа
 * @param {*} holder
 */

const util = require('util');

const hut = require('../utils/hut');
const dm = require('../datamanager');
const dbconnector = require('../dbconnector');
const appconfig = require('../appconfig');

const tabledata = require('../api/tabledataformer');
const datautil = require('../api/datautil');
// const deviceutil = require('../device//deviceutil');
const liststore = require('../dbs/liststore');

const datagetter = require('./datagetter');
const projectdata = require('./projectdata');

/** ВИРТУАЛЬНЫЕ ТАБЛИЦЫ */

/** typepropsTable
 * Список свойств для типа nodeid
 */
async function typeprops(dataFromTable, table, nodeid, pitem, holder) {
  const genfield = 'props';
  const rec = dataFromTable[table];
  const pObj = rec && rec[genfield] ? rec[genfield] : '';
  if (!pObj) return [];
  const arr = tabledata.transfromGenfieldObjToArray(pObj);

  // const arr = await tabledata.formTableData(dataFromTable, table, nodeid, pitem);
  // const typeProps = holder.typeMap.get(nodeid) ? holder.typeMap.get(nodeid).props : {};
  if (datautil.isLink(nodeid)) {
    // t003.state
    const prop = nodeid.split('.').pop();
    let propItem;
    if (prop) {
      propItem = arr.find(item => item.id == prop);
      if (propItem) {
        propItem.errstr = propItem.errstr || '';
        propItem.fuse = propItem.fuse || 0;
        propItem.fuse_name = liststore.getTitleFromList('fuseList', propItem.fuse);
      }
    }
    return propItem || {};
  }

  arr.forEach(item => {
    item.fuse = item.fuse || 0;
  });
  return tabledata.formColumnVals(pitem.columns, arr);
}

/** devicecommonTable
 * Список свойств для устройства nodeid
 *
 * Включаются свойства:
 *  - от типа
 *  - из сценариев
 *  - error - системное свойство
 */
async function devicecommon(dataFromTable, table, nodeid, pitem, holder) {
  if (!holder.devSet[nodeid]) return [];

  const result = [];
  const dobj = holder.devSet[nodeid];

  const devrec = await dm.findRecordById('device', nodeid);
  if (!devrec) return [];

  const snipuse = devrec.snipuse;

  // Данные каналов
  const hrec = await dm.dbstore.get('devhard', { did: nodeid });
  const hObj = hut.arrayToObject(hrec, 'prop');

  // Берем типовые свойства - значения
  const typeItem = dobj.typeobj;
  const typename = 'Тип ' + typeItem.item.name;
  const typePath = datagetter.getTypePath(dobj.type);

  //  типовые свойства - значения
  typeItem.proparr.forEach(propItem => {
    const prop = propItem.prop;
    const item = getItem(prop, typeItem.props[prop].name || prop, getTypeOpTitle(typeItem.props[prop]), {
      title: typename,
      path: typePath
    });

    item.min = dobj.getMin(prop);
    item.max = dobj.getMax(prop);
    item.dig = dobj.getDig(prop);
    item.mu = dobj.getMu(prop);
    item.log = dobj.getLog(prop);

    // Данные канала
    item.snipuse = snipuse;
    if (!item.snipuse) addHardProps(hObj, item, dobj._id, prop);

    result.push(item);
  });

  // Типовые команды
  typeItem.commands.forEach(prop => {
    const item = getItem(prop, typeItem.props[prop].name || prop, getTypeOpTitle({ op: 'cmd' }), {
      title: typename,
      path: typePath
    });
    // Данные канала
    item.snipuse = snipuse;
    if (!item.snipuse) addHardProps(hObj, item);
    result.push(item);
  });

  // Добавить свойства extProps
  const extProps = dobj.extProps;
  if (extProps) {
    Object.keys(extProps).forEach(prop => {
      if (!typeItem.props[prop]) {
        const scene = extProps[prop].scenes[0]; // Всегда берем первый сценарий, где свойство упоминается
        const ext = extProps[prop].ext;

        const sceneListItem = liststore.getItemFromList('sceneList', scene);
        const item = getItem(prop, ext.note, 'Scene Parameter Number', {
          title: 'Сценарий ' + sceneListItem.name,
          path: datagetter.getScenescriptPath(scene)
        });
        result.push(item);
      }
    });
  }

  // error - системное свойство
  result.push(getItem('error', 'Ошибка', 'System', { title: '', path: '' }));

  result.forEach(item => {
    // Добавить текущее состояние
    if (dataFromTable.realtime[item.prop]) {
      const dItem = dataFromTable.realtime[item.prop];
      item.realtime_dev_val = dItem.realtime_dev_val;
      item.realtime_dev_ts = dItem.realtime_dev_ts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_ts)) : '';
      item.realtime_dev_cts = dItem.realtime_dev_cts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_cts)) : '';
      item.realtime_dev_err = dItem.realtime_dev_err;
    }
  });

  return result;

  function getItem(prop, type_propname, type_op, source) {
    return {
      id: prop,
      prop,
      chanlink: { title: '', path: '' },
      type_propname,
      type_op,
      source,
      min: '',
      max: '',
      dig: '',
      mu: '',
      unit: ''
    };
  }
}

function getTypeOpTitle(propItem) {
  const vtypeList = { N: 'Number', B: 'Bool', S: 'String' };
  const opList = { rw: 'Data', r: 'Data', calc: 'Calculate', cmd: 'Command', par: 'Parameter' };

  const vt = propItem.op == 'cmd' ? '' : ' ' + vtypeList[propItem.vtype];
  // Объединить op и vtype
  return opList[propItem.op] + vt;
}

async function devicescene(dataFromTable, table, nodeid, pitem, holder) {
  // if (!holder.devSet[nodeid]) return [];
  if (!holder.devSet[nodeid]) return [];
  if (!holder.devsceneSet[nodeid]) return [];

  const result = [];
  holder.devsceneSet[nodeid].forEach(scene => {
    const sceneListItem = liststore.getItemFromList('sceneList', scene);
    const scenePath = datagetter.getScenescriptPath(scene);
    result.push({ id: scene, scene_id: scene, scene_name: { title: sceneListItem.name, path: scenePath } });
  });
  return result;
}

async function dialoglinks(dataFromTable, table, nodeid, pitem) {
  const result = await projectdata.getElementLinks('dialog', nodeid);
  result.forEach(item => {
    item.device_name = item.did && item.did.startsWith('__dev') ? 'Любое' : datagetter.getDeviceTitle(item.did);
    item.sprop = item.did.startsWith('__devstat') ? item.prop : '';
    item.dprop = !item.sprop ? item.prop : '';
  });
  return result;
}

async function devicevis(dataFromTable, table, nodeid, pitem) {
  const did = nodeid;
  const result = [];
  let uppobj;

  // По списку контейнеров получить объекты и выбрать ссылки на устройство
  const contList = liststore.getListMap('containerList');
  for (let id of contList.keys()) {
    uppobj = await projectdata.getCachedUpProjectObj({ id: 'container', nodeid: id });
    if (uppobj && uppobj.data && uppobj.data[did]) {
      result.push({
        id,
        container_id: id,
        container_name: containerNameAsLink(id, contList.get(id)),
        content_str: getContentStr()
      });
    }
  }

  // По списку экранов получить объекты и выбрать ссылки на устройство
  const layoutList = liststore.getListMap('layoutList');
  for (let id of layoutList.keys()) {
    uppobj = await projectdata.getCachedUpProjectObj({ id: 'layout', nodeid: id });
    if (uppobj && uppobj.data && uppobj.data[did]) {
      result.push({
        id,
        container_id: id,
        container_name: layoutNameAsLink(id, layoutList.get(id)),
        content_str: getContentStr()
      });
    }
  }
  return result;

  function getContentStr() {
    let str = '';
    const templateObj = {};

    // uppobj.data[did] = {"state":[{"el":"template_4","varname":"state1"}]}
    Object.keys(uppobj.data[did]).forEach(prop => {
      uppobj.data[did][prop].forEach(elItem => {
        const t = elItem.el;
        if (!templateObj[t]) templateObj[t] = [];
        templateObj[t].push(prop);
      });
    });

    // template_6:auto; template_8:value,blk
    Object.keys(templateObj).forEach(t => {
      if (templateObj[t].length) {
        if (str) str += ';   ';
        str += t + ':' + templateObj[t].join(', ');
      }
    });
    return str;
  }
}

function containerNameAsLink(id, item) {
  const path = 'vis/viscont/viscontview/' + id + '/tabViscontEditor';
  return { title: item.title || id, path };
}

function layoutNameAsLink(id, item) {
  const path = 'vis/layout/layoutview/' + id + '/tabLayoutEditor';
  return { title: item.title || id, path };
}

async function templateUsage(dataFromTable, table, nodeid, pitem, holder) {
  const templateId = nodeid;
  // По списку контейнеров получать контейнеры, искать шаблон
  const contList = liststore.getListMap('containerList');
  if (!contList) return [];

  const result = [];
  for (let containerId of contList.keys()) {
    // const item = contList.get(key);
    const elArr = await projectdata.findTemplateUsageForContainer(templateId, containerId);
    if (elArr) {
      elArr.forEach(element => {
        result.push({
          id: containerId + '_' + element,
          container_id: containerId,
          container_name: containerNameAsLink(containerId, contList.get(containerId)),
          template_id: templateId,
          element
        });
      });
    }
  }
  return result;
}

async function snippetUsage(dataFromTable, table, nodeid, pitem, holder) {
  const glDocs = gather(await dm.dbstore.get('globals', { snipid: nodeid }));
  const dvDocs = gather(await dm.dbstore.get('devices', { snipid: nodeid }));
  return [...glDocs, ...dvDocs];

  function gather(docs) {
    const arr = [];
    docs.forEach(doc => {
      if (doc.snipuse) {
        arr.push({ id: doc._id, did: datagetter.getDeviceLinkObj(doc._id), period: doc.snipperiod });
      }
    });
    return arr;
  }
}

function addHardProps(hObj, item, did, prop) {
  item.chanlink = { title: '', path: '' };

  // Данные канала
  if (hObj[item.prop]) {
    item.chanlink = datagetter.getChannelLinkObj(hObj[item.prop]._id, hObj[item.prop].unit, hObj[item.prop].chan);
  }
  item.chanlink.value = { did, prop };
}

async function deviceDb(dataFromTable, table, nodeid, pitem, holder) {
  if (!nodeid) return [];

 
  const arr = [];
  if (nodeid.startsWith('gl')) {
    const globj = holder.glSet.getItem(nodeid);
    if (!globj) return [];
    const dbrec = await dm.findRecordById('devicedb', nodeid);
   
    if (dbrec) {
      arr.push(dbrec);
    } else {
      arr.push({ id: nodeid, did:nodeid, prop:'globals' })
    }

  } else {
    const dobj = holder.devSet[nodeid];
    if (!dobj) return [];

    // Данные из devicedb - хранятся в виде строк did, prop, ...
    const dbrec = await dm.dbstore.get('devicedb', { did: nodeid });
    const dbObj = hut.arrayToObject(dbrec, 'prop');

    // Все свойства нужны, кроме команд
    const devProps = dobj.getPropsForVislink();

    devProps.forEach(prop => {
      const item = { id: prop, prop }; // Временный id, записи пока нет
      if (dbObj[prop]) {
        item.id = dbObj[prop]._id; // _id в таблице devicedb
        Object.assign(item, dbObj[prop]);
      }
      arr.push(item);
    });
  }
  return tabledata.formColumnVals(pitem.columns, arr);
}

// Таблицы получаем из дерева, поля id, title, path, остальные значения из списка
async function typestree(data, table, nodeid, pitem) {
  const typeList = liststore.getListMap('typeList');
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item, typeList.get(item.id)));
  return tabledata.formRows(table, arr, pitem.columns);
}

async function dialogstree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns);
}

async function templatestree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns);
}

async function layoutstree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns);
}

async function viscontstree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns);
}

async function scenestree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));
  return tabledata.formRows(table, arr, pitem.columns);
}

async function snippetstree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));
  return tabledata.formRows(table, arr, pitem.columns);
}

async function devicestree(data, table, nodeid, pitem) {
  const typeList = liststore.getListMap('typeList');
  const deviceList = liststore.getListMap('deviceList');

  const arr = data[table].map(item => {
    const devItem = deviceList.get(item.id);
    const typeTitle = devItem && devItem.type && typeList.has(devItem.type) ? typeList.get(devItem.type).title : '';
    return Object.assign({ _id: item.id, 'type#title': typeTitle }, item, devItem);
  });
  return tabledata.formRows(table, arr, pitem.columns);
}

async function projectstree(data, table, nodeid, pitem) {
  const projectList = liststore.getListMap('projectList');

  const arr = data[table].map(item => {
    const projectItem = projectList.get(item.id);

    return { _id: item.id, title_link: item.title, path: item.path, ...projectItem };
  });

  return tabledata.formRows(table, arr, pitem.columns);
}

async function globalstree(data, table, nodeid, pitem, holder) {
  const globalList = liststore.getListMap('globalList');
  const arr = data[table].map(item => {
    const dn = globalList.has(item.id) ? globalList.get(item.id).dn : '';
    const value = dn && holder.glSet[dn] != undefined ? holder.glSet[dn] : 0;
    return Object.assign({ _id: item.id, name: item.title, dn, value }, item);
  });
  return tabledata.formRows(table, arr, pitem.columns);
}

async function imagestree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));

  // miss и другие поля - взять из таблицы
  const docs = await dm.dbstore.get('images', {});
  const dObj = hut.arrayToObject(docs, '_id');

  arr.forEach(item => {
    if (dObj[item._id]) {
      item.miss = dObj[item._id].miss;
      item.error = item.miss ? 'File not found' : '';
    }
  });
  return tabledata.formRows(table, arr, pitem.columns);
}

// Таблица устройств заданного типа
async function typedevices(dataFromTable, table, nodeid, pitem) {
  const arr = await dm.dbstore.get('devices', { type: nodeid });

  arr.forEach(item => {
    item.id = item._id;
    item.did = item._id;
    item.path = datautil.getPathFromTree('devdevices', item.id, 'place');
  });
  return tabledata.formRows(table, arr, pitem.columns);
}

async function unitext(dataFromTable, table, nodeid, pitem) {
  const arr = await dm.dbstore.get('pluginextra', { unit: nodeid });
  return tabledata.formRows(table, arr, pitem.columns);
}

async function unitchannels(dataFromTable, table, nodeid, pitem) {
  const arr = await dm.dbstore.get('devhard', { unit: nodeid });
  const columns = pitem.columns;

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id };
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = datagetter.formLinkObj(table, col, item, item[col.prop]);
        } else if (col.prop.startsWith('realtime_')) {
          row[col.prop] = dataFromTable.realtime ? getRealtimeVal(dataFromTable.realtime, col.prop, item, 'chan') : '';
        } else if (item[col.prop] != undefined) {
          row[col.prop] = item[col.prop];
        } else {
          row[col.prop] = datautil.getEmptyValue(col.type);
        }
      });
      return row;
    });
  return tdata;
}

async function scenecallForScene(dataFromTable, table, nodeid, pitem) {
  const arr = await dm.dbstore.get('scenecalls', { sid: nodeid });
  return tabledata.formRows(table, arr, pitem.columns);
}

function getRealtimeVal(rtData, prop, item, idprop) {
  if (!rtData) return '';
  const id = item[idprop];
  if (!id || !rtData[id] || rtData[id][prop] == undefined) return '';

  const rtx = rtData[id][prop];

  return rtx > 0 && prop.endsWith('ts') ? hut.getDateTimeFor(new Date(rtx)) : rtx;
}

function unitstree(data, table, nodeid, pitem, holder) {
  console.log('WARN: unitstree data='+util.inspect(data)+' nodeid='+nodeid)
  // Таблица экземпляров плагинов - с фильтром по nodeid или полный список
  const unitSet = holder.unitSet;
  const arr = data[table].map(item => {
    const res = { _id: item.id, name: item.title, status: '-', uptime: '-' };
    if (unitSet[item.id]) {
      const laststart = unitSet[item.id].laststart;
      const laststop = unitSet[item.id].laststop;

      if (laststart > 0 && !laststop) {
        res.uptime = hut.timeFormat(Math.floor((Date.now() - laststart) / 1000));
      }
      res.laststart = laststart > 0 ? hut.getDateTimeFor(new Date(laststart)) : '';
      res.laststop = laststop > 0 ? hut.getDateTimeFor(new Date(laststop)) : '';

      res.state = liststore.getTitleFromList('unitStateList', unitSet[item.id].state || 0);
      res.error = unitSet[item.id].error;
    } else {
      res.error = 'Unit not found!';
    }
    return res;
  });
  return tabledata.formRows(table, arr, pitem.columns);
}

async function sysdevice(data, table, nodeid) {
  // __UNIT_modbus1
  if (nodeid) {
    // const _id = nodeid.substr(7);
    const item = liststore.getItemFromList('deviceList', nodeid);
    if (!item) return '';

    item._id = item.id;
    return item;
    // Тоже взять из списка deviceList
    // return deviceutil.getUnitIndicatorObj(_id) || '';
  }

  // Взять устройства - системные индикаторы
  const sysDevices = [];
  const devs = liststore.getListAsArray('deviceList');

  devs.forEach(item => {
    if (item.sys) sysDevices.push(item);
  });

  // Искать для них папку (для плагинов - свои папки)
  // Если не найдено в списке плагинов - размещать в корень
  const unitDocs = await dm.dbstore.get('units', {});
  const uObj = hut.arrayToObject(unitDocs, '_id');

  sysDevices.forEach(item => {
    item._id = item.id;
    const id = item.id.substr(7);
    if (uObj[id]) {
      item.order = uObj[id].order;
      item.parent = uObj[id].parent;
    } else {
      item.order = 10;
      item.parent = 'unitgroup';
    }
  });
  return sysDevices;

  /*
 const arr = await dm.dbstore.get('units', {});
  
  const result =  arr
    .filter(item => !item.folder && item.plugin)
    .map(item => {
      const res = deviceutil.getUnitIndicatorObj(item._id);
      res.dn = res._id;

      res.order = item.order;
      res.parent = item.parent;
      return res;
    });
    console.log('RESULT='+util.inspect(result))
  return result;
  */
}

async function sysdevicegroup(data, table, nodeid) {
  const filter = {};
  if (nodeid) {
    filter._id = nodeid;
  }

  const arr = await dm.dbstore.get('units', filter, { order: 'order' });
  const res = arr.filter(item => item.folder);
  res.forEach(item => {
    if (item.folder && item.parent == 0) item.name = appconfig.getMessage('SystemIndicators');
  });
  return res;
}

async function pluginlog(data, table, nodeid, pitem) {
  // Фильтруется по дереву. Если пришел массив - запрос из папки, иначе плагин уже выбран
  const dataArr = data[table];

  //
  let unitArr;
  if (nodeid.startsWith('dbagent')) {
    unitArr = ['db'];
  } else {
    // const unitArr = ['modbus1','modbus2','modbus3'];
    unitArr = dataArr && dataArr.length ? dataArr.map(item => item.id) : [nodeid];
  }
  unitArr.push('system'); // Общесистемные сообщения во всех журналах

  const arr = await dm.dbstore.get('pluginlog', { unit: { $in: unitArr } }, { order: 'ts' });

  arr.forEach(item => {
    item.realtime_ts = item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'shortdtms') : '';
  });
  return arr;
}

async function devicelog(data, table, nodeid, pitem) {
  // Фильтруется по дереву. Если пришел массив - запрос из папки, иначе устройство уже выбрано
  const dataArr = data[table];

  const didArr = dataArr && dataArr.length ? dataArr.map(item => item.id) : [nodeid];
  didArr.push('system'); // Общесистемные сообщения во всех журналах

  // const arr = await dm.dbstore.get('devicelog', { did: { $in: didArr } }, { order: 'ts' });
  const arr = await dm.dbstore.get('devicelog', { did: { $in: didArr } }, { order: 'ts,_id' });

  arr.forEach(item => {
    item.did_prop = datagetter.getDeviceLinkObj(item.did, item.prop);
    item.realtime_ts = item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'dtms') : '';
  });
  return arr;
}

// Данные по устройству, которые записаны в БД за последний час по всем свойствам
async function dblastrecs(data, table, nodeid, pitem, holder) {
  if (!nodeid || !holder.devSet[nodeid] || !holder.devSet[nodeid].dn) return [];

  const dn = holder.devSet[nodeid].dn;
  const end = Date.now();
  const start = end - 3600 * 1000; // за последний час = 3600 сек

  // const dn_prop = dn + '.value'; // Собрать свойства, которые пишутся в базу сейчас? НЕТ просто  dn_prop =  dn
  const fromDb = await dbconnector.read({ start, end, dn_prop: dn });

  // Данные пришли в виде массива [{dn, prop, val, time}]
  return !fromDb
    ? []
    : fromDb.map((item, idx) => ({
        id: idx + 1,
        dn: item.dn,
        prop: item.prop,
        val: item.val,
        realtime_ts: hut.getDateTimeFor(new Date(item.time), 'dtms')
      }));
}

async function dbmetrics(data, table, nodeid, pitem, holder) {
  // Собрать все что пишется в БД
  const docs = await dm.dbstore.get('devicedb', {});
  const arr = [];
  let i = 0;
  docs.forEach(doc => {
    if (doc.did && doc.prop && doc.dbmet > 0) {
      i++;
      arr.push({
        id: i,
        did: { title: datagetter.getDeviceTitle(doc.did), path: datagetter.getDeviceDbFormUrl(doc.did) },
        prop: doc.prop,
        dbmet: liststore.getTitleFromList('dbmetList', doc.dbmet),
        dbtm: doc.dbmet == 3 ? doc.dbtm : '-',
        dbcalc_type: doc.dbmet == 3 ? liststore.getTitleFromList('dbcalc_typeList', doc.dbcalc_type) : '-',
        dbdelta: doc.dbmet == 1 ? doc.dbdelta : '-',
        dbforce: doc.dbmet == 1 ? doc.dbforce : '-'
      });
    }
  });
  return arr;
}

module.exports = {
  typepropsTable: typeprops,
  devicecommonTable: devicecommon,
  devicesceneTable: devicescene,
  devicevisTable: devicevis,
  dialoglinksTable: dialoglinks,
  templateusageTable: templateUsage,
  devicedb: deviceDb,
  devicesTreeTable: devicestree,
  globalsTreeTable: globalstree,
  imagesTreeTable: imagestree,
  typesTreeTable: typestree,
  dialogsTreeTable: dialogstree,
  templatesTreeTable: templatestree,
  layoutsTreeTable: layoutstree,
  viscontsTreeTable: viscontstree,
  snippetsTreeTable: snippetstree,
  snippetusageTable: snippetUsage,
  scenesTreeTable: scenestree,
  scenecall: scenecallForScene,
  typedevicesTable: typedevices,
  unitchannelsTable: unitchannels,
  unitextTable: unitext,
  unitsTreeTable: unitstree,
  sysdeviceTable: sysdevice,
  sysdevicegroupTable: sysdevicegroup,
  pluginlogTable: pluginlog,
  projectsTreeTable: projectstree,
  devicelogTable: devicelog,
  dblastrecsTable: dblastrecs,
  dbmetricsTable: dbmetrics
};
