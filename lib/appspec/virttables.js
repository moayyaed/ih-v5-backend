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

const tabledata = require('../api/tabledataformer');
const datautil = require('../api/datautil');
const liststore = require('../dbs/liststore');

const datagetter = require('./datagetter');
const projectdata = require('./projectdata');

/** ВИРТУАЛЬНЫЕ ТАБЛИЦЫ */

/** typepropsTable
 * Список свойств для типа nodeid
 * Добавляется поле fname - имя используемой функции-обработчика с учетом Default
 */
async function typeprops(dataFromTable, table, nodeid, pitem, holder) {
  const arr = await tabledata.formTableData(dataFromTable, table, nodeid, pitem);
  const typeProps = holder.typeMap.get(nodeid) ? holder.typeMap.get(nodeid).props : {};

  arr.forEach(item => {
    if (item.id && typeProps[item.id]) {
      const fname = typeProps[item.id].fname || '';
      item.fname = datautil.getDroplistItemFromList('handlerList', fname);
    }
  });
  return arr;
}

/** handletypesTable
 * Список типов, которые используют функцию-обработчик nodeid
 * Массив строится с нуля, имена столбцов в таблице: id, type_link (type:"link")
 */
async function handletypes(dataFromTable, table, nodeid, pitem) {
  const arr = datagetter.getTypePropsWithFname(nodeid); // [{typeId, prop, fname}]

  arr.forEach(item => {
    item.id = item.typeId + '_' + item.prop;
    const typeListItem = liststore.getItemFromList('typeList', item.typeId);
    item.type_link = { title: typeListItem.title, path: datagetter.getTypePath(item.typeId) };
  });
  return arr;
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

    // Данные канала
    addHardProps(hObj, item, dobj._id, prop);
    result.push(item);
  });

  // Типовые команды
  typeItem.commands.forEach(prop => {
    const item = getItem(prop, typeItem.props[prop].name || prop, getTypeOpTitle({ op: 'cmd' }), {
      title: typename,
      path: typePath
    });
    // Данные канала
    addHardProps(hObj, item);
    result.push(item);
  });

  // Добавить свойства extProps
  const extProps = dobj.extProps;
  if (extProps) {
    Object.keys(extProps).forEach(prop => {
      if (!typeItem.props[prop]) {
        const scene = extProps[prop].scene;
        const ext = extProps[prop].ext;

        const sceneListItem = liststore.getItemFromList('sceneList', scene);
        const item = getItem(prop, ext.note, 'Scene Parameter Number', {
          title: 'Сценарий ' + sceneListItem.name,
          path: 'scenes/scenes/scenescript/' + scene + '/tabSceneCodeEditor'
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
      type_propname,
      type_op,
      source,
      min: '',
      max: '',
      dig: '',
      mu: '',
      unit: '',
      chan: { title: '', path: '' }
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
    const scenePath = 'scenes/scenes/scenescript/' + scene + '/tabSceneCodeEditor';
    result.push({ id: scene, scene_id: scene, scene_name: { title: sceneListItem.name, path: scenePath } });
  });
  return result;
}

async function devicevis(dataFromTable, table, nodeid, pitem, holder) {
  if (!holder.devSet[nodeid]) return [];
  const did = nodeid;

  // По списку контейнеров получить объекты и выбрать ссылки на устройство
  const contList = liststore.getListMap('containerList');
  if (!contList) return [];

  const result = [];
  for (let id of contList.keys()) {
    // const uppobj = await dm.getCachedData({ type: 'uppobj', id: 'container', nodeid: id, method: 'get' }, getUpPobj);
    const uppobj = await projectdata.getCachedUpProjectObj({ id: 'container', nodeid: id });
    const templateObj = {};
    if (uppobj && uppobj.data && uppobj.data[did]) {
      let str = '';
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
          if (str) str += ';  ';
          str += t + ':' + templateObj[t].join(',');
        }
      });

      // /vis/viscont/viscontview/vc002/tabViscontEditor
      // const path = 'vis/viscont/viscontview/' + id + '/tabViscontEditor';
      // const container_name = { title: item.title, path };
      result.push({
        id,
        container_id: id,
        container_name: containerNameAsLink(id, contList.get(id)),
        content_str: str
      });
    }
  }
  return result;
}

function containerNameAsLink(id, item) {
  const path = 'vis/viscont/viscontview/' + id + '/tabViscontEditor';
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

function addHardProps(hObj, item, did, prop) {
  item.unit = '';
  item.chan = { title: '', path: '', value:{did, prop} };
  // Данные канала
  if (hObj[item.prop]) {
    const unit = hObj[item.prop].unit;
    const chan = hObj[item.prop].chan;
    item.unit = unit;
    
    
    item.chan = datagetter.formLinkObj(
      'devicecommonTable',
      { prop: 'chan' },
      { unit, chan, _id: hObj[item.prop]._id },
      chan
    );
    item.chan.value = {did, prop};

  }
}

async function devicedb(dataFromTable, table, nodeid, pitem, holder) {
  let pObj = tabledata.getGenfieldObjFromDataRecord(dataFromTable, table, pitem);
  if (!pObj) pObj = {};

  // Добавить свойства из types, если не все свойства сохранены (сохраняются только те, что редактируются)
  // Также нужно удалить свойство, если его уже нет в типе? Это делать на уровне редактирования типов??

  const typeItem = holder.devSet[nodeid] ? holder.devSet[nodeid].typeobj : {};
  const arr = [];
  typeItem.proparr.forEach(titem => {
    const prop = titem.prop;
    if (titem.op != 'cmd') arr.push({ id: prop, newid: prop, ...pObj[prop] });
  });
  // Сформировать данные по столбцам
  return tabledata.formColumnVals(pitem.columns, arr);
}

// Таблицы получаем из дерева, поля id, title, path, остальные значения из списка
async function typestree(data, table, nodeid, pitem) {
  const typeList = liststore.getListMap('typeList');
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item, typeList.get(item.id)));
  return tabledata.formRows(table, arr, pitem.columns);
}

async function scenestree(data, table, nodeid, pitem) {
  // const typeList = liststore.getListMap('typeList');
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

async function imagestree(data, table, nodeid, pitem) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));
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
  // Таблица экземпляров плагинов - с фильтром по nodeid или полный список
  // const typeList = liststore.getListMap('typeList');
  // const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item, typeList.get(item.id)));
  const unitSet = holder.unitSet;
  const arr = data[table].map(item => {
    const res = { _id: item.id, name: item.title, status: '-', uptime: '-' };
    // status
    const laststart = unitSet[item.id].laststart;
    const laststop = unitSet[item.id].laststop;
    if (unitSet[item.id]) {
      if (laststart > 0 && !laststop) {
        res.uptime = hut.timeFormat(Math.floor((Date.now() - laststart) / 1000));
      }
      res.laststart = laststart > 0 ? hut.getDateTimeFor(new Date(laststart)) : '';
      res.laststop = laststop > 0 ? hut.getDateTimeFor(new Date(laststop)) : '';
      res.error = unitSet[item.id].error;
    } else {
      res.error = 'Unit not found!';
    }
    return res;
  });
  return tabledata.formRows(table, arr, pitem.columns);
}

async function pluginlog(data, table, nodeid, pitem) {
  // Фильтруется по дереву. Если пришел массив - запрос из папки, иначе плагин уже выбран
  const dataArr = data[table];

  // const unitArr = ['modbus1','modbus2','modbus3'];
  const unitArr = dataArr && dataArr.length ? dataArr.map(item => item.id) : [nodeid];
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
    item.did_prop = { title: datagetter.getDeviceTitle(item.did) + (item.prop ? ' ▪︎ ' + item.prop : ''), path: 'dev/devices/deviceview/' + item.did + '/tabDeviceCommon' };

    item.realtime_ts = item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'dtms') : '';
  });
  return arr;
}

module.exports = {
  typepropsTable: typeprops,
  handlertypesTable: handletypes,
  devicecommonTable: devicecommon,
  devicesceneTable: devicescene,
  devicevisTable: devicevis,
  templateusageTable: templateUsage,
  devicedbTable: devicedb,
  devicesTreeTable: devicestree,
  imagesTreeTable: imagestree,
  typesTreeTable: typestree,
  scenesTreeTable: scenestree,
  scenecall: scenecallForScene,
  typedevicesTable: typedevices,
  unitchannelsTable: unitchannels,
  unitextTable: unitext,
  unitsTreeTable: unitstree,
  pluginlogTable: pluginlog,
  devicelogTable: devicelog
};
