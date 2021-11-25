/**
 * processmessage.js
 * Обработка сообщений от плагинов
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const liststore = require('../dbs/liststore');


const processchannels = require('./processchannels');
// const pluginutil = require('./pluginutil');

const commander = require('../domain/commander');

/**
 * Обработка сообщения от плагина.
 * Посылается ответ плагину, если нужно
 *
 * @param {Object} m - Поступившее сообщение
 * @param {Object} uobj - объект плагина из unitSet
 * @param {Object} holder
 *
 * @return {String} - debug-сообщение
 */
module.exports = async function(m, uobj, holder) {
  const dm = holder.dm;
  const unitId = uobj.id;
  const emulmode = appconfig.get('limitLht');
  // console.log('WARN: FROM PLUGIN ' + unitId + ' MESSAGE: ' + util.inspect(m));
  // if ((!unitId.startsWith('emul') || mes.type != 'procinfo') && emulmode) return;
  if (emulmode && isHwPlugin(unitId)) return;

  // readTele - преобразование входной строки в объект чисто техническое.
  // Но возможно есть адаптер - тогда ему передается holder
  const mes = uobj.chano && uobj.readTeleV5 ? uobj.readTeleV5(m, uobj.chano.readMap, holder) : m;
  if (typeof mes != 'object') return;

  switch (mes.type) {
    case 'procinfo':
      return procInfo(mes.data, uobj);

    case 'data':
      return processData(mes.data, uobj);

    case 'sub':
      return doSub(mes, unitId);

    case 'unsub':
      return doUnsub(mes, unitId);

    case 'get':
      return sendGetResponse();
    // const res = await sendGetResponse();
    // return res;

    case 'command':
      return mes.response != undefined ? receiveCommandResponse() : receiveCommandToDo();

    case 'setpersistent':
        return setPersistent();

    /*
    case 'set':
      return receiveSet();

    case 'command':
      return mes.response != undefined ? receiveCommandResponse() : receiveCommandToDo();

    

    case 'histdata':
      return processHistdata();
    */

    case 'channels':
      return receiveChannels(mes.data);

    case 'syncChannels':
      return syncChannels(mes.data);

    case 'syncFolders':
      return syncFolders(mes.data);

    case 'upsertChannels':
      return upsertChannels(mes.data);

    case 'removeChannels':
      return removeChannels(mes.data);

    case 'transferdata':
      holder.emit('transferdata_out', Object.assign({ unit: unitId }, mes));
      return;

    case 'startscene':
      if (mes.id) holder.emit('startscene', mes.id, mes.arg || '');
      return 'IH: startscene ' + mes.id;

    case 'log':
    case 'debug':
      return unitId + ': ' + (typeof mes.txt == 'object' ? util.inspect(mes.txt) : mes.txt);

    default:
      return 'IH: Unexpected message type ' + mes.type;
  }

  function isHwPlugin(unit) {
    if (unit.startsWith('emul')) return false;
    if (unit.startsWith('p2p')) return false;
  }

  async function setPersistent() {
    // Создать папку плагина в постоянном хранилище, если она не создана
    // Сохранить данные - приходит id и data? 

  }

  // Плагин прислал каналы
  // Обработка запросов type:channels или type:set name:channels
  async function receiveChannels(data) {
    if (!data) return;
    const unit = uobj.id;

    // Плагин может сразу передать текущее значение value
    const values = [];
    data.forEach(item => {
      if (item.value != undefined) {
        values.push({ id: item.id, value: item.value });
        delete item.value; // В канале сохранять value не нужно
      }
    });

    // Сохранить присланные каналы в devhard (всегда приходят все каналы)
    // channelArray = массив каналов из devhard (как результат filter: {unit:unitId})
    let res = 'Received channels from plugin: ' + data.length;
    try {
      // ro =  { changes: 1/0, added, updated, deleted, marked } || {error}
      const ro = await processchannels.receive(data, uobj, holder);
      if (!ro || ro.error) throw { message: res + ' ERROR:' + ro.error };

      if (ro.changes) {
        const channelArray = await holder.dm.dbstore.get('devhard', { unit });

        uobj.chano.updateChannels(channelArray); // генерируем новые readMap, writeMap

        let res1 = 'New channels:' + ro.added + ', updated:' + ro.updated + ', disappeared:' + (ro.deleted + ro.marked);
        if (ro.deleted || ro.marked) {
          res1 += ' (deleted: ' + ro.deleted + ', marked: ' + ro.marked + ')';
        }

        holder.emit('log:plugin', unitId, { txt: 'Plugin change channels. ' + res1 }); // Записать в журнал системы что плагин меняет каналы
        res += '\n' + res1;
      } else {
        // Если нет изменений - ничего не делать
        res += '. No changes';
      }
      if (values.length) res += '\n' + processData(values);
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      res += 'ERROR: ' + hut.getShortErrStr(e);
    }
    return 'IH: ' + res;
  }

  // Плагин прислал каналы для добавления
  // Обработка запросов type:upsertChannels
  async function upsertChannels(data) {
    if (!data) return;
    const unit = uobj.id;

    // Плагин может сразу передать текущее значение value
    const values = [];
    data.forEach(item => {
      if (item.value != undefined) {
        values.push({ id: item.id, value: item.value });
        delete item.value; // В канале сохранять value не нужно
      }
    });

    // Сохранить присланные каналы в devhard (всегда приходят все каналы)
    // channelArray = массив каналов из devhard (как результат filter: {unit:unitId})
    let res = 'Upserted channels from plugin: ' + data.length;
    try {
      // ro =  { changes: 1/0, added, updated, deleted, marked } || {error}
      const ro = await processchannels.upsert(data, uobj, holder);
      if (!ro || ro.error) throw { message: res + ' ERROR:' + ro.error };

      if (ro.changes) {
        const channelArray = await holder.dm.dbstore.get('devhard', { unit });

        uobj.chano.updateChannels(channelArray); // генерируем новые readMap, writeMap

        let res1 = 'New channels:' + ro.added + ', updated:' + ro.updated;

        holder.emit('log:plugin', unitId, { txt: 'Plugin upsert channels. ' + res1 }); // Записать в журнал системы что плагин меняет каналы
        res += '\n' + res1;
      } else {
        // Если нет изменений - ничего не делать
        res += '. No changes';
      }
      if (values.length) res += '\n' + processData(values);
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      res += 'ERROR: ' + hut.getShortErrStr(e);
    }
    return 'IH: ' + res;
  }

  /**
   * Синхронизация каналов
   *  - помечаются на удаление каналы, которых нет
   *  - новые здесь игнорируются??
   * @param {Array of Objects} data
   */
  async function syncChannels(data) {
    if (!data) return;
    const unit = uobj.id;

    let res = 'Sync channels from plugin: ' + data.length;
    try {
      // ro =  { changes: 1/0, added, updated, deleted, marked } || {error}
      const ro = await processchannels.sync(data, uobj, holder);
      if (!ro || ro.error) throw { message: res + ' ERROR:' + ro.error };

      if (ro.changes) {
        const channelArray = await holder.dm.dbstore.get('devhard', { unit });

        uobj.chano.updateChannels(channelArray); // генерируем новые readMap, writeMap

        let res1 = 'Channels disappeared:' + ro.marked + ', restored: ' + ro.updated;

        holder.emit('log:plugin', unitId, { txt: 'Plugin sync channels. ' + res1 }); // Записать в журнал системы что плагин меняет каналы
        res += '\n' + res1;
      } else {
        // Если нет изменений - ничего не делать
        res += '. No changes';
      }
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      res += 'ERROR: ' + hut.getShortErrStr(e);
    }
    return 'IH: ' + res;
  }

  /**
   * Синхронизация папок с каналами
   *  - помечаются на удаление каналы, которых нет
   *  - новые здесь игнорируются??
   * @param {Array of Objects} data
   */
  async function syncFolders(data) {
    if (!data) return;
    const unit = uobj.id;

    let res = 'Sync folders from plugin: ' + data.length;
    try {
      // ro =  { changes: 1/0, added, updated, deleted, marked } || {error}
      const ro = await processchannels.syncFolders(data, uobj, holder);
      if (!ro || ro.error) throw { message: res + ' ERROR:' + ro.error };

      if (ro.changes) {
        const channelArray = await holder.dm.dbstore.get('devhard', { unit });

        uobj.chano.updateChannels(channelArray); // генерируем новые readMap, writeMap

        let res1 = 'Channels disappeared:' + ro.marked + ', restored: ' + ro.updated;

        holder.emit('log:plugin', unitId, { txt: 'Plugin sync folders. ' + res1 }); // Записать в журнал системы что плагин меняет каналы
        res += '\n' + res1;
      } else {
        // Если нет изменений - ничего не делать
        res += '. No changes';
      }
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      res += 'ERROR: ' + hut.getShortErrStr(e);
    }
    return 'IH: ' + res;
  }

  async function removeChannels(data) {
    if (!data) return;
    const unit = uobj.id;

    let res = 'Remove channels from plugin: ' + data.length;
    try {
      // ro =  { changes: 1/0, added, updated, deleted, marked } || {error}
      const ro = await processchannels.markMissing(data, uobj, holder);
      if (!ro || ro.error) throw { message: res + ' ERROR:' + ro.error };

      if (ro.changes) {
        const channelArray = await holder.dm.dbstore.get('devhard', { unit });

        uobj.chano.updateChannels(channelArray); // генерируем новые readMap, writeMap

        let res1 = 'Channels disappeared:' + ro.marked;

        holder.emit('log:plugin', unitId, { txt: 'Plugin remove channels. ' + res1 }); // Записать в журнал системы что плагин меняет каналы
        res += '\n' + res1;
      } else {
        // Если нет изменений - ничего не делать
        res += '. No changes';
      }
    } catch (e) {
      console.log('ERROR: ' + util.inspect(e));
      res += 'ERROR: ' + hut.getShortErrStr(e);
    }
    return 'IH: ' + res;
  }

  function processData(data) {
    if (!data) return;
    const readObj = uobj.chano.readData(data, holder); // Если привязок нет - может ничего и не быть!!
    if (readObj) holder.emit('received:device:data', readObj);
    // readObj =  { d0138: { temp: -41 } }
    return 'IH: get ' + util.inspect(data) + '\nset ' + util.inspect(readObj);
  }

  function procInfo(data) {
    if (!data) return;
    const did = '__UNIT_' + unitId;
    const readObj = { [did]: data };
    holder.emit('received:device:data', readObj);
    // return 'IH: get ' + util.inspect(data) + '\nset ' + util.inspect(readObj);
  }

  // //////////////////////////////////////////////////////////////////////
  // Обработка запросов type:get
  async function sendGetResponse() {
    if (mes.tablename) {
      uobj.send(Object.assign({ type: 'get', response: 1 }, await getObjForTablename(mes.tablename)));
    } else if (mes.name) {
      uobj.send({ id: mes.id, type: 'get', data: await getDataForName(mes.name), response: 1 });
    }
  }

  async function getObjForTablename(tablename) {
    let ii = tablename.indexOf('/');
    if (ii > 0) tablename = tablename.substr(0, ii);

    switch (tablename) {
      case 'params':
        return { params: await getModuleParams() };

      case 'system':
        return { system: getSystemParams() };

      case 'config':
      case 'channels':
        return { config: getModuleChannels() };

      case 'extra':
      case 'pluginextra':
        return { extra: await getModuleExtra() };

      case 'infousers':
      case 'infoaddr':
        return { infousers: await getModuleInfousers() };

      default:
      // return { [tablename]: jdb.get({ name: tablename, filter }) };
    }
  }

  async function getDataForName(name) {
    switch (name) {
      case 'params':
        return getModuleParams();

      case 'persistent':
        return getPersistent();

      case 'system':
        return getSystemParams();

      case 'config':
      case 'channels':
        return getModuleChannels();

      case 'extra':
      case 'pluginextra':
        return getModuleExtra();

      /*  
      case 'assets':
        return getModuleAssets(unitId);

      case 'methods':
        return getModuleMethods();

      case 'method':
        return getModuleMethod();

     

      case 'devhardlinks':
        return virtdata.getVirtData('devhardlinks', { filter: { unit } }, holder);
      */

      case 'infousers':
      case 'infoaddr':
        return getModuleInfousers();

      case 'devices':
        return getDevices();

      case 'types':
        return getTypes();

      case 'devprops':
        return getDevprops();

      default:
      // return virtdata.isVirtData(name) ? virtdata.getVirtData(name, { filter }, holder) : jdb.get({ name, filter });
    }
  }

  async function getPersistent() {
    // Файлы плагина, хранящиеся отдельно от проекта

  }

  // Вернуть объект, содержащий значения параметров, которые прописаны в манифесте
  // Сами значения нужно взять из units
  async function getModuleParams() {
    let result = {};
    const doc = await dm.dbstore.findOne('units', { _id: unitId });

    result.debug = uobj.debug ? 'on' : 'off';
    result.loglevel = uobj.loglevel || 0;
    result.lang = appconfig.get('lang');

    return { ...result, ...doc };
  }

  function getSystemParams() {
    return {
      port: Number(appconfig.get('port')),
      tempdir: appconfig.get('temppath'),
      serverkey: appconfig.get('serverkey')
    };
  }

  async function getModuleInfousers() {
    const docs = await dm.dbstore.get('infoaddr', { infotype: unitId });
    return docs.map(doc => ({ addr: doc.addr, unitId: doc.unitId }));
  }

  async function getDevices() {
    try {
      const table = 'i_' + unitId + '_devices';
      const docs = await holder.dm.get(table, { active: 1 });
      // Проставить тип для каждого устройства
      // Заодно проверить, что устройство существует
      const arr = [];
      docs.forEach(doc => {
        const dobj = holder.devSet[doc._id];
        if (dobj && dobj.type) {
          arr.push({ ...doc, type: dobj.type });
        }
      });
      return arr;
    } catch (e) {
      console.log('ERROR: getTypes for plugin ' + unitId + ': ' + util.inspect(e));
      return [];
    }
  }

  // Запрос на данные интеграции от плагина - отдать данные о настройках типа со вкладки Интеграции
  async function getTypes() {
    try {
      const table = 'i_' + unitId + '_types';
      const data = await holder.dm.get(table);
      // Добавить названия типа 
      // const typeList = liststore.getListMap('typeList');
      data.forEach(item => {
        item.title = liststore.getTitleFromList('typeList', item._id) || item._id;
      });
      return data;

    } catch (e) {
      console.log('ERROR: getTypes for plugin ' + unitId + ': ' + util.inspect(e));
      return [];
    }
  }

  function getDevprops() {
    let props;
    const filter = mes.filter;
    if (filter.props) {
      props = hut.clone(filter.props);
    }
    delete filter.props;

    return Object.keys(holder.devSet)
      .filter(dn => !filter || hut.isInFilter(holder.devSet[dn], filter))
      .map(dn => (props ? holder.devSet[dn].getCurrentPropValues(props) : holder.devSet[dn].getCurrent(true))); // вернуть props v4
  }

  function getModuleChannels() {
    // Передаем каналы для чтения r:1
    const res = uobj.chano.getChannels();
    // const res = uobj.chano.charr.filter(item => !item.folder && item.r).map(item => Object.assign({ id: item.chan }, item));

    return res;
  }

  async function getModuleExtra() {
    return dm.dbstore.get('pluginextra', { unit: unitId });
  }

  function doSub() {
    // Сформировать объект подписки:
    if (mes.id) uobj.subs.set(mes.id, mes);
    // return 'IH: sub:'+util.inspect(mes)
  }

  function doUnsub() {
    if (mes.id && uobj.subs.has(mes.id)) uobj.subs.delete(mes.id);
  }

  // //////////////////////////////////////////////////////////////////////
  // Обработка запросов type:command
  function receiveCommandResponse() {
    let result = '';
    let callback;
    try {
      // if (!mes.uuid) throw '  Error: Not found uuid!';
      // if (!uobj.responseobj) throw '  Error: Not found responseobj in unit!';
      // if (!uobj.responseobj[mes.uuid]) throw '  Error: Not found uuid in responseobj!';

      if (mes.data) {
        // Как-то обработать данные
        // if (mes.command == 'channels') receiveChannels(mes.data);
      }

      if (mes.uuid && uobj.responseobj && uobj.responseobj[mes.uuid]) {
        callback = uobj.responseobj[mes.uuid].callback;

        //
        // let ans = mes.response ? 'COMMANDOK' : 'COMMANDFAIL';
        // callback(null, { message: cg.getMessage(ans) + ' \n' + (mes.message || '') });

        let ansobj;
        if (mes.payload) {
          ansobj = mes.payload;
        } else {
          // ansobj = { message: cg.getMessage(mes.response ? 'COMMANDOK' : 'COMMANDFAIL') + ' \n' + (mes.message || '') };
          let atxt = mes.message || appconfig.getMessage(mes.response ? 'COMMANDOK' : 'COMMANDFAIL');
          ansobj = { message: atxt };
        }
        callback(null, ansobj);
        result = JSON.stringify(ansobj);
        delete uobj.responseobj[mes.uuid];
      }

      // Отправить клиенту clid
      if (mes.clid && mes.send && util.isArray(mes.send)) {
        holder.emit('sendclid', mes.clid, mes.send);
        return 'IH: Send to client ' + mes.clid + ' ' + util.inspect(mes.send);
      }
    } catch (e) {
      result = e.message;
    }
    return 'IH: Received response for command ' + mes.command + ' ' + result;
  }

  // Команда для выполнения пришла от плагина
  // {type:command, command:'device', did, prop}
  // {type:command, command:'setval', did, prop, value}
  // {type:command, command:{filter:{place:1}, act:'on'}}
  function receiveCommandToDo() {
    // { type: 'command', command: { dn, act, prop, value} }
    // let res = 'receiveCommandToDo ' + JSON.stringify(mes);
    const sender = 'plugin:' + unitId;
    let res;
    if (mes.command && typeof mes.command == 'object') {
      const { act } = mes.command;
      if (act == 'set') {
        res = commander.execSet(sender, mes.command, holder);
      } else {
        res = commander.execDeviceCommand(sender, { ...mes.command, prop: act }, holder);
      }
    } else {
      res = { err: 'Expected command object' };
    }

    if (!res || !res.err) {
      res = { response: 1 };
    } else {
      res.response = 0;
    }
    const resObj = { id: mes.id, type: 'command', ...mes.command, ...res };
    uobj.send(resObj);

    /*
    let res = 'receiveCommandToDo ' + JSON.stringify(mes);
    if (mes.command && typeof mes.command == 'object') {
      // const sender = mes.command.sender ? mes.command.sender : { plugin: unit };
      if (mes.command.filter) {
        res = 'doALL ' + res;
        if (typeof mes.command.filter == 'object') {
          commander.doAll(mes.command.filter, mes.command.act, mes.command.value, sender, houser);
        } else {
          res += '\n Expected filter as an object! Operation canceled.';
        }
      }
    } else {
      res = 'do ' + res;
      commander.execCommand(null, mes, holder);
    }
    */
    return 'IH: Receive command: ' + JSON.stringify(mes) + '.\n Send: ' + JSON.stringify(resObj);
  }
};
