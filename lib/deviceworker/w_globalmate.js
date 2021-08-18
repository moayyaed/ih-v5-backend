/**
 * w_globalmate.js
 * 
 * Слушает все события, связанные с глобальными переменными
 * 
 *  События данных: 
 *  'received:globals' - присвоить значение переменной в воркере, которое уже присвоено 
 *  'exec:global:setvalue' - выполнить команду - присвоить значение переменной
 *  'changed:device:data' - запустить обработчики по триггерам-устройствам
 *
 *  События, связанные с редактированием глобальных переменных
 * - добавление, удаление глобальной переменной, редактирование настроек
 * - редактирование обработчика по триггерам
 * - редактирование набора обработчиков
 */

const util = require('util');

class W_globalmate {
  constructor(engine) {
    this.engine = engine;
    this.wCore = engine.wCore;
  }

  async start() {

    // для запуска обработчиков по триггерам-устройствам
    this.wCore.on('changed:device:data', data => {
      this.engine.runHandlersOnChange(data);
    });

    this.wCore.on('received:globals', getObj => {
      Object.keys(getObj).forEach(did => {
        this.engine.setValue(did, getObj[did]);
      });
    });

    this.wCore.on('exec:global:setvalue', data => {
      // console.log('WORKER ON exec:global:setvalue ' + util.inspect(data));
      this.engine.setValue(data.did, data.value);
    });

    // doc = { _id: 'gl008', parent: 'globalgroup', name: 'New var', dn: 'var191', defval: 0, value: 0 };
    this.wCore.on('add:global', doc => {
      if (!doc || !doc._id || !doc.dn) return;
      this.engine.addItem(doc._id, doc);
    });

    this.wCore.on('update:global', data => {
      // if (!this.checkData(data, 'update:global', ['did', 'chobj'])) return;
      if (!data || !data.did || !data.chobj) return;
      this.engine.updateItem(data.did, data.chobj);
    });

    this.wCore.on('remove:global', data => {
      if (!data || !data.did ) return;
      this.engine.removeItem(data.did);
    });



  }
}

module.exports = W_globalmate;
