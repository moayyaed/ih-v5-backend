/**
 * processmessage.js
 * Обработка сообщений от плагинов
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const dm = require('../datamanager');

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
  const unitId = uobj.id;
  // console.log('WARN: FROM PLUGIN ' + unitId + ' MESSAGE: ' + util.inspect(m));

  // readTele - преобразование входной строки в объект чисто техническое.
  // Но возможно есть адаптер - тогда ему передается holder
  const mes = uobj.chano && uobj.readTeleV5 ? uobj.readTeleV5(m, uobj.chano.readMap, holder) : m;
  if (typeof mes != 'object') return;

  switch (mes.type) {
    case 'data':
      return processData(mes.data, uobj);

    case 'sub':
      return doSub(mes, unitId);

    case 'unsub':
      return doUnsub(mes, unitId);

    case 'get':
      const res = await sendGetResponse();
      return res;

    /*
    case 'set':
      return receiveSet();

    case 'command':
      return mes.response != undefined ? receiveCommandResponse() : receiveCommandToDo();

    case 'channels':
      return receiveChannels(mes.data);

    case 'histdata':
      return processHistdata();
    */

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

  function processData(data) {
    if (!data) return;
    const readObj = uobj.chano.readData(data, holder); // Если привязок нет - может ничего и не быть!!
    if (readObj) holder.emit('received:device:data', readObj);
    return 'IH: get ' + util.inspect(data) + '\nset ' + util.inspect(readObj);
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
      /*
      case 'infousers':
      case 'infoaddr':
        return { infousers: getModuleInfousers() };
      */
      default:
      // return { [tablename]: jdb.get({ name: tablename, filter }) };
    }
  }

  async function getDataForName(name) {

    switch (name) {
      case 'params':
        return getModuleParams();

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

      case 'infousers':
      case 'infoaddr':
        return getModuleInfousers();

      case 'devhardlinks':
        return virtdata.getVirtData('devhardlinks', { filter: { unit } }, holder);
      */

      case 'devprops':
        return getDevprops();

      default:
      // return virtdata.isVirtData(name) ? virtdata.getVirtData(name, { filter }, holder) : jdb.get({ name, filter });
    }
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
    const res = uobj.chano.charr.filter(item => !item.folder).map(item => Object.assign({ id: item.chan }, item));

    // console.log('WARN: getModuleChannels '+util.inspect(res))
    return res;
  }

  async function getModuleExtra() {
    return dm.dbstore.get('pluginextra', { unit: unitId });

  }

  function doSub() {
    // Сформировать объект подписки:
    if (mes.id) uobj.subs.set(mes.id, mes);
  }

  function doUnsub() {
    if (mes.id && uobj.subs.has(mes.id)) uobj.subs.delete(mes.id);
  }
};
