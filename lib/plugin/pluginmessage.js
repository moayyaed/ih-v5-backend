/**
 * pluginmessage.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

/** 
const gendev = require('../devhandle/gendev');
const commander = require('../devhandle/commander');
const channels = require('./channels');
const virtdata = require('../jhandle/virtdata');
const sceneutils = require('../sceneserver/sceneutils');
*/


/**
 * Обработка сообщения от плагина.
 * Посылается ответ плагину, если нужно
 *
 * @param {Object} mes - Поступившее сообщение
 * @param {Object} uobj - объект плагина из unitSet
 * @param {Object} holder
 *
 * @return {String} - debug-сообщение
 */
module.exports = function (mes, uobj, holder) {
 

  const unit = uobj.id;
  const plugin = uobj.plugin;
  console.log('pluginmessage '+unit+': GET MESSAGE '+util.inspect(mes));

  const id = mes.id;
  const filter = mes.filter;


  if (typeof mes == 'object') {
    switch (mes.type) {
      case 'get':
        return sendGetResponse();

      case 'set':
        return receiveSet();

      case 'command':
        return mes.response != undefined ? receiveCommandResponse() : receiveCommandToDo();

      case 'channels':
        return receiveChannels(mes.data);

      case 'histdata':
        return processHistdata();

      case 'transferdata':
        holder.emit('transferdata_out', Object.assign({ unit }, mes));
        return;

      case 'startscene':
        if (mes.id) holder.emit('startscene', mes.id, mes.arg || '');
        return 'IH: startscene ' + mes.id;

      case 'log':
      case 'debug':
        return unit + ': ' + (typeof mes.txt == 'object' ? util.inspect(mes.txt) : mes.txt);

      default:
        return 'IH: Unexpected message type ' + mes.type;
    }
  }

  // //////////////////////////////////////////////////////////////////////
  // Обработка запросов type:get
  function sendGetResponse() {
    if (mes.tablename) {
      uobj.send(Object.assign({ type: 'get', response: 1 }, getObjForTablename(mes.tablename)));
    } else if (mes.name) {
      uobj.send({ id, type: 'get', data: getDataForName(mes.name), response: 1 });
    }
  }

  function getObjForTablename(tablename) {
    let ii = tablename.indexOf('/');
    if (ii > 0) tablename = tablename.substr(0, ii);
    /*

    switch (tablename) {
      case 'params':
        return { params: getModuleParams() };

      case 'system':
        return { system: getSystemParams() };

      case 'config':
      case 'channels':
        return { config: getModuleChannels() };

      case 'extra':
      case 'pluginextra':
        return { extra: getModuleExtra() };

      case 'infousers':
      case 'infoaddr':
        return { infousers: getModuleInfousers() };

      default:
        return { [tablename]: jdb.get({ name: tablename, filter }) };
    }
    */
  }

  function getDataForName(name) {
    console.log('getDataForName '+name)
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

      case 'assets':
        return getModuleAssets(unit);  

      case 'methods':
        return getModuleMethods();

      case 'method':
        return getModuleMethod();

      case 'infousers':
      case 'infoaddr':
        return getModuleInfousers();

      case 'devhardlinks':
        return virtdata.getVirtData('devhardlinks', { filter: { unit } }, holder);

      case 'devprops':
        return getDevprops();

      
      default:
        // return virtdata.isVirtData(name) ? virtdata.getVirtData(name, { filter }, holder) : jdb.get({ name, filter });
    }
    
  }

  function getDevprops() {
    let props;
    if (filter.props) {
      props = hut.clone(filter.props);
    }
    delete filter.props;

    return Object.keys(holder.devSet)
      .filter(dn => !filter || hut.isInFilter(holder.devSet[dn], filter))
      .map(dn => (props ? holder.devSet[dn].getCurrentPropValues(props) : holder.devSet[dn].getCurrent(true))); // вернуть props v4
  }


  function getModuleChannels() {
    const res =  uobj.charr.map(item => Object.assign({id:item.chan}, item));
    return res;
  }

  function getModuleExtra() {
    return jdb.get({ name: 'pluginextra', filter: { unit } });
  }

  function getModuleMethods() {
    return jdb
      .get({ name: 'scenes', filter: { plugin } })
      .map(item => ({ method: item.id, name: item.name, description: item.description, version: item.version }));
  }

  function getModuleMethod() {
    const method = filter && filter.method ? filter.method : '';
    return method
      ? sceneutils.getScriptFromFile(appconfig.getMethodFilename(method, plugin))
      : 'ERR: Expected method property!';
  }
  function getModuleInfousers() {
    return jdb.get({ name: 'infoaddr', filter: { infotype: unit } });
  }

  // Вернуть объект, содержащий значения параметров, которые прописаны в манифесте
  function getModuleParams() {
    let result = {};
    /*
    let rec = jdb.getFirstRecord({ name: 'units', filter: { id: unit } });
    uobj.paramnames.forEach(prop => {
      if (rec[prop] != undefined) {
        result[prop] = rec[prop];
      }
    });
    */

    result.debug = uobj.debug ? 'on' : 'off';
    result.loglevel = uobj.loglevel || 0;
    result.lang = appconfig.get('lang');
    
    return result;
  }

  function getSystemParams() {
    return {
      port: Number(holder.getConfig('port')),
      tempdir: appconfig.get('temppath'),
      serverkey: appconfig.get('serverkey')
    };
  }

  // //////////////////////////////////////////////////////////////////////
  // Обработка запросов type:set
  function receiveSet() {
    try {
      if (!mes.name) throw { message: 'Missing "name" property!' };
      if (!mes.data) throw { message: 'Missing "data" property!' };

      let res;
      if (mes.name == 'channels') {
        res = receiveChannels(mes.data);
      } else if (mes.name == 'assets') {
        res = writeAssets(unit, mes.data);
      } else {
        jdb.rewriteTable(mes.name, mes.data);
        res = 'Rewrited table: ' + mes.name;
      }

      uobj.send({ id, type: 'set', response: 1 });
      return res;

      // throw { message: 'Unsupported.' };
    } catch (e) {
      uobj.send({ id, type: 'set', error: e.message, response: 0 });
      return 'IH: Receive type:set name:' + mes.name + ' ERR:' + e.message;
    }
  }

  // //////////////////////////////////////////////////////////////////////
  // Обработка запросов type:channels -или type:set name:channels
  function receiveChannels(data) {
    if (!data || !unit) return;
    let res = 'Received channels: ' + data.length;

    // Сравнить текущие каналы с новыми
    const curchan = readChannels(unit);

    // Плагин может сразу передать текущее значение value
    const values = [];
    data.forEach(item => {
      if (item.value != undefined) {
        values.push({id:item.id, value:item.value});
        // В канале сохранять value не нужно
        delete item.value;
      }
    });

    // Сохранить каналы в файл как передал плагин
    writeChannels(unit, data);

    // И значения с каналов 
    if (values.length) channels.saveCurrentChannelsValue(uobj, values, holder);

    // Выбрать новые каналы
    const newchan = data.filter(item1 => curchan.every(item2 => item1.id != item2.id));

    if (newchan && newchan.length > 0 && uobj.gendevices) {
      gendev.genLinkedDevices(newchan, uobj, holder);
      res += ' Created devices: ' + newchan.length;
    }

    // ??? Здесь не генерируем новые readMap, writeMap, это будет по событию rebuildUnitMaps после сохранения таблиц
    // Генерировать с небольшой задержкой на запись каналов в таблицы
    setTimeout(() => {
      channels.rebuildReadWriteMap(unit);
      // Если пришли значения, и ранее было привязка к устройству - сразу отработать
      if (values.length) {
        const readObj = uobj.readData(values, holder);
        holder.setDevPropsFromUnit(readObj);
      }
    }, 500);
    return 'IH: ' + res;
  }

 

  // //////////////////////////////////////////////////////////////////////
  // Обработка запросов type:histdata
  function processHistdata() {
    if (!mes.data || !util.isArray(mes.data)) return;

    mes.data.sort(hut.byorder('ts'));
    holder.emit('histdata', uobj.readHistData(mes.data, holder));
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
        if (mes.command == 'channels') receiveChannels(mes.data);
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
          let atxt = mes.message || cg.getMessage(mes.response ? 'COMMANDOK' : 'COMMANDFAIL');
          ansobj = { message: atxt };
        }
        callback(null, ansobj);
        result = JSON.stringify(ansobj);
        delete uobj.responseobj[mes.uuid];
      }

      // Отправить клиенту clid
      if (mes.clid && mes.send && Array.isArray(mes.send)) {
        holder.emit('sendclid', mes.clid, mes.send);
        return 'IH: Send to client ' + mes.clid + ' ' + JSON.stringify(mes.send);
      }
    } catch (e) {
      result = e.message;
    }
    return 'IH: Received response for command ' + mes.command + ' ' + result;
  }

  // Команда для выполнения пришла от плагина
  // {type:command, command:{dn:'LAMP1', act:'on'}}
  // {type:command, command:{filter:{place:1}, act:'on'}}

  function receiveCommandToDo() {
    let res = 'receiveCommandToDo ' + JSON.stringify(mes);
    if (mes.command && typeof mes.command == 'object') {
      const sender = mes.command.sender ? mes.command.sender : { plugin: unit };
      if (mes.command.filter) {
        res = 'doALL ' + res;
        if (typeof mes.command.filter == 'object') {
          commander.doAll(mes.command.filter, mes.command.act, mes.command.value, sender, holder);
        } else {
          res += '\n Expected filter as an object! Operation canceled.';
        }
      } else {
        res = 'do ' + res;
        commander.doCommands(mes.command, sender, holder);
      }
    }
    return 'IH: ' + res;
  }

  
}

/*
function readChannels(unitid) {
  return jdb.get({ name: 'channels/' + String(unitid).toLowerCase() });
}

function writeChannels(unitid, data) {
  // Пока все переписывается заново!! Но возможно нужно добалять-удалять или разделить на файлы (для отдельных контроллеров?)
  jdb.rewriteTable('channels/' + String(unitid).toLowerCase(), data);
}

function writeAssets(unit, data) {
  const name = 'pluginassets/' + String(unit).toLowerCase();
  jdb.rewriteTable(name, data);
  return 'Rewrited table: ' +name;
}

function getModuleAssets(unit) {
  const name = 'pluginassets/' + String(unit).toLowerCase();
  return jdb.get({ name });
}
*/