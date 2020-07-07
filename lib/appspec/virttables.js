/**
 *  virttables.js
 *  Экспортирует таблицу функций, которые вызываются для формирования виртуальных таблиц
 */
const util = require('util');
const hut = require('../utils/hut');
const dm = require('../datamanager');

const tabledata = require('../api/tabledataformer');
const datautil = require('../api/datautil');
const liststore = require('../dbs/liststore');

const datagetter = require('./datagetter');
const loadsys = require('../utils/loadsys');

/** ВИРТУАЛЬНЫЕ ТАБЛИЦЫ */

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

async function devicecommon(dataFromTable, table, nodeid, pitem, holder) {
  if (!holder.devSet[nodeid]) return [];

  const result = [];
  const dobj = holder.devSet[nodeid];

  const arr = await tabledata.formTableData(dataFromTable, table, nodeid, pitem);

  // Добавить данные каналов
  const hrec = await dm.dbstore.get('devhard', { did: nodeid });
  const hObj = hut.arrayToObject(hrec, 'prop');

  // Добавить свойства типа
  const typePath = 'dev/types/typeview/' + holder.devSet[nodeid].type + '/tabTypeProps';
  const typeItem = holder.devSet[nodeid] ? holder.devSet[nodeid].typeobj : {};

  arr.forEach(item => {
    // if (!typeItem.props[item.prop].command) {
    item.prop = item.id;
    // Из типа
    if (typeItem.props[item.prop]) {
      /**
      item.type_propname = { title: typeItem.props[item.prop].name, path: typePath };
      // item.type_vtype = { title: typeItem.props[item.prop].vtype, path: typePath };
      item.type_op = {
        title: getTypeOpTitle(typeItem, item.prop),
        path: typePath
      };
       */
      item.type_propname = typeItem.props[item.prop].name;
      item.type_op = getTypeOpTitle(typeItem, item.prop);
      item.source = { title: 'Тип', path: typePath };
    }
    // Данные канала
    addHardProps(hObj, item);

    // Добавить текущее состояние
    if (dataFromTable.realtime[item.prop]) {
      const dItem = dataFromTable.realtime[item.prop];
      item.realtime_dev_val = dItem.realtime_dev_val;
      item.realtime_dev_ts = dItem.realtime_dev_ts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_ts)) : '';
      item.realtime_dev_cts = dItem.realtime_dev_cts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_cts)) : '';
      item.realtime_dev_err = dItem.realtime_dev_err;
    }
    result.push(item);
    // }
  });

  // Добавить свойства extProps

  const extProps = dobj.extProps;
  // console.log('EXT '+dobj._id+util.inspect(dobj))

  if (extProps) {
    Object.keys(extProps).forEach(prop => {
      if (!typeItem.props[prop]) {
        const scene = extProps[prop].scene;
        const ext = extProps[prop].ext;
        const scenePath = 'scenes/scenes/scenescript/' + scene + '/tabSceneCodeEditor';
        const sceneListItem = liststore.getItemFromList('sceneList', scene);

        result.push({
          id: prop,
          prop,
          type_propname: ext.note,
          type_op: 'Scene Parameter Number',
          source: { title: sceneListItem.name, path: scenePath },
          min: '',
          max: '',
          dig: '',
          mu: '',
          unit: '',
          chan: ''
        });
      }
    });
  }
  // А уж потом реалтайм

  return result;
}

function getTypeOpTitle(typeItem, prop) {
  const vtypeList = { N: 'Number', B: 'Bool', S: 'String' };
  const opList = { rw: 'Data', r: 'Data', calc: 'Calculated', cmd: 'Command', par: 'Parameter' };

  const vt = typeItem.props[prop].op == 'cmd' ? '' : ' ' + vtypeList[typeItem.props[prop].vtype];
  // Объединить op и vtype
  return opList[typeItem.props[prop].op] + vt;
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

  // По списку контейнеров получить объекты и выбрать по устройству
  // const contArr = liststore.getListAsArray('containerList');
  const contList = liststore.getListMap('containerList');
  if (!contList) return [];

  const result = [];

  for (let key of contList.keys()) {
    const id = key;
    const item = contList.get(key);
    
    const uppobj = await dm.getCachedData({ type: 'uppobj', id: 'container', nodeid: id, method: 'get' }, getUpPobj);

   
    // /vis/viscont/viscontview/vc002/tabViscontEditor
    if (uppobj && uppobj.data && uppobj.data[did]) {
      // str = JSON.stringify(uppobj.data[did]);
      let str = '';
       // {"state":[{"el":"template_4","varname":"state1"}]}
      Object.keys(uppobj.data[did]).forEach(prop => {
       let elArr = [];
        uppobj.data[did][prop].forEach(elItem => {
          elArr.push(elItem.el);
        });
        str += "Свойство: "+prop+" => "+elArr.join(',')+"  ";
      });
      const path = 'vis/viscont/viscontview/' + id + '/tabViscontEditor';
      const container_name = { title: item.title, path };
      result.push({ id, container_id: id, container_name, content_str: str });
    }
  }
  return result;
}

async function getCachedProjectObj(id, nodeid) {
  const cachedObj = await dm.getCachedData({ type: 'pobj', id, nodeid }, getProjectObj);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached project object ' + id + ' ' + nodeid };
  return cachedObj.data;
}

async function getProjectObj({ id, nodeid }) {
  // Загрузить объект из соотв папки проекта.
  const folders = ['layout', 'container', 'template'];
  if (!folders.includes(id)) throw { err: 'SOFTERR', message: 'Unknown project object id: ' + id };

  return loadsys.loadProjectJson(id, nodeid);
}

async function getUpPobj(query) {
  const { id, nodeid } = query;
  const res = {};

  // Получить исходный объект
  const pobj = await getCachedProjectObj(id, nodeid);
  if (!pobj || !pobj.elements) return {};

  // Вывернуть по did
  Object.keys(pobj.elements).forEach(el => {
    if (pobj.elements[el].type == 'template' && pobj.elements[el].links && typeof pobj.elements[el].links == 'object') {
      const links = pobj.elements[el].links;
      Object.keys(links).forEach(varname => {
        if (typeof links[varname] == 'object') {
          const did = links[varname].did;
          const prop = links[varname].prop;
          if (did && prop) {
            if (!res[did]) res[did] = {};
            if (!res[did][prop]) res[did][prop] = [];
            res[did][prop].push({ el, varname });
          }
        }
      });
    }
  });
  return res;
}

// НЕ ИСПОЛЬЗУЕТСЯ
async function devicecommand(dataFromTable, table, nodeid, pitem, holder) {
  if (!holder.devSet[nodeid]) return [];

  const result = [];
  const arr = await tabledata.formTableData(dataFromTable, table, nodeid, pitem);

  // Добавить данные каналов
  const hrec = await dm.dbstore.get('devhard', { did: nodeid });
  const hObj = hut.arrayToObject(hrec, 'prop');

  // Добавить свойства типа
  const typePath = 'dev/types/typeview/' + holder.devSet[nodeid].type + '/tabTypeCommon';
  const typeItem = holder.devSet[nodeid].typeobj;
  if (!typeItem) return [];

  arr.forEach(item => {
    if (typeItem.props[item.prop].command) {
      item.prop = item.id;
      // Из типа
      if (typeItem.props[item.prop]) {
        item.type_propname = { title: typeItem.props[item.prop].name, path: typePath };
        item.type_op = {
          title: 'Command',
          path: typePath
        };
      }
      // Данные канала
      addHardProps(hObj, item);
      result.push(item);
    }
  });

  return result;
}

function addHardProps(hObj, item) {
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

module.exports = {
  typepropsTable: typeprops,
  devicecommonTable: devicecommon,
  devicesceneTable: devicescene,
  devicevisTable: devicevis,
  devicecommandTable: devicecommand, // Не используется
  devicedbTable: devicedb,
  devicesTreeTable: devicestree,
  imagesTreeTable: imagestree,
  typesTreeTable: typestree,
  scenesTreeTable: scenestree,
  scenecall: scenecallForScene,
  typedevicesTable: typedevices,
  unitchannelsTable: unitchannels,
  unitextTable: unitext
};
