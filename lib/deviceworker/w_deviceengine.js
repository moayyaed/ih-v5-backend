/**
 * w_deviceengine.js
 *
 *  Движок устройств на стороне воркера
 *  - добавляет/изменяет/удаляет устройства и типы??
 *    (по сообщениям от основного процесса)
 *  - список обработчиков - подбирает и загружает (должны быть доступны для устройства и свойств)
 *  - запускает обработчики типа уровня устройства (onChange, onSchedule, onInterval)
 *  - обработчики свойств запускает само устройство внутри объекта
 */

const util = require('util');

const hut = require('../utils/hut');
const Typo = require('../device/typo');
const Workdevo = require('./w_devo');
// const handlerutil = require('../device/handlerutil');

// const deviceutil = require('./deviceutil');
const Timerman = require('../utils/timermanager'); // запуск обработчиков через интервал

class Deviceengine {
  constructor(wCore, agent) {
    this.wCore = wCore;
    this.agent = agent;

    this.devSet = wCore.devSet; // key= _id (did)
    this.dnSet = wCore.dnSet; // key = dn,
    this.typeMap = wCore.typeMap;

    this.onChangeByType = {}; // {t002:['state','temp'], t003:'*'}
    this.onGlobalChange = {}; // {dayNight:new Set([type1, type2]), 'Guard':new Set([type1, type2])} // Наоборот

    this.onScheduleByType = {}; // {hourly: new Set([type1, type2])}
    this.onIntervalByType = {}; // {10: new Set([type1, type2])}

    // Обработчики типа - сформировать таблицу onChange
    /*
    const typeItems = [];
    this.typeMap.forEach((typeObj, key) => {
      typeItems.push({ key, ...typeObj.item });
    });
    this.formTypeHandlerSets(typeItems);
    */
    this.typeMap.forEach((typeObj, key) => {
      this.formTypeHandlerSetsFromTypeItem(key);
    });

    this.tm = new Timerman(0.1); // Запустить механизм таймеров c мин интервалом 100 мсек
    this.tm.on('ready', this.onTimerReady.bind(this));
  }

  start() {
    // Если есть функция _format - сразу посчитать и передать назад  Это м б только на старте
    Object.keys(this.devSet).forEach(did => {
      const data = this.devSet[did].calcNullFval();
      if (data) {
        this.wCore.postMessage('accepted:device:data', data);
      }
    });

    // Событие received:device:data - получены данные устройства (от плагина или ..)
    this.wCore.on('received:device:data', getObj => {
      const accepted = [];
      Object.keys(getObj).forEach(did => {
        if (did && this.devSet[did]) {
          accepted.push(...this.devSet[did].acceptData(getObj[did]));
        }
      });
      // console.log('WORKER: accepted '+util.inspect(accepted))
      this.accepting(accepted);
    });

    this.wCore.on('changed:device:data', data => {
      // console.log('CHANGED '+util.inspect(data))
      // Обработчики уровня устройства
      this.runHandlersOnChange(data);
      // Сценарии ??
    });

    this.wCore.on('reset:device:data', data => {
      if (!this.checkData(data, 'reset:device:data', ['did'])) return;
      const accepted = this.devSet[data.did].changeWithRaw();
      this.accepting(accepted);
    });

    this.wCore.on('getcb:device:raw', data => {
      const did = data.did;
      const sobj = { ...data };
      if (did && this.devSet[did]) {
        sobj.result = this.devSet[did]._raw;
        // console.log('WORKER postMessage cb:device:raw '+util.inspect(sobj));
        this.wCore.postMessage('cb:device:raw', sobj);
      } else {
        sobj.error = 'Missing device ' + did;
        this.wCore.postMessage('cb:device:raw', sobj);
      }
    });

    this.wCore.on('exec:device:setvalue', data => {
      const did = data.did;
      if (did && this.devSet[did]) {
        this.devSet[did].setValue(data.prop, data.value);
      }
    });

    this.wCore.on('exec:device:command', data => {
      const did = data.did;
      if (did && this.devSet[did]) {
        this.devSet[did].doCommand(data.prop);
      }
    });

    this.wCore.on('exec:global:setvalue', data => {
      // console.log('WORKER ON exec:global:setvalue ' + util.inspect(data));
      const did = data.did;
      if (did && this.wCore.global.getItem(did)) {
        this.wCore.global.setValue(data.did, data.value);
      } else {
        console.log('ERROR: WORKER: NOT FOUND ' + data.did);
      }
    });

    // TODO - Запуск обработчиков при изменении глобальных переменных
    this.wCore.on('changed:globals', changed => {
      // Присвоить значения
      // Запустить обработчики
      this.runHandlersOnGlobalChange(changed);
    });

    // Запуск обработчиков по расписанию
    this.wCore.on('scheduler:ready', (timername, triggers) => {
      this.runHandlersOnSchedule(timername, triggers);
    });

    // ******************************** События редактирования
    // -------------  globals  ---------------

    this.wCore.on('add:global', data => {
      this.addGlobal(data);
    });

    this.wCore.on('update:global', data => {
      this.updateGlobal(data);
    });

    this.wCore.on('remove:global', data => {
      this.removeGlobal(data);
    });

    this.wCore.on('add:type', data => {
      const typeId = this.addType(data);
      this.formTypeHandlerSetsFromTypeItem(typeId);
    });

    this.wCore.on('remove:type', data => {
      if (!this.checkData(data, 'remove:type', ['typeId'])) return;
      this.removeType(data.typeId);
      this.formTypeHandlerSetsFromTypeItem(data.typeId);
    });

    this.wCore.on('update:type:flat', data => {
      if (!this.checkData(data, 'update:type:flat', ['typeId', 'chobj'])) return;
      const typeObj = this.typeMap.get(data.typeId);
      if (!typeObj) return;
      typeObj.changeFlatFields(data.chobj);

      this.formTypeHandlerSetsFromTypeItem(data.typeId);
    });

    this.wCore.on('update:type:props', data => {
      if (!this.checkData(data, 'update:type:props', ['typeId', 'chobj'])) return;
      const typeObj = this.typeMap.get(data.typeId);
      if (!typeObj) return;

      typeObj.changeProps(data.chobj);
      this.formTypeHandlerSetsFromTypeItem(data.typeId);
    });

    this.wCore.on('update:type:handler', data => {
      // typeId, prop, filename, blk
      if (!this.checkData(data, 'update:type:handler', ['typeId', 'prop', 'filename'])) return;

      hut.unrequire(data.filename);
      const typeObj = this.typeMap.get(data.typeId);
      if (!typeObj) return;

      // Сбросить fn, чтобы затем ее заново загрузить
      typeObj.clearFn(data.prop, data.blk);
    });

    // -------------  device  ---------------

    this.wCore.on('add:device', data => {
      this.addDevice(data);
    });

    this.wCore.on('remove:device', data => {
      this.removeDevice(data);
    });

    // Изменения в таблице device - приходит сообщение, что конкретно изменилось
    this.wCore.on('update:device:dn', data => {
      if (!this.checkData(data, 'update:device:dn', ['did', 'olddn', 'newdn'])) return;
      this.changeDeviceDn(data.did, data.olddn, data.newdn);
    });

    this.wCore.on('update:device:aux', data => {
      if (!this.checkData(data, 'update:device:aux', ['did', 'auxArr'])) return;
      this.devSet[data.did].updateAuxArray(data.auxArr);
    });

    // Изменили тип устройства
    this.wCore.on('update:device:type', data => {
      if (!this.checkData(data, 'update:device:type', ['did', 'type'])) return;
      this.devSet[data.did].changeType(data.type, data.addProps, data.deleteProps);
    });

    // Изменился сам тип устройства (набор свойств)
    this.wCore.on('update:device:props', data => {
      if (!this.checkData(data, 'update:device:props', ['did'])) return;
      this.devSet[data.did].changeTypeProps(data.addProps, data.deleteProps);
    });

    // Изменились статические поля
    this.wCore.on('update:device:flat', data => {
      if (!this.checkData(data, 'update:device:flat', ['did', 'chobj'])) return;
      this.devSet[data.did].changeFlatFields(data.chobj);
    });

    // Изменилась привязка к каналу
    this.wCore.on('update:device:setchannel', data => {
      if (!this.checkData(data, 'update:device:setchannel', ['did', 'prop', 'chobj'])) return;
      this.devSet[data.did].setChannel(data.prop, data.chobj);
    });

    // Изменилась привязка к каналу
    this.wCore.on('update:device:clearchannel', data => {
      if (!this.checkData(data, 'update:device:clearchannel', ['did', 'prop'])) return;
      this.devSet[data.did].clearChannel(data.prop);
    });
  }

  getTypeObj(typeId) {
    return this.typeMap.get(typeId);
  }

  accepting(accepted) {
    if (accepted.length) {
      // Передать в основной процесс
      this.wCore.postMessage('accepted:device:data', accepted);

      // Отработать изменения - запустить обработчики и/или сценарии
      const changed = accepted.filter(item => item && item.changed);
      if (changed.length) this.wCore.emit('changed:device:data', changed);
    }
  }

  runHandlersOnChange(changed) {
    // console.log('RUN OnChange '+util.inspect(changed))
    // Группировать изменения по устройству - обработчик должен запуститься один раз
    // Если внутри обработчиков будут изменения - это будет новая порция событий для changed?
    const devChanged = {};
    changed.forEach(item => {
      if (
        item.did &&
        this.devSet[item.did] &&
        this.devSet[item.did].type &&
        this.onChangeByType[this.devSet[item.did].type]
      ) {
        if (!devChanged[item.did]) devChanged[item.did] = [];
        devChanged[item.did].push(item.prop);
      }
    });

    // console.log('RUN OnChange devChanged ' + util.inspect(devChanged));
    Object.keys(devChanged).forEach(did => {
      // Запуск обработчика типа, если совпадает свойство
      const type = this.devSet[did].type;
      const fun = this.getHandlerForType(type, '_OnChange');
      const hanid = type + '__OnChange';

      const props = this.onChangeByType[type];
      if (fun && props) {
        const triggers = props == '*' ? devChanged[did] : hut.arrayIntersection(props, devChanged[did]);
        if (triggers.length) {
          this.runDeviceHandler(did, hanid, fun, triggers);
        }
      }
    });
  }

  getHandlerForType(type, event) {
    if (this.typeMap.has(type)) {
      const typeObj = this.typeMap.get(type);
      const handlerObj = typeObj.getHandlerObj(event);
      if (!handlerObj || handlerObj.blk) return '';
      return this.agent.getHandlerFunction(type, event, handlerObj);
      // return handlerObj && handlerObj.fn && !handlerObj.blk ? handlerObj.fn : '';
    }
    console.log('ERROR: Not found type ' + type);
  }

  runDeviceHandler(did, hanid, fn, triggers) {
    // console.log('runDeviceHandler ' + hanid);
    try {
      if (fn) {
        const ts = Date.now();
        this.wCore.postMessage('trace:handler', { did, hanid, state: 1, ts });
        this.wCore.currentScriptTs = Date.now();
        fn(this.devSet[did], triggers, this.globals);

        this.wCore.postMessage('trace:handler', { did, hanid, state: 0, ts: Date.now() });
      }
    } catch (e) {
      // блокировать этот обработчик - передать на main
      this.wCore.postMessage('trace:handler', { did, hanid, state: 0, blk: 1, error: hut.getErrStrWoTrace(e) });

      // Нужно у себя блокировать!!
      this.setScriptBlk(hanid, 1);

      // console.log('ERROR: Device Handler: ' + util.inspect(e));
      this.devSet[did].agent.logDevice(did, { ts: Date.now(), prop: 'error', txt: 'Device Handler error!' });
    }

    this.wCore.currentScriptTs = 0;
  }

  setScriptBlk(scriptName, val) {
    // Имя обработчика (или сценария??) - вытащить тип и prop
    // Для типа  - установить флаг блокировки в handlerobj
    const arr = scriptName.split('_');
    if (arr && arr.length > 1) {
      // t002_state
      // intra@termostat_state
      // intra@termostat__OnChange
      // intra@termostat_format_state_animation

      const typeId = arr[0];
      const typeObj = this.getTypeObj(typeId);
      if (!typeObj) {
        console.log('ERROR: Not found type ' + typeId + ' for handler ' + scriptName);
        return;
      }

      arr.splice(0, 1);
      const prop = arr.join('_');
      console.log('setScriptBlk type=' + typeId + ' prop=' + prop);
      typeObj.setHandlerBlk(prop, val);
    }
  }

  runHandlersOnGlobalChange(changed) {
    //  {did: 'gl002', prop: 'dayNight', value: 1, ts: 1615487425742,}
    changed.forEach(item => {
      if (this.onGlobalChange[item.did]) {
        // Есть обработчики типов, которые запускаются по этой глобальной переменной
        for (const type of this.onGlobalChange[item.did]) {
          const fun = this.getHandlerForType(type, '_OnChange');
          const hanid = type + '__OnChange';
          Object.keys(this.devSet).forEach(did => {
            if (this.devSet[did].type == type) {
              this.runDeviceHandler(did, hanid, fun, ['globals.' + item.prop]);
            }
          });
        }
      }
    });
  }

  runHandlersOnSchedule(timername, triggers) {
    if (!timername || !this.onScheduleByType[timername]) return;

    for (const type of this.onScheduleByType[timername]) {
      // Найти все устройства данного типа, запустить обработчик для каждого устройства
      const fun = this.getHandlerForType(type, 'OnSchedule');
      const hanid = type + '_OnSchedule';
      Object.keys(this.devSet).forEach(did => {
        if (this.devSet[did].type == type) {
          this.runDeviceHandler(did, hanid, fun, triggers);
        }
      });
    }
  }

  onTimerReady(timeobj) {
    // Проверить, какие типы запускаются с этим интервалом
    const interval = timeobj.tname;
    if (this.onIntervalByType[interval]) {
      //
      this.tm.startTimer(interval, { owner: 'type', tname: interval });
      for (const type of this.onIntervalByType[interval]) {
        // Найти все устройства данного типа, запустить обработчик для каждого устройства
        const fun = this.getHandlerForType(type, 'OnInterval');
        const hanid = type + '_OnInterval';
        Object.keys(this.devSet).forEach(did => {
          if (this.devSet[did].type == type) {
            this.runDeviceHandler(did, hanid, fun, [interval]);
          }
        });
      }
    }
  }

  /**
   * Формирует структуры для запуска обработчиков
   * Вызывается при добавлении/ редактировании/удалении типа
   * @param {String} - type
   *
   */
  formTypeHandlerSetsFromTypeItem(type) {
    // console.log(' formTypeHandlerSets arr=' + util.inspect(arr));
    // arr.forEach(item => {
    // const type = item._id;
    const typeObj = this.getTypeObj(type);
    if (!typeObj) return;
    const item = typeObj.item;

    let par_OnChange = '';
    let par2_OnChange = '';
    if (item.scriptOnChange) {
      if (item.par_OnChange == '*') {
        par_OnChange = '*';
      } else if (item.par_OnChange) {
        par_OnChange = Array.isArray(item.par_OnChange) ? item.par_OnChange : item.par_OnChange.split(/\s*,\s*/);
      }
      par2_OnChange = item.par2_OnChange; // Если существует глобальная переменная??
    }
    this.onChangeByType[type] = par_OnChange; // Если сбросили - будет пусто

    if (par2_OnChange) {
      addToSet(this.onGlobalChange, type, par2_OnChange);
    } else {
      removeFromAllSet(this.onGlobalChange, type);
    }

    if (item.scriptOnInterval) {
      addToSet(this.onIntervalByType, type, item.par_OnInterval || 600);
    } else {
      // сбросить
      removeFromAllSet(this.onIntervalByType, type);
    }

    this.updateSchedule(
      item.scriptOnSchedule,
      item.par_OnSchedule == 'cron' ? item.par2_OnSchedule : item.par_OnSchedule,
      type
    );
    // });

    // console.log('this.onChangeByType=' + util.inspect(this.onChangeByType));
    // console.log('this.onIntervalByType=' + util.inspect(this.onIntervalByType));
  }

  updateSchedule(flag, par, type) {
    // console.log('DEVICEENGINE updateSchedule flag='+flag+' par='+par+' type='+type);
    // Проверить, что было включено
    const included = getKeyOfSet(this.onScheduleByType, type);

    if (!flag && !included) return;
    if (flag && included == par) return;

    if (included) {
      this.onScheduleByType[included].delete(type);
      this.holder.emit('schedule:exclude', included);
    }

    if (flag && par) {
      addToSet(this.onScheduleByType, type, par);
      console.log('schedule:include par=' + par + ' type=' + type);
      this.holder.emit('schedule:include', par);
    }
  }

  getDevice(did) {
    return this.devSet[did];
  }

  hasDevice(did) {
    return !!this.devSet[did];
  }

  //    Операции добавления/ удаления/ редактирования по сообщениям от main
  /**
   * Добавить новую глобальную переменную
   * @param {*} doc
   */
  addGlobal(doc) {
    if (!doc || !doc._id) return;
    const did = doc._id;
    this.wCore.global.addItem(did, doc);
  }

  updateGlobal(did) {
    this.wCore.global.updateItem(did);
  }

  removeGlobal(did) {
    this.wCore.global.removeItem(did);
  }

  /**
   * Добавить новый тип
   * @param {*} type_struct
   */
  addType(type_struct) {
    this.typeMap.set(type_struct._id, new Typo(type_struct));
    console.log('WORKER addType ' + util.inspect(this.typeMap.get(type_struct._id)));
    return type_struct._id;
  }

  removeType(typeId) {
    this.typeMap.delete(typeId);
    console.log('WORKER removeType ' + typeId);
  }

  /**
   * Добавить новое устройство
   * @param {*} device_struct
   */
  addDevice(device_struct) {
    const did = device_struct._id;
    this.devSet[did] = new Workdevo(device_struct, this.typeMap, this.agent);
    this.dnSet[device_struct.dn] = this.devSet[device_struct._id]; // Объект устройства для обращения по dn, свойства плоские
  }

  removeDevice(doc) {
    if (!doc || !doc._id) return;
    if (this.devSet[doc._id]) {
      const dn = this.devSet[doc._id].dn;
      if (dn) delete this.dnSet[dn];
      delete this.devSet[doc._id];
    }
  }

  setChannelLink(did, prop, upDoc) {
    if (!this.devSet[did]) return;
    this.devSet[did].setChannel(prop, upDoc);
  }

  clearChannelLink(did, prop) {
    if (!this.devSet[did]) return;
    this.devSet[did].clearChannel(prop);
  }

  // Изменили dn устройства
  changeDeviceDn(did, olddn, newdn) {
    if (this.devSet[did]) {
      this.devSet[did].dn = newdn;
      this.dnSet[newdn] = this.devSet[did];
    }
    this.dnSet[olddn] = null;
  }

  // При сбросе привязки к каналу - сбросить значение на дефолтное
  resetValueWithDefault(did, prop) {
    if (!this.devSet[did]) return;
    this.holder.emit('received:device:data', { [did]: { [prop]: 0 } });
  }

  checkData(data, event, propArr) {
    let str = 'ERROR: Worker processing: ' + event;

    if (!data) {
      console.log(str + ' Expected data object ');
      return;
    }
    if (propArr) {
      for (const prop of propArr) {
        if (data[prop] == undefined) {
          console.log(str + ' Expected data object with prop: ' + propArr.join(','));
          return;
        }
      }

      // console.log(' Worker get "'+event+'" with data '+util.inspect(data));
      if (propArr[0] == 'did') {
        if (!this.devSet[data.did]) {
          console.log(str + ' Missing ' + data.did + ' in devSet: data=' + util.inspect(data));
          return;
        }
      } else if (propArr[0] == 'typeId') {
        if (!this.typeMap.has(data.typeId)) {
          console.log(str + ' Missing type ' + data.typeId);
          return;
        }
      }
    }
    return true;
  }
}

// Private
function addToSet(obj, type, par) {
  if (!obj[par]) obj[par] = new Set();
  obj[par].add(type);
}

function removeFromAllSet(obj, type) {
  Object.keys(obj).forEach(par => {
    if (obj[par] && obj[par].has(type)) obj[par].delete(type);
  });
}

function getKeyOfSet(obj, type) {
  for (const key of Object.keys(obj)) {
    if (obj[key] && obj[key].has(type)) return key;
  }
}

module.exports = Deviceengine;

function wrapGlobal(glSet) {
  return new Proxy(
    {},
    {
      get(target, prop) {
        return glSet.getValue(prop);
      },

      set(target, prop, value) {
        glSet.setValue(prop, value, { src: 'device' });
        return true;
      }
    }
  );
}
