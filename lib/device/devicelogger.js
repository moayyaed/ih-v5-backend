/**
 * devicelogger.js
 * Объект для работы с индивидуальными журналами устройств
 *
 *  Индивидуальные журналы устройств хранят данные о выполненных командах, алертах и изменении данных
 *  Это самый коротко живущий журнал,
 *    число записей для одного устройства определяется константой 'project_deviceloglines' = 100 (def)
 *  При превышении числа записей после добавления новых записей старые удаляются
 *
 *  Механизм хранения:
 *   Персистентные хранилища:
 *   - Таблица devicelog (sql), которая ведется logagent-ом (sqlite по умолчанию)
 *     Схема данных таблицы devicelog: {did, prop, val, txt, ts, tsid, cmd, sender}
 *     В таблице может быть несколько записей по одному свойству в хронологическом порядке
 *     Но общее число записей по устройству ограничено  
 *     Команды и алерты пишутся всегда, записи об изменении - 
 *      только если у свойства флаг "save"=1 (сохранять в журнал)
 *     Задача таблицы - сохранять журналы устройств между перезагрузками
 * 
 *   - Таблицы devcurrent и devparam (nosql - nedb)
 *     В них хранится только одно, последнее значение каждого свойства 
 *     Задача  - сохранять  последнее значение каждого свойства при перезагрузке
 *  
 *   Runtime memory cache:
 *   Объект this.devInnerLog[did] хранит записи журнала для каждого устройства
 *   - записи первоначально получены из таблицы devicelog, далее пополняются при добавлении
 *   - при добавлении  параллельно делается запись в таблицу devicelog
 *   - при превышении числа записей они удаляются из devInnerLog и из хранилища devicelog
 *
 *
 *
 *
 */

// const util = require('util');

const appconfig = require('../appconfig');
const deviceutil = require('./deviceutil');
const logconnector = require('../log/logconnector');

module.exports = {
  start(holder) {
    this.holder = holder;
    this.devInnerLog = {}; // [did]  = [{prop, val, ts, ...}, ...]

    this.removedLines = {};
    this.deviceloglines = appconfig.get('project_deviceloglines') || 100;
  },

  /**
   * Добавление первой записи в журнал устройства (this.devInnerLog) на этапе старта сервера
   *
   * @param {String} did
   * @param {Object} dataObj {<prop>:{ val, ts} } - записи для свойств,
   *         сохраненные и считанные на старте из devcurrent или devparam (зависит от типа свойства)
   *         Эти значения присвоены свойствам на старте
   * Добавленные записи помечаются флагом boot=1
   */
  addFirst(did, dataObj) {
    const innerLog = (this.devInnerLog[did] = []);

    if (typeof dataObj == 'object') {
      Object.keys(dataObj).forEach(prop => {
        innerLog.push({ did, prop, val: dataObj[prop].val, ts: dataObj[prop].ts, boot: 1 });
      });
    }
    // Сформировать пустую запись в журнале, которая указывает позицию записей после загрузки
    if (!innerLog.length) innerLog.push({ boot: 1 });
  },

  /**
   * Добавление записи в журнал
   *  
   * @param {String} did
   * @param {Object} logObj { did, prop, ts, val, txt, cmd, sender }
   */
  addLog(did, logObj) {
    const dobj = did ? this.holder.devSet[did] : '';
    if (!dobj) return [];

    // Добавить в devInnerLog как есть
    if (!this.devInnerLog[did]) this.devInnerLog[did] = [];
    // const innerLog = this.devInnerLog[did];
    this.devInnerLog[did].push({ did, ...logObj }); 

    // Передать подписчикам (devicelog на интерфейсах
    // Тексты должны быть готовы
    const data = [deviceutil.getLogTitleAndMessage(dobj, logObj)];
    this.holder.emit('devicelog', { did, data });

    // Удалить записи, если уже больше (+10?)
    if (this.devInnerLog[did].length > this.deviceloglines + 10) {
      this.removeOldRecords(did)
    }

    logconnector.addLog('devicelog', { did, ...logObj });
  },

  /**
   * Удаление записей 
   *  - из devInnerLog удаляется сразу, чтобы осталось нужное число записей
   *  - из БД удаляется пачками, чтобы снизить нагрузку на БД
   *    - считаем, сколько записей удалили для каждого устройства нарастающим
   *    - когда число удаленных записей достигает x, отправляем запрос на удаление:
   *      удалить все записи для did,prop c ts < первая запись в innerLog 
   * @param {String} did 
   */
  removeOldRecords(did) {
    const innerLog = this.devInnerLog[did];
    const rCount = innerLog.length - this.deviceloglines;

    innerLog.splice(0, rCount); // 11 записей за раз?
    if (!this.removedLines[did]) this.removedLines[did] = 0;
    this.removedLines[did] += rCount;

    // Удалить из БД - если удалено столько же сколько сохранено (удвоилось)
    if (this.removedLines[did] > this.deviceloglines) {
      this.removedLines[did] = 0;
      logconnector.deleteLog('devicelog', { ts: innerLog[0].ts, where: [{ name: 'did', val: did }] });
    }
  },

  /**
   * Возвращает журнал устройства
   *   Если данные после старта сервера для этого устройства еще не были считаны из таблицы
   *   - заполнить журнал из таблицы 
   * @param {String} did 
   * @param {Boolean} reverse 
   */
  async getLog(did, reverse) {
    const innerLog = this.devInnerLog[did];
    if (!innerLog || !innerLog.length) return [];

    if (innerLog.length < 90 && innerLog[0].boot) {
      // Загрузить первый раз из таблицы
      await this.fillInnerLogFromTable(did);
    }
    const res = [...innerLog];
    return reverse ? res.reverse() : res;
  },

  async fillInnerLogFromTable(did) {
    const innerLog = this.devInnerLog[did];

    // Устройство только что создано или уже много записей, что boot уже удалили
    if (!innerLog || !innerLog.length || !innerLog[0].boot) return []; 

    // Первые записи - boot -> из таблицы данные еще не брались
    const bootTs = this.holder.system.bootTs;
    const arr = await logconnector.getLog(
      'devicelog',
      { did, ts: { $lt: bootTs } },
      { limit: 100 - innerLog.length, sort: { ts: -1 } }
    );

    const bootCount = countBoot();
    if (arr.length) {
      // Если записи в БД есть - добавить в начало массива А boot записи удалить
      innerLog.splice(0, bootCount, ...arr.reverse()); // Данные пришли в обратном порядке (desc)
    } else if (innerLog[0].prop) {
      // Возможно, записей в журнале нет (уже удалены) 
      // - оставить данные, загруженные на старте но сбросить boot флаг
      // чтобы второй раз не запрашивать данные из БД
      for (let i = 0; i < bootCount; i++) {
        innerLog[i].boot = 0;
      }
    } else {
      // Если данных на старте не было - удалить из массива первую запись
      innerLog.shift();
    }

    function countBoot() {
      let count = 0;
      for (let i = 0; i < innerLog.length; i++) {
        if (!innerLog[i].boot) break;
        count++;
      }
      return count;
    }
  }
};
