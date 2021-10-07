/* eslint-disable object-shorthand */
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

const dbconnector = require('../dbconnector');
const logconnector = require('../log/logconnector');
const appconfig = require('../appconfig');

const hut = require('../utils/hut');
const imageutil = require('../utils/imageutil');
// const projectutil = require('../utils/projectutil');

const tabledata = require('../api/tabledataformer');
const datautil = require('../api/datautil');
const liststore = require('../dbs/liststore');

const projectdata = require('../appspec/projectdata');
const widgetdata = require('../appspec/widgetdata');
const pluginutil = require('../plugin/pluginutil');

const domaindata = require('./domaindata');
const mobiledeviceutil = require('../mobile/mobiledeviceutil');

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
  if (datautil.isLink(nodeid)) {
    // t003.state
    const [type, prop] = nodeid.split('.');
    // const prop = nodeid.split('.').pop();

    let propItem;
    if (prop) {
      // propItem = prop.startsWith('_On') ? { id: prop, errstr: getOnErrstr(prop), fuse: 2 } : arr.find(item => item.id == prop);
      propItem = prop.startsWith('_On')
        ? { id: prop, errstr: getOnErrstr(prop), fuse: 2 }
        : prop.startsWith('_format')
        ? { id: prop, errstr: getFormatErrstr(prop), fuse: 2 }
        : arr.find(item => item.id == prop);

      if (propItem) {
        propItem.blkstr = getBlkstr(type, prop);
        propItem.errstr = propItem.errstr || '';
        propItem.fuse = propItem.fuse || 0;
        propItem.fuse_name = liststore.getTitleFromList('fuseList', propItem.fuse);
        propItem.when_str = getWhenStr(propItem.op, propItem.id);
      }
    }
    return propItem || {};
  }

  arr.forEach(item => {
    item.fuse = item.fuse || 0;
  });
  return tabledata.formColumnVals(pitem.columns, arr, holder);
  /*
  const rarr = await tabledata.formColumnVals(pitem.columns, arr, holder);
  console.log('VIRTTABLE rarr='+util.inspect(rarr))
  rarr.forEach(item => {
    console.log(util.inspect(item));
    item.fuse = item.fuse || 0;
    item.fuse_link = getHandlerLinkObj(item);
  });
  return rarr;

  function getHandlerLinkObj(item) {
    const path = `dev/types/typeview/${nodeid}/tabTypeHandlers/typeprophandler/${nodeid}.${item.id}`;
    // /dev/types/typeview/t006/tabTypeHandlers/typeprophandler/t006.value
    return { title: `${nodeid}.${item.id}`, path };
  }
  */

  function getBlkstr(type, hprop) {
    const hanid = type + '_' + hprop;
    if (holder.traceSet[hanid]) {
      if (holder.traceSet[hanid].blk) return 'БЛОКИРОВАН: ' + holder.traceSet[hanid].error;
    }
  }

  function getOnErrstr(prop) {
    return rec['err' + prop] || '';
  }

  function getFormatErrstr(inprop) {
    const prop = inprop.substr(8);
    const one = arr.find(item => item.id == prop);
    return one && one.errstr_format ? one.errstr_format : '';
  }

  function getWhenStr(op, prop) {
    if (prop.startsWith('_format')) return 'При выводе значения "' + prop.substr(8) + '" в виде строки';
    if (prop.startsWith('_On')) {
      if (prop == '_OnChange') {
        let str = rec.par_OnChange
          ? rec.par_OnChange != '*'
            ? 'свойств ' + rec.par_OnChange
            : ' любого свойства устройства'
          : '';

        if (rec.par2_OnChange && rec.par2_OnChange != '-') {
          const item = liststore.getItemFromList('globalList', rec.par2_OnChange);
          const glDn = item && item.dn ? item.dn : rec.par2_OnChange + '(имя не определено?)';
          if (str) str += ', ';
          str += ' глобальной переменной ' + glDn;
        }
        if (!str) str = 'УСЛОВИЕ НЕ ЗАДАНО!';
        return 'При изменении ' + str;
      }

      if (prop == '_OnInterval')
        return 'Циклически каждые ' + (rec.par_OnInterval != undefined ? rec.par_OnInterval : 600) + ' сек';

      if (prop == '_OnSchedule') return 'По расписанию: ' + rec.par_OnSchedule;

      if (prop == '_OnBoot') return 'При запуске системы';
    }

    switch (op) {
      case 'calc':
        return 'При изменении свойств устройства для вычисления "' + prop + '"';
      case 'cmd':
        return 'При вызове команды "' + prop + '"';
      default:
        return 'При поступлении данных для приема значения "' + prop + '"';
    }
  }
}

//
async function typepropalertSelect(dataFromTable, table, nodeid, pitem, holder) {
  if (!nodeid || !nodeid.indexOf('.')) throw { message: 'Expected nodeid as type.prop!!' };

  const [type, prop] = nodeid.split('.');
  const rec = await holder.dm.findRecordById('type', type);

  // prop.vtype из документа
  if (!rec) throw { message: 'Not found type=' + type };
  if (!rec.props || !rec.props[prop]) throw { message: 'Not found prop=' + prop + ' in type=' + type };
  if (!rec.props[prop].ale) return []; // Отключены тревоги для свойства
  return { ale: rec.props[prop].ale, vtype: rec.props[prop].vtype };
}

async function typepropalert(dataFromTable, table, nodeid, pitem, holder) {
  if (!nodeid || !nodeid.indexOf('.')) throw { message: 'Expected nodeid as type.prop!!' };

  const [type, prop] = nodeid.split('.');
  const rec = await holder.dm.findRecordById('type', type);

  // prop.vtype из документа
  if (!rec) throw { message: 'Not found type=' + type };
  if (!rec.props || !rec.props[prop]) throw { message: 'Not found prop=' + prop + ' in type=' + type };
  if (!rec.props[prop].ale) return []; // Отключены тревоги для свойства
  const vtype = rec.props[prop].vtype;

  // alerts:{state:{level, delay, mess, ..}}
  let pObj = rec.alerts && rec.alerts[prop] ? rec.alerts[prop] : '';

  if (!pObj || !domaindata.isSuitableAlerts(vtype, pObj)) {
    // Если записи нет - добавить исходя из типа свойства
    // Если тип свойства изменился - удалить и добавить заново?
    pObj = domaindata.getDefaultalerts(vtype);
  }

  const arr = tabledata.transfromGenfieldObjToArray(pObj);

  if (!arr || !arr.length) return [];
  arr.forEach(item => {
    item.title = liststore.getTitleFromList('HiLoList', item.id);
  });

  return tabledata.formColumnVals(pitem.columns, arr, holder);
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

  const dobj = holder.devSet[nodeid];
  const result = dobj.sys ? formSysDeviceProps() : await formDeviceProps();

  result.forEach(item => {
    // Добавить текущее состояние
    if (dataFromTable.realtime[item.prop]) {
      const dItem = dataFromTable.realtime[item.prop];
      item.realtime_dev_val = dItem.realtime_dev_val;
      item.valstr = dItem.realtime_dev_fval != undefined ? dItem.realtime_dev_fval : dItem.realtime_dev_val;
      // item.valstr = dobj.formatValue(item.prop, dItem.realtime_dev_val);

      item.realtime_dev_ts = dItem.realtime_dev_ts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_ts)) : '';
      item.realtime_dev_cts = dItem.realtime_dev_cts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_cts)) : '';
      item.realtime_dev_err = dItem.realtime_dev_err;
    }
  });

  return result;

  function formSysDeviceProps() {
    return dobj.getPropsForVislink().map(prop => ({
      id: prop,
      prop,
      type_propname: dobj.getPropTitle(prop)
    }));
  }

  function getType_fuse(prop, typeItem) {
    return {
      title: liststore.getTitleFromList('fuseList', typeItem.props[prop].fuse),
      // typeItem.props[prop].handler && !typeItem.props[prop].handler.blk
      //  ? liststore.getTitleFromList('fuseList', typeItem.props[prop].fuse)
      //  : 'БЛОКИРОВАН',
      path: domaindata.getTypeHandlerPath(dobj.type, prop)
    };
  }

  // type_fuse на форме убрано: { "prop": "type_fuse", "title": "Обработчик", "type": "link", "width": 150, "command": "forward" }
  function getItem(prop, type_propname, type_op, source, type_fuse = { title: '', path: '' }) {
    return {
      id: prop,
      prop,
      chanlink: { title: '', path: '' },
      type_propname,
      type_op,
      type_fuse,
      source,
      min: '',
      max: '',
      dig: '',
      mu: '',
      unit: '',
      _inputval: ''
    };
  }

  async function formDeviceProps() {
    const res = [];
    const devrec = await holder.dm.findRecordById('device', nodeid);
    if (!devrec) return [];

    const snipuse = devrec.snipuse;

    // Берем типовые свойства - значения
    const typeItem = domaindata.getTypeobj(dobj.type);

    const typename = 'Тип ' + typeItem.item.name;
    const typePath = domaindata.getTypePath(dobj.type);

    //  типовые свойства - значения
    typeItem.proparr.forEach(propItem => {
      const prop = propItem.prop;
      const item = getItem(
        prop,
        typeItem.props[prop].name || prop,
        getTypeOpTitle(typeItem.props[prop]),
        {
          title: typename,
          path: typePath
        },
        getType_fuse(prop, typeItem)
      );

      item.min = dobj.getMin(prop);
      item.max = dobj.getMax(prop);
      item.dig = dobj.getDig(prop);
      item.mu = dobj.getMu(prop);
      item.save = dobj.getSave(prop);

      // Данные канала
      item.snipuse = snipuse;
      if (!item.snipuse) addHardProps(dobj, prop, item);

      res.push(item);
    });

    // Типовые команды
    typeItem.commands.forEach(prop => {
      const item = getItem(
        prop,
        typeItem.props[prop].name || prop,
        getTypeOpTitle({ op: 'cmd' }),
        {
          title: typename,
          path: typePath
        },
        getType_fuse(prop, typeItem)
      );

      // Данные канала
      item.snipuse = snipuse;
      if (!item.snipuse) addHardProps(dobj, prop, item);
      res.push(item);
    });

    // Добавить свойства extProps
    const extProps = dobj.extProps;
    if (extProps) {
      Object.keys(extProps).forEach(prop => {
        if (!typeItem.props[prop]) {
          const scene = extProps[prop].scenes[0]; // Всегда берем первый сценарий, где свойство упоминается

          const title = domaindata.getDeviceScenePropTitle(scene, devrec.dn, prop, holder);
          const item = getItem(prop, title, 'Scene Parameter', domaindata.getSceneLinkObj(scene));

          res.push(item);
        }
      });
    }

    // error - системное свойство
    res.push(getItem('error', 'Ошибка', 'System', { title: '', path: '' }));
    return res;
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
  if (!holder.devSet[nodeid]) return [];
  const dobj = holder.devSet[nodeid];
  const dn = dobj.dn;

  const result = [];

  if (holder.devsceneSet[dn]) {
    holder.devsceneSet[dn].forEach(id => {
      const scene_link = domaindata.getSceneLinkObj(id);
      const sceneObj = holder.sceneSet[id] || {};
      const { realdevs, laststart, laststop, active, blk, error } = sceneObj;

      result.push({
        id,
        scene_id: id,
        scene_link,
        realdevs,
        laststartStr: getTimeStr(laststart),
        laststopStr: getTimeStr(laststop),
        error,
        scene_state: domaindata.getSceneStateStr(active, blk)
      });
    });
  }
  return result;
}

async function scenestate(dataFromTable, table, nodeid, pitem, holder) {
  const scenes = [];

  // Обычный сценарий один или экземпляры мультисценариев
  if (holder.sceneSet[nodeid]) {
    scenes.push({ ...holder.sceneSet[nodeid] });
  } else {
    Object.keys(holder.sceneSet).forEach(id => {
      if (holder.sceneSet[id] && id.startsWith(nodeid + '#')) {
        const name = '(' + holder.sceneSet[id].realdevs + ')';
        scenes.push({ ...holder.sceneSet[id], name });
      }
    });
  }

  const arr = scenes.map(item => {
    item.state = item.active;
    const res = datautil.getStatusObj(item, 'sceneStateList');
    res.rowbutton =
      item.active == 1 ? { title: 'Stop', command: 'stopscene' } : { title: 'Start', command: 'startscene' };
    return res;
  });

  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function dialoglinks(dataFromTable, table, nodeid, pitem, holder) {
  const result = await projectdata.getElementLinks('dialog', nodeid, holder.dm);
  result.forEach(item => {
    item.device_name = item.did && item.did.startsWith('__dev') ? 'Любое' : domaindata.getDeviceTitle(item.did);
    item.sprop = item.did.startsWith('__devstat') ? item.prop : '';
    item.dprop = !item.sprop ? item.prop : '';
  });
  return result;
}

async function devicevis(dataFromTable, table, nodeid, pitem, holder) {
  const did = nodeid;
  const result = [];
  let uppobj;

  // По списку контейнеров получить объекты и выбрать ссылки на устройство
  const contList = liststore.getListMap('containerList');
  for (let id of contList.keys()) {
    uppobj = await projectdata.getCachedUpProjectObj({ id: 'container', nodeid: id }, holder.dm);
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
    uppobj = await projectdata.getCachedUpProjectObj({ id: 'layout', nodeid: id }, holder.dm);
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
  const title = `${appconfig.getMessage('Container')}: ${item.title || id}`;
  return { title, path };
}

function layoutNameAsLink(id, item) {
  const path = 'vis/layout/layoutview/' + id + '/tabLayoutEditor';
  const title = `${appconfig.getMessage('Layout')}: ${item.title || id}`;
  return { title, path };
}

async function templateUsage(dataFromTable, table, nodeid, pitem, holder) {
  const templateId = nodeid;
  // По списку контейнеров получать контейнеры, искать шаблон
  const contList = liststore.getListMap('containerList');
  if (!contList) return [];

  const result = [];
  for (let containerId of contList.keys()) {
    // const item = contList.get(key);
    const elArr = await projectdata.findTemplateUsageForContainer(templateId, containerId, holder.dm);
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
  const glDocs = gather(await holder.dm.dbstore.get('globals', { snipid: nodeid }));
  const dvDocs = gather(await holder.dm.dbstore.get('devices', { snipid: nodeid }));
  return [...glDocs, ...dvDocs];

  function gather(docs) {
    const arr = [];
    docs.forEach(doc => {
      if (doc.snipuse) {
        arr.push({ id: doc._id, did: domaindata.getDeviceLinkObj(doc._id), period: doc.snipperiod });
      }
    });
    return arr;
  }
}

function addHardProps(dobj, prop, item) {
  item.chanlink = { title: '', path: '' };

  // Данные канала
  const chanObj = dobj.getChannelLink(prop); // {_id, unit, chan}
  if (chanObj) {
    item.chanlink = domaindata.getChannelLinkObj(chanObj._id, chanObj.unit, chanObj.chan);
  }
}

async function deviceDb(dataFromTable, table, nodeid, pitem, holder) {
  if (!nodeid) return [];

  const arr = [];
  if (nodeid.startsWith('gl')) {
    const globj = holder.global.getItem(nodeid);
    if (!globj) return [];
    const dbrec = await holder.dm.findRecordById('devicedb', nodeid);

    if (dbrec) {
      arr.push(dbrec);
    } else {
      arr.push({ id: nodeid, did: nodeid, prop: 'globals' });
    }
  } else {
    const dobj = holder.devSet[nodeid];
    if (!dobj) return [];

    // Данные из devicedb - хранятся в виде строк did, prop, ...
    const dbrec = await holder.dm.dbstore.get('devicedb', { did: nodeid });
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
  return tabledata.formColumnVals(pitem.columns, arr, holder);
}

// Таблицы получаем из дерева, поля id, title, path, остальные значения из списка
async function typestree(data, table, nodeid, pitem, holder) {
  const typeList = liststore.getListMap('typeList');
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item, typeList.get(item.id)));
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function typePropsAlertTree(data, table, nodeid, pitem, holder) {
  const typeList = liststore.getListMap('typeList');
  const arr = [];

  data[table].forEach(item => {
    const typeObj = domaindata.getTypeobj(item.id);
    if (typeObj && typeObj.props) {
      const resObj = typeList.get(item.id); // {id, title}
      Object.keys(typeObj.props).forEach(prop => {
        if (typeObj.props[prop].ale && typeObj.alerts && typeObj.alerts[prop]) {
          const xalerts = typeObj.alerts[prop];
          const vtype = typeObj.props[prop].vtype;
          const alertruleStr = vtype == 'N' ? hiLoAlertStr(xalerts) : binAlertStr(xalerts);
          const alertCloseStr = vtype == 'N' ? hiLoCloseStr(xalerts) : binCloseStr(xalerts);

          arr.push({
            id: item.id + '.' + prop,
            title: { title: resObj.title, path: getTypePropPath(item.id) },
            prop,
            propalert: { title: alertruleStr, path: getTypepropalertPath(item.id, prop) },
            propclose: alertCloseStr
          });
        }
      });
    }
  });

  // return tabledata.formRows(table, arr, pitem.columns, holder);
  return arr;

  // dev/types/typeview/intra@termostat/tabTypeProps
  function getTypePropPath(typeId) {
    return 'dev/types/typeview/' + typeId + '/tabTypeProps';
  }

  // dev/types/typeview/t007/tabTypeAlerts/typepropalert/t007.cpu1
  function getTypepropalertPath(typeId, prop) {
    return 'dev/types/typeview/' + typeId + '/tabTypeAlerts/typepropalert/' + typeId + '.' + prop;
  }

  function binAlertStr(rules) {
    return rules && rules.Alert ? rules.Alert.theval + ': ' + rules.Alert.message : '';
  }

  function hiLoAlertStr(rules) {
    if (!rules) return '';

    const rule = rid => (rules[rid] && rules[rid].use ? rid + '=' + rules[rid].theval + ' ' : '');
    let res = '';
    ['LoLo', 'Lo', 'Hi', 'HiHi'].forEach(rid => {
      res += rule(rid);
    });

    return res;
  }

  function binCloseStr(rules) {
    let res = '';
    if (rules && rules.Alert && rules.Alert.theval != undefined) {
      if (rules.Alert.toClose) {
        res = liststore.getTitleFromList('alertToCloseList', rules.Alert.toClose);
      } else res = '??';
      res = rules.Alert.theval + ': ' + res;
    }
    return res;
  }

  function hiLoCloseStr(rules) {
    if (!rules) return '';

    const rule = rid =>
      rules[rid] && rules[rid].use
        ? rid + ': ' + liststore.getTitleFromList('alertToCloseList', rules[rid].toClose) + ' '
        : '';
    let res = '';
    ['LoLo', 'Lo', 'Hi', 'HiHi'].forEach(rid => {
      res += rule(rid);
    });
    return res;
  }
}

async function dialogstree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function templatestree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function layoutstree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function viscontstree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function visscriptstree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => item);
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function scenestree(data, table, nodeid, pitem, holder) {
  const arr = [];
  data[table].forEach(item => {
    item.scene_link = getSceneLink(item.id);
    const sceneListItem = liststore.getItemFromList('sceneList', item.id);
    if (sceneListItem) {
      item.multi_str = sceneListItem.multi ? 'Мультисценарий' : '';
      item.blk_str = sceneListItem.blk ? 'Блокирован' : '';
    }
    arr.push(item);
  });
  return arr;
}

async function schedrulestree(data, table, nodeid, pitem, holder) {
  const arr = [];
  for (const doc of data[table]) {
    const id = doc.id;
    const rec = await holder.dm.findRecordById('schedcurrent', id);
    arr.push({ ...doc, ...rec });
  }

  return arr.sort(hut.byorder('w_ts')).map(item => {
    const willstartStr = isNaN(item.w_ts) ? item.w_ts : getTimeStr(item.w_ts);
    const laststartStr = getTimeStr(item.l_ts);
    const sched_link = { title: item.title, path: domaindata.getSchedrulePath(item.id) };
    return { id: item.id, sched_link, willstartStr, laststartStr, errstr: item.errstr };
  });
}

async function snippetstree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function restapihandlerstree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function devicestree(data, table, nodeid, pitem, holder) {
  const typeList = liststore.getListMap('typeList');
  const deviceList = liststore.getListMap('deviceList');

  const arr = data[table].map(item => {
    const devItem = deviceList.get(item.id);
    const typeTitle = devItem && devItem.type && typeList.has(devItem.type) ? typeList.get(devItem.type).title : '';
    return Object.assign({ _id: item.id, 'type#title': typeTitle }, item, devItem);
  });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function sysdevicestree(data, table, nodeid, pitem, holder) {
  let memrss_sum = 0;
  let memheap_sum = 0;
  let memhuse_sum = 0;
  let state_sum = 0;
  if (!data[table]) data[table] = [];

  const arr = data[table].map(item => {
    const dobj = holder.devSet[item.id];
    const version = dobj.version || '';
    const m = dobj.parent + ' v' + version;
    let laststartStr = '';
    let memrss = '';
    let memheap = '';
    let memhuse = '';
    let uptime = '';
    const state = dobj.state || 0;

    const stateStr = liststore.getTitleFromList('unitStateList', state || 0);
    if (state == 1) {
      state_sum += 1;
      const cts = dobj.getPropChangeTs('state');

      laststartStr = cts > 0 ? hut.getDateTimeFor(new Date(cts)) : '';
      uptime = cts > 0 ? hut.timeFormat((Date.now() - cts) / 1000) : '';
      memrss = dobj.memrss || '';
      memrss_sum += Number(memrss);
      memheap = dobj.memheap || '';
      memheap_sum += Number(memheap);
      memhuse = dobj.memhuse || '';
      memhuse_sum += Number(memhuse);
    }

    const title = { title: dobj.name, path: 'dev/sysdevices/sysdeviceview/' + item.id + '/tabProcessLog' };
    // const title = { title: dobj.name, path: domaindata.getDeviceFormUrl(item.id) };
    // const rowbutton = item.id.indexOf('mainprocess') > 0 ? {title:"", hide:"1==1"} : getRowButton(state);
    const rowbutton = cannotStartStop(item.id) ? { title: '', hide: '1==1' } : getRowButton(state);
    return { id: item.id, module: m, uptime, title, stateStr, rowbutton, memrss, memheap, memhuse, laststartStr };
  });

  arr.push({
    title: { title: 'Всего', path: '' },
    stateStr: 'Работает процессов: ' + state_sum,
    memrss: memrss_sum,
    memheap: memheap_sum,
    memhuse: memhuse_sum,
    rowbutton: { title: '', hide: '1==1' }
  });
  return arr;

  function cannotStartStop(id) {
    return id && (id.indexOf('mainprocess') > 0 || id.indexOf('dbagent') > 0 || id.indexOf('logagent') > 0);
  }

  function getRowButton(state) {
    // { title, hide, command }
    if (state == 1) return { title: 'Остановить', command: 'stopplugin' };
    if (state > 1) return { title: 'Запустить ', command: 'startplugin' };
    return { title: '', hide: '1==1' };
  }
}

async function projectstree(data, table, nodeid, pitem, holder) {
  const projectList = liststore.getListMap('projectList');

  const arr = data[table].map(item => {
    const projectItem = projectList.get(item.id);

    return { _id: item.id, title_link: item.title, path: item.path, ...projectItem };
  });

  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function currentproject(data, table, nodeid, pitem, holder) {
  const rec = await holder.dm.findRecordById('project', appconfig.get('project'));
  return { projectpath: appconfig.get('projectpath'), ...rec };
}

async function globalstree(data, table, nodeid, pitem, holder) {
  const globalList = liststore.getListMap('globalList');
  const arr = data[table].map(item => {
    const dn = globalList.has(item.id) ? globalList.get(item.id).dn : '';
    // const value = dn && holder.global[dn] != undefined ? holder.global[dn] : 0;
    const value = holder.global.getValue(item.id);
    return Object.assign({ _id: item.id, name: item.title, dn, value }, item);
  });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function imagestree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));
  // const imgExclude = ['unset', 'noimage.svg'];

  // miss и другие поля - взять из таблицы
  const docs = await holder.dm.dbstore.get('images', {});
  const dObj = hut.arrayToObject(docs, '_id');

  arr.forEach(item => {
    item.image_name = imageNameAsLink(item._id);
    if (dObj[item._id]) {
      item.miss = dObj[item._id].miss;
      item.error = item.miss && !imageutil.imgExclude.includes(item._id) ? 'File not found' : '';
    }
  });
  return arr;
  // return tabledata.formRows(table, arr, pitem.columns, holder);
}

function imageNameAsLink(id) {
  const path = 'vis/images/imageview/' + id + '/tabImageView';
  return { title: id, path };
}

async function docimagestree(data, table, nodeid, pitem, holder) {
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));

  // miss и другие поля - взять из таблицы
  const docs = await holder.dm.dbstore.get('docimages', {});
  const dObj = hut.arrayToObject(docs, '_id');

  arr.forEach(item => {
    item.image_name = docimageNameAsLink(item._id);
    if (dObj[item._id]) {
      item.miss = dObj[item._id].miss;
      item.error = item.miss && !imageutil.imgExclude.includes(item._id) ? 'File not found' : '';
    }
  });
  return arr;
}

function docimageNameAsLink(id) {
  const path = 'documentation/docimages/docimageview/' + id + '/tabDocImageView';
  return { title: id, path };
}

// Таблица устройств заданного типа
async function typedevices(dataFromTable, table, nodeid, pitem, holder) {
  const arr = await holder.dm.dbstore.get('devices', { type: nodeid });

  arr.forEach(item => {
    item.id = item._id;
    item.did = item._id;
    item.path = datautil.getPathFromTree('devdevices', item.id, 'place');
  });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function unitext(dataFromTable, table, nodeid, pitem, holder) {
  const arr = await holder.dm.dbstore.get('pluginextra', { unit: nodeid });
  return tabledata.formRows(table, arr.sort(hut.byorder('did,prop')), pitem.columns, holder);
}

async function unitchannels(dataFromTable, table, nodeid, pitem, holder) {
  // const arr = await holder.dm.dbstore.get('devhard', { unit: nodeid }, { order: 'chan' });
  let arr = [];
  if (!nodeid || nodeid == 'unitgroup' || nodeid.startsWith('plugin_')) {
    arr = await holder.dm.dbstore.get('devhard', {
      $where() {
        return !!(this.unit && this.chan && this.did && this.prop);
      }
    });

    if (nodeid.startsWith('plugin_')) {
      const plugin = nodeid.substr(7);
      arr = arr.filter(doc => doc.unit.startsWith(plugin));
    }
  } else {
    arr = await holder.dm.dbstore.get('devhard', { unit: nodeid }, { order: 'chan' });
  }

  const columns = pitem.columns;

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id };
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = holder.dm.datagetter.formLinkObj(table, col, item, item[col.prop]);
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

async function onechannelRt(dataFromTable, table, nodeid, pitem, holder, id) {
  // nodeid=t18DBbP8O  id=channelview.emuls2
  if (!id || !nodeid || id.indexOf('.') <= 0) return [];
  const unitId = id.split('.').pop();

  const unitItem = holder.unitSet[unitId];
  if (!unitItem || !unitItem.chano || !unitItem.chano.channels) return [];

  // Искать канал
  const unitchanItem = unitItem.chano.findChannelByRecordId(nodeid);
  // console.log('unitchanItem '+util.inspect(unitchanItem));
  if (!unitchanItem) return [];

  // Получить значение с канала
  const rtChan = unitItem.chano.getRtChannel(unitchanItem.chan); // val, ts
  let realtime_chan_str = '';
  if (rtChan) {
    realtime_chan_str = getTimeStr(rtChan.ts) + ' => ' + rtChan.val;
  }

  // Если есть привязка к устройству - выдать значение
  let realtime_dev_str = '';
  const { did, prop } = unitchanItem;
  if (did && prop) {
    const devRaw = holder.devSet[did]._raw;
    if (devRaw && devRaw[prop]) {
      const item = devRaw[prop];
      realtime_dev_str = getTimeStr(item.ts) || getTimeStr(item.errts);
      if (realtime_dev_str) {
        realtime_dev_str += ' => ' + item.val + (item.err ? ' Error: ' + item.err + ' Raw = ' + item.raw : '');
      }
    }
  }

  const arr = [{ realtime_chan_str, realtime_dev_str }];
  return arr;
}

async function scenecallForScene(dataFromTable, table, nodeid, pitem, holder) {
  const arr = await holder.dm.dbstore.get('scenecalls', { sid: nodeid });
  return tabledata.formRows(table, arr, pitem.columns, holder);
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
  const arr = [];
  data[table].forEach(rec => {
    const item = holder.unitSet[rec.id];
    const res = datautil.getStatusObj(item, 'unitStateList');
    if (res) arr.push(res);
  });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function sysdevice(data, table, nodeid, pitem, holder) {
  // __UNIT_modbus1
  if (nodeid) {
    // const _id = nodeid.substr(7);
    const item = liststore.getItemFromList('deviceList', nodeid);
    if (!item) return '';

    item._id = item.id;
    return item;
  }

  // Взять устройства - системные индикаторы
  const sysDevices = [];
  const devs = liststore.getListAsArray('deviceList');

  devs.forEach(item => {
    if (item.sys) sysDevices.push(item);
  });

  // Искать для них папку (для плагинов - свои папки)
  // Если не найдено в списке плагинов - размещать в корень
  const unitDocs = await holder.dm.dbstore.get('units', {});
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
}

async function sysdevicegroup(data, table, nodeid, pitem, holder) {
  const filter = {};
  if (nodeid) {
    filter._id = nodeid;
  }

  const arr = await holder.dm.dbstore.get('units', filter, { order: 'order' });
  const res = arr.filter(item => item.folder);
  res.forEach(item => {
    if (item.folder && item.parent == 0) item.name = appconfig.getMessage('SystemIndicators');
  });
  return res;
}

async function pluginlog(data, table, nodeid, pitem, holder) {
  // Фильтруется по дереву. Если пришел массив - запрос из папки, иначе плагин уже выбран
  const dataArr = data[table];

  //
  let unitArr;
  if (nodeid.startsWith('dbagent')) {
    unitArr = ['dbagent'];
  } else {
    // const unitArr = ['modbus1','modbus2','modbus3'];
    unitArr = dataArr && dataArr.length ? dataArr.map(item => item.id) : [nodeid];
  }

  const arr = await logconnector.getLog('pluginlog', { unit: { $in: unitArr } }, { limit: 1000, sort: { ts: -1 } });
  arr.forEach(item => {
    item.realtime_ts = item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'shortdtms') : '';
  });
  return arr;
}

async function devicelog(data, table, nodeid, pitem, holder) {
  // Фильтруется по дереву. Если пришел массив - запрос из папки, иначе устройство уже выбрано
  // Для одного устройства берется из innerLog устройства, иначе из таблицы
  // Из таблицы берется только 100 последних записей (по всем устр-вам)

  const dataArr = data[table];
  const didArr = dataArr && dataArr.length ? dataArr.map(item => item.id) : [nodeid];
  // didArr.push('system'); // Общесистемные сообщения во всех журналах
  if (!didArr.length) return [];

  let arr = [];
  // if (didArr.length > 1 || domaindata.isGlobal(didArr[0])) {
  if (didArr.length > 1) {
    arr = await logconnector.getLog('devicelog', { did: { $in: didArr } }, { limit: 100, sort: { ts: -1 } });
  } else {
    // Начало журнала одного устройства всегда запрашивается здесь
    arr = await domaindata.getInnerLog(didArr[0], holder, true); // reverse = true
  }

  arr.forEach(item => {
    item.did_prop = domaindata.getDeviceLinkObj(item.did, item.prop);
    item.valstr = item.val;
    item.sender = getSender(item);
    item.realtime_ts = getTsStr(item);
  });
  return arr;

  function getSender(item) {
    if (!item.sender || item.sender == 'null') return '';
    if (typeof item.sender == 'object') return JSON.stringify(item.sender);
    return item.sender.startsWith('scen') ? 'Сценарий: ' + domaindata.getSceneStr(item.sender, holder) : item.sender;
  }
  function getTsStr(item) {
    let ts = item.ts;
    // 1615467600794_00001
    if (item.tsid) ts = Number(item.tsid.substr(0, 13));

    // return ts>0 ? hut.getDateTimeFor(new Date(ts), 'dtms') : '';
    return hut.isTs(ts) ? hut.getDateTimeFor(new Date(ts), 'dtms') : '';
  }
}

async function alertlog(data, table, nodeid, pitem, holder) {
  // Пока все беру из  alerts без фильтра
  // TODO - нужно фильтровать по nodeid - это id журнала
  const rows = await holder.dm.datagetter.getAlertLogRows({ id: nodeid, allow_deack: true }, holder);
  return rows.map(item => ({
    id: item.id,
    txt: item.txt,
    level: item.level,
    stateStr: item.stateStr,
    userId: item.userId,
    username: item.username,
    location: item.location,
    tags: item.tags,
    tsStartStr: item.tsStartStr,
    tsStopStr: item.tsStopStr,
    tsAckStr: item.tsAckStr,
    rowbutton: item.rowbutton
  }));
  /*
  return rows.map(item => ({
    id: item.id,
    txt: item.txt,
    level: item.level,
    stateStr: item.stateStr,
    userId: item.userId,
    username: item.username,
    location: item.location,
    tags: item.tags,
    tsStartStr: item.tsStartStr,
    tsStopStr: item.tsStopStr,
    tsAckStr: item.tsAckStr,
    rowbutton: item.tsAck
      ? { title: 'Снять квитирование', command: 'api_deack_alert' }
      : { title: 'Подтвердить', command: 'api_ack_alert' }
  }));
  */
}

async function journallastrecs(data, table, nodeid, pitem, holder) {
  try {
    let recs = [];
    if (nodeid && nodeid.startsWith('jr')) {
      // Журнал для вкладки конкретный журнал
      recs = await holder.dm.datagetter.getLogRows({ id: nodeid, count: 100, allcolumns: 1 }, holder);
    }

    // Данные пришли в виде массива [{'tags', 'did', 'location', 'txt', 'level', 'ts', 'tsid', 'sender'}]
    return recs.map((item, idx) => ({
      ...item,
      id: idx + 1,
      realtime_ts: getRtStr(item.ts)
    }));
  } catch (e) {
    // Если БД не используется - приходит throw
    return [];
  }
}

// Данные по устройству, которые записаны в БД за последний час по всем свойствам
async function dblastrecs(data, table, nodeid, pitem, holder) {
  if (!nodeid || !holder.devSet[nodeid] || !holder.devSet[nodeid].dn) return [];

  const dn = holder.devSet[nodeid].dn;
  const end = Date.now();
  const start = end - 3600 * 1000; // за последний час = 3600 сек

  // const dn_prop = dn + '.value'; // Собрать свойства, которые пишутся в базу сейчас? НЕТ просто  dn_prop =  dn
  try {
    const fromDb = await dbconnector.read({ start, end, dn_prop: dn });

    // Данные пришли в виде массива [{dn, prop, val, time (или ts)}]
    return !fromDb
      ? []
      : fromDb.reverse().map((item, idx) => ({
          id: idx + 1,
          dn: item.dn,
          prop: item.prop,
          val: item.val,
          realtime_ts: getRtStr(item.time || item.ts)
          // realtime_ts: hut.getDateTimeFor(new Date(item.time), 'dtms')
        }));
  } catch (e) {
    // Если БД не используется - приходит throw
    return [];
  }
}

function getRtStr(timeItem) {
  return timeItem ? hut.getDateTimeFor(new Date(timeItem), 'dtms') : '';
}

async function dbmetrics(data, table, nodeid, pitem, holder) {
  // Собрать все что пишется в БД
  const docs = await holder.dm.dbstore.get('devicedb', {});
  const arr = [];
  let i = 0;
  docs.forEach(doc => {
    if (doc.did && doc.prop && doc.dbmet > 0) {
      i++;
      arr.push({
        id: i,
        did: { title: domaindata.getDeviceTitle(doc.did), path: domaindata.getDeviceDbFormUrl(doc.did) },
        prop: doc.prop,
        dbmet: liststore.getTitleFromList('dbmetList', doc.dbmet),
        dbtm: doc.dbmet == 3 ? doc.dbtm : '-',
        dbcalc_type: doc.dbmet == 3 ? liststore.getTitleFromList('dbcalc_typeList', doc.dbcalc_type) : '-',
        dbdelta: doc.dbmet == 1 ? doc.dbdelta : '-',
        dbforce: doc.dbmet == 1 ? doc.dbforce : '-',
        days: doc.dbmet > 0 ? liststore.getTitleFromList('dbretentionList', doc.days) : '-'
      });
    }
  });
  return arr;
}

async function targetFrame(data, table, nodeid, pitem, holder) {
  return [{ target_frame: { id: '-', title: '-' }, container_id: { id: '-', title: '-' } }];
}

async function dbagentstate(data, table, nodeid, pitem, holder) {
  const item = holder.unitSet[nodeid];
  const res = datautil.getStatusObj(item, 'unitStateList');
  return res ? [res] : [];
}

async function plugininfo(data, table, nodeid, pitem, holder) {
  if (!nodeid) return [];

  const plugin = nodeid.startsWith('plugin_') ? nodeid.substr(7) : nodeid;
  const res = await holder.dm.getPluginInfo(plugin);
  return res ? [res] : [];
}

async function dbagentinfo(data, table, nodeid, pitem, holder) {
  console.log('dbagentinfo ' + nodeid);
  if (!nodeid) return [];
  const res = await holder.dm.getDbagentInfo(nodeid);
  return res ? [res] : [];
}

function getTimeStr(ts) {
  try {
    return ts > 0 ? hut.getDateTimeFor(new Date(ts), 'shortdt') : '';
  } catch (e) {
    return '';
  }
}

async function systemsettings(data, table, nodeid, pitem, holder) {
  const projectpat = appconfig.get('projectpath');
  const vardir = appconfig.get('vardir');
  // Данные из config.json
  const rec = appconfig.getConfigObject();
  const projdir = rec.projdir || '';

  return [
    {
      port: rec.port || appconfig.get('port'),
      apiport: rec.apiport || appconfig.get('apiport'),
      lang: rec.lang,
      expert: rec.expert || 0,
      currentproject: projectpat,
      vardir,
      projdir,
      otherprojdir: projdir && projdir != vardir ? 1 : 0
    }
  ];
}

async function projectdeps(data, table, nodeid, pitem, holder) {
  const recs = await holder.dm.get('projectdepsTable');
  return recs || [];
}

async function licensesList(data, table, nodeid, pitem, holder) {
  const arr = await holder.dm.dbstore.get('licenses');

  arr.forEach(item => {
    item.dts = item.startActivation > 0 ? hut.getDateTimeFor(new Date(item.startActivation), 'reportdt') : '';
    item.status =
      'Активна ' +
      (item.endActivation > 0 ? ' до ' + hut.getDateTimeFor(new Date(item.endActivation), 'reportdt') : '');
    item.title = item.platform + ' ' + (item.product == 'tags' ? ' (' + item.qt + ')' : item.product);
    if (item.demo) {
      item.rowbutton = { title: 'Удалить', command: 'deactivate_demo' };
      item.title += ' DEMO';
    } else {
      item.rowbutton = { title: 'Деактивировать', command: 'deactivate' };
    }
  });

  return arr;
}

async function alerttriggers(data, table, nodeid, pitem, holder) {
  /*
  const arr = [
    {did:'d0099', prop:'state'},
    {did:'d0100', prop:'state'},
    {did:'d0101', prop:'state'},
    {did:'d0102', prop:'state'},
    {did:'d0103', prop:'state'},
  ]
  arr.forEach(item => {
    item.did_prop = datagetter.getDeviceLinkObj(item.did, item.prop);
    
  });
  return arr;
  */
  return [];
}

async function alerts(data, table, nodeid, pitem, holder) {
  /*
  const now = Date.now();
  const arr = [{
    level:1,
    did:'d0103',
    prop:'state',
    tsStart: now - 5000,
    tsStop: now - 1000,
    txt:'Протечка!',
    status:'Завершено, ожидает квитирования'
  }];
  arr.forEach(item => {
    item.did_prop = datagetter.getDeviceLinkObj(item.did, item.prop);
    item.realtime_tsStart = item.tsStart > 0 ? hut.getDateTimeFor(new Date(item.tsStart), 'dtms') : '';
    item.realtime_tsStop = item.tsStop > 0 ? hut.getDateTimeFor(new Date(item.tsStop), 'dtms') : '';
  });
  return arr;
  */
  return [];
}

async function devhardtags(data, table, nodeid, pitem, holder) {
  const docs = await holder.dm.dbstore.get(
    'devhard',
    {
      $where: function() {
        return !!(this.unit && this.chan && this.did && this.prop);
      }
    },
    { fields: { _id: 1, unit: 1, chan: 1, did: 1, prop: 1 } }
  );
  return docs;
}

async function globalScripttriggers(data, table, nodeid, pitem, holder) {
  const genfield = 'scripttriggers';
  const rec = data[table];
  const pObj = rec && rec[genfield] ? rec[genfield] : '';
  if (!pObj) return [];
  const arr = tabledata.transfromGenfieldObjToArray(pObj);
  const res = arr.map(item => {
    const [did, prop] = item.devtrig.split('.');
    const devtrig = domaindata.getDeviceLinkObj(did, prop);
    // добавить {dn, realtime_dev_val, realtime_dev_ts, realtime_dev_cts, realtime_dev_err}
    const rt = holder.dm.datagetter.getOneDevicePropRtObject(did, prop, holder);
    return { id: item.id, devtrig, ...rt };
  });
  return res.sort(hut.byorder('dn'));
}

async function sceneTriggers(genfield, data, table, nodeid, pitem, holder) {
  const rec = data[table];
  const pObj = rec && rec[genfield] ? rec[genfield] : '';
  if (!pObj) return [];

  const arr = tabledata.transfromGenfieldObjToArray(pObj);
  arr.forEach(item => {
    if (item.devtrig) {
      const [did, prop] = item.devtrig.split('.');
      item.devtrig = domaindata.getDeviceLinkObj(did, prop);
    }
  });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function sceneStarttriggers(data, table, nodeid, pitem, holder) {
  return sceneTriggers('starttriggers', data, table, nodeid, pitem, holder);
}
async function sceneStoptriggers(data, table, nodeid, pitem, holder) {
  return sceneTriggers('stoptriggers', data, table, nodeid, pitem, holder);
}

async function globalhandler(data, table, nodeid, pitem, holder) {
  const doc = await holder.dm.findOne('globals', { _id: nodeid });
  // console.log(' G HANDLER doc=' + util.inspect(doc));

  if (!doc) return [];
  if (!doc.scriptOnChange) {
    doc.when_str = 'Не используется';
  } else {
    let str = '';
    if (doc.scripttriggers) {
      Object.keys(doc.scripttriggers).forEach(el => {
        if (doc.scripttriggers[el].devtrig) {
          // did.prop => dn.prop
          const [did, prop] = doc.scripttriggers[el].devtrig.split('.');
          if (holder.devSet[did]) {
            if (str) str += ',  ';
            str += 'devs.' + holder.devSet[did].dn + '.' + prop;
          }
        }
      });
    }
    doc.when_str = str ? 'При изменении: ' + str : 'Триггеры не определены!';
  }
  return doc;
}

async function glcurrent(data, table, nodeid, pitem, holder) {
  const item = holder.global.getItem(nodeid);
  console.log('VIRT glcurrent ' + nodeid + ' ' + util.inspect(item));

  return !item ? [] : [{ val: item.value, ts: item.ts }];
}

async function jlevels(data, table, nodeid, pitem, holder) {
  // Найти запись для этого журнала: {_id:'mainlog', props:{..}}
  let rec = await holder.dm.findOne('jlevels', { _id: nodeid });

  // Если нет записи или нет props - добавить props - 3 уровня
  if (!rec || !rec.props) {
    rec = domaindata.getJLevelsRecord(nodeid);
    await holder.dm.upsertDocs('jlevels', [rec]);
  }

  const pObj = rec.props;

  const arr = tabledata.transfromGenfieldObjToArray(pObj).sort(hut.byorder('level'));
  arr.forEach(item => {
    if (!item.days) item.days = 1;
  });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function customdata(data, table, nodeid, pitem, holder) {
  // nodeid - id в customtable => tablename. Если таблицы нет - создать
  const doc = await holder.dm.findOne('customtable', { _id: nodeid });
  if (!doc) throw { message: 'Not found doc with _id' + nodeid + ' in customtable' };

  const proparr = doc.props ? Object.keys(doc.props) : [];
  const tablename = doc.tablename;

  let customDocs = [];
  if (doc.fuse) {
    customDocs = await tryRunHandler(nodeid);
    if (!Array.isArray(customDocs)) throw { message: 'Обработчик должен вернуть массив!' };
  } else {
    holder.dm.createCustomTable(tablename); // Если уже есть - ничего не происходит
    customDocs = await holder.dm.get(tablename);
  }

  return customDocs.map(row => {
    const line = { id: row._id };
    proparr.forEach(prop => {
      line[prop] = row[prop];
    });
    return line;
  });

  async function tryRunHandler(id) {
    let filename;
    try {
      filename = appconfig.getHandlerFilenameIfExists(id);
      if (!filename) throw { message: 'Not found handler for ' + id };
      return require(filename)(holder, debug);
    } catch (e) {
      console.log('ERROR: Handler ' + filename + ': ' + util.inspect(e));
      debug(util.inspect(e));
      return [];
    }

    function debug(msg) {
      holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
    }
  }
}

async function globalhandlersTrace(data, table, nodeid, pitem, holder) {
  const arr = [];
  Object.keys(holder.traceSet).forEach(id => {
    const item = { ...holder.traceSet[id] };
    if (item.own == 'global') {
      item.id = id;
      item.did_link = id ? domaindata.getDeviceLinkObj(id) : '';
      item.startStr = item.startTs > 0 ? hut.getDateTimeFor(new Date(item.startTs), 'shortdtms') : '-';
      item.stopStr = item.stopTs > 0 ? hut.getDateTimeFor(new Date(item.stopTs), 'shortdtms') : '-';
      item.duration = getDuration(item);
      arr.push(item);
    }
  });

  return arr;
}

async function scenesTrace(data, table, nodeid, pitem, holder) {
  const arr = [];
  Object.keys(holder.traceSet).forEach(id => {
    const item = { ...holder.traceSet[id] };
    if (item.own == 'scen') {
      const oneInstanse = holder.sceneSet[id];
      if (oneInstanse) {
        item.scene_link = getSceneLink(oneInstanse.sceneId);
        item.realdevs = oneInstanse.realdevs;

        item.id = id;

        item.startStr = item.startTs > 0 ? hut.getDateTimeFor(new Date(item.startTs), 'shortdtms') : '-';
        item.stopStr = item.stopTs > 0 ? hut.getDateTimeFor(new Date(item.stopTs), 'shortdtms') : '-';
        item.duration = getDuration(item);

        arr.push(item);
      }
    }
  });
  return arr;
}

function getSceneLink(id) {
  const sceneListItem = liststore.getItemFromList('sceneList', id);

  const scenePath = domaindata.getScenescriptPath(id);
  return sceneListItem && sceneListItem.name
    ? { title: sceneListItem.name, path: scenePath }
    : { title: '-', path: '' };
}

async function typehandlersTrace(data, table, nodeid, pitem, holder) {
  const typeList = liststore.getListMap('typeList');
  const arr = [];
  Object.keys(holder.traceSet).forEach(id => {
    const item = { ...holder.traceSet[id] };
    if (item.own == 'type') {
      item.id = id;

      item.type_link = getLink(id);
      item.did_link = item.did ? domaindata.getDeviceLinkObj(item.did) : '';
      item.startStr = item.startTs > 0 ? hut.getDateTimeFor(new Date(item.startTs), 'shortdtms') : '-';
      item.stopStr = item.stopTs > 0 ? hut.getDateTimeFor(new Date(item.stopTs), 'shortdtms') : '-';
      item.duration = getDuration(item);
      arr.push(item);
    }
  });
  return arr;
  /*
  function getDuration(item) {
    return !item.duration && item.startTs > 0 && item.stopTs == item.startTs ? '<1' : item.duration;
  }
  */

  function getLink(str) {
    let { type, prop } = domaindata.splitHandlerFilename(str);
    let desc = '';
    if (prop) {
      if (prop.startsWith('_On')) {
        desc = ' Событие ' + prop;
      } else if (prop.startsWith('_format_')) {
        desc = ' Свойство ' + prop.substr(8) + '#string';
        // prop = '_' + prop;
      } else {
        desc = ' Свойство ' + prop;
      }
    }

    return type && typeList.has(type)
      ? { title: 'Тип ' + typeList.get(type).title + '. ' + desc, path: domaindata.getTypeHandlerPath(type, prop) }
      : { title: str, path: '' };
  }
}

function getDuration(item) {
  return !item.duration && item.startTs > 0 && item.stopTs == item.startTs ? '<1' : item.duration;
}

async function snippetsRun(data, table, nodeid, pitem, holder) {
  const arr = [];
  Object.keys(holder.snippetSet).forEach(did => {
    const item = holder.snippetSet[did]; // {did, snipid, file, period, global, err}
    const snippet_link = domaindata.getSnippetLinkObj(item.snipid);
    const target_link = domaindata.getDeviceLinkObj(did);
    const startStr = item.startTs > 0 ? hut.getDateTimeFor(new Date(item.startTs), 'shortdtms') : '';
    const stopStr = item.stopTs > 0 ? hut.getDateTimeFor(new Date(item.stopTs), 'shortdtms') : '';
    const qtsStr = item.qts > 0 ? hut.getDateTimeFor(new Date(item.qts), 'shortdtms') : '-';
    arr.push({
      snippet_link,
      target_link,
      period: item.period,
      startStr,
      stopStr,
      qtsStr,
      errstr: item.error,
      resets: item.resets
    });
  });
  return arr;
}

async function infogroupByGroup(data, table, nodeid, pitem, holder) {
  const arr = await holder.dm.get('infogroup_tab', { groupId: nodeid });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function infogroupByUser(data, table, nodeid, pitem, holder) {
  const arr = await holder.dm.get('infogroup_tab', { userId: nodeid });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function agroupByGroup(data, table, nodeid, pitem, holder) {
  const arr = await holder.dm.get('agroup_tab', { groupId: nodeid });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function agroupByUser(data, table, nodeid, pitem, holder) {
  const arr = await holder.dm.get('agroup_tab', { userId: nodeid });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function inforuleByRule(data, table, nodeid, pitem, holder) {
  const arr = await holder.dm.get('inforule_tab', { ruleId: nodeid });
  return tabledata.formRows(table, arr, pitem.columns, holder);
}

async function plugins(data, table, nodeid, pitem, holder) {
  const status = [
    '?',
    'Установлена последняя версия',
    'Есть обновление',
    'Доступно для установки',
    'Для установки требуется лицензия'
  ];
  // Считать список всех плагинов с данными о доступных обновлениях
  const arr = await pluginutil.getV5PluginTable(holder);

  return arr.sort(hut.byorder('id')).map(item => {
    item.title_status = status[item.status];
    if (item.status == 2) {
      item.rowbutton_up = { title: 'Обновить', command: 'updateplugin' };
      //  } else if (item.yurl && item.status == 3) {
    } else if (item.status == 3) {
      item.rowbutton_up = { title: 'Установить', command: 'installplugin' };
    } else {
      item.rowbutton_up = { title: '-', command: '' };
    }
    return item;
  });
}

async function pluginsStat(data, table, nodeid, pitem, holder) {
  // Считать список всех плагинов с данными о доступных обновлениях
  const arr = await pluginutil.getV5PluginTable(holder);
  let installed = 0;
  let toupdate = 0;
  let toinstall = 0;
  arr.forEach(item => {
    if (item.status == 3) {
      toinstall++;
    } else {
      installed++;
      if (item.status == 2) toupdate++;
    }
  });
  return [{ installed, toinstall, toupdate }];
}

async function channelsx(data, table, nodeid, pitem, holder) {
  if (!nodeid) return [];

  const arr = await holder.dm.dbstore.get('devhard', {
    $where() {
      return !!(this.unit == nodeid && !this.folder);
    }
  });

  return {
    data: arr.map(item => {
      const { chan, order, parent, unit, ...rest } = item;
      return { ...rest, id: chan };
    })
  };
}

async function pagebylang(dataFromTable, table, nodeid, pitem, holder) {
  const genfield = 'props';
  const rec = dataFromTable[table];
  // console.log('pagebylang dataFromTable='+util.inspect(dataFromTable));
  const pObj = rec && rec[genfield] ? rec[genfield] : '';
  if (!pObj) return [];

  const arr = tabledata.transfromGenfieldObjToArray(pObj);

  arr.forEach(item => {
    item.lastmodifStr = item.lastmodif > 0 ? hut.getDateTimeFor(new Date(item.lastmodif)) : '-';
    item.lastpubStr = item.lastpub > 0 ? hut.getDateTimeFor(new Date(item.lastpub)) : '-';
    item.rowbutton =
      item.lastmodif > 0 && (!item.lastpub || item.lastmodif > item.lastpub)
        ? { title: 'Опубликовать', command: 'publishpage' }
        : { title: '', command: '' };
  });
  return arr;
}

// Выводит список свойств для устройства, которые будут отображены на вкладке Настройка (мобильное)
async function mobilesettingfromtype(dataFromTable, table, nodeid, pitem, holder) {
  // Получить список свойств, которые настроены в типе - для этого устройства
  const dobj = holder.devSet[nodeid];
  const arr = await mobiledeviceutil.getDeviceSettingFromType(dobj, holder);
  const typeItem = domaindata.getTypeobj(dobj.type);
  const typename = 'Тип ' + typeItem.item.name;
  const typePath = domaindata.getTypePath(dobj.type);
  return arr.map(item => ({ title: item.title, source: { title: typename, path: typePath } }));
}

// Выводит список свойств для устройства, которые будут отображены на вкладке Настройка (мобильное)
async function mobilesettingfromscene(dataFromTable, table, nodeid, pitem, holder) {
  const dobj = holder.devSet[nodeid];
  const extPropsByScenes = widgetdata.getExtPropsByScenes(dobj, holder);

  // Пришло с разбивкой по сценариям
  const arr = [];
  Object.keys(extPropsByScenes).forEach(sceneId => {
    const source = domaindata.getSceneLinkObj(sceneId);
    extPropsByScenes[sceneId].forEach(item => {
      arr.push({ source, title: item.note });
    });
  });
  return arr;
}

module.exports = {
  typepropsTable: typeprops,
  typepropalertTable: typepropalert,
  devicecommonTable: devicecommon,
  devicesceneTable: devicescene,
  devicevisTable: devicevis,
  dialoglinksTable: dialoglinks,
  templateusageTable: templateUsage,
  devicedb: deviceDb,
  devicesTreeTable: devicestree,
  sysdevicesTreeTable: sysdevicestree,
  globalsTreeTable: globalstree,
  imagesTreeTable: imagestree,
  docimagesTreeTable: docimagestree,
  typesTreeTable: typestree,
  typePropsAlertTreeTable: typePropsAlertTree,

  dialogsTreeTable: dialogstree,
  templatesTreeTable: templatestree,
  layoutsTreeTable: layoutstree,
  viscontsTreeTable: viscontstree,
  visscriptsTreeTable: visscriptstree,
  snippetsTreeTable: snippetstree,
  snippetusageTable: snippetUsage,
  restapihandlersTreeTable: restapihandlerstree,
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
  journallastrecsTable: journallastrecs,

  dbmetricsTable: dbmetrics,
  dbagentstateTable: dbagentstate,
  targetFrameTable: targetFrame,
  plugininfoTable: plugininfo,
  dbagentinfoTable: dbagentinfo,
  onechannelrtTable: onechannelRt,
  systemsettingsTable: systemsettings,
  projectdepsTable: projectdeps,
  alerttriggersTable: alerttriggers,
  alertsTable: alerts,
  devhardtag: devhardtags,
  globalScripttriggersTable: globalScripttriggers,
  sceneStarttriggersTable: sceneStarttriggers,
  sceneStoptriggersTable: sceneStoptriggers,
  globalhandlerTable: globalhandler,
  jlevelsTable: jlevels,
  customdataTable: customdata,
  licensesListTable: licensesList,
  glcurrentTable: glcurrent,
  snippetsRunTable: snippetsRun,
  typehandlersTraceTable: typehandlersTrace,
  scenesTraceTable: scenesTrace,
  typepropalertSelector: typepropalertSelect,
  globalhandlersTraceTable: globalhandlersTrace,
  alertlogTable: alertlog,
  infogroup_bygroup: infogroupByGroup,
  infogroup_byuser: infogroupByUser,
  agroup_bygroup: agroupByGroup,
  agroup_byuser: agroupByUser,

  inforule_byrule: inforuleByRule,

  currentprojectTable: currentproject,
  pluginsTable: plugins,
  pluginsStatTable: pluginsStat,
  scenestateTable: scenestate,
  schedrulesTreeTable: schedrulestree,
  channelsx,
  pagebylangTable: pagebylang,
  mobilesettingfromtypeTable: mobilesettingfromtype,
  mobilesettingfromsceneTable: mobilesettingfromscene
};
