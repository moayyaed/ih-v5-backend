/**
 * alertmate.js
 */

const util = require('util');
// const fs = require('fs');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');

class Alertmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  start() {
    // При изменении тревог в типе
    this.dm.on('add:type:alerts', (type, props) => {
      // console.log('add:type:alerts type='+type+' props='+util.inspect(props) )
      // Добавить в списки this.alertsByType
      this.engine.formAlertsByTypeFromTypeItem(type, props);

      // Пытаться генерировать тревоги без изменения значений для устройств этого типа?
      // Пока не делаю - сработает при изменении
    });

    this.dm.on('update:type:alerts', (type, prop) => {
      // console.log('update:type:alerts type='+type+' props='+util.inspect(prop) )
      // Изменилось тело алерта для свойства prop
      // Перегенерировать - удалить, потом добавить
      // ничего не делаю - в типе уже изменено, берется из типа
    });

    this.dm.on('remove:type:alerts', (type, props) => {
      // Удалить из списка this.alertsByType
      this.engine.formAlertsByTypeFromTypeItem(type, props);

      // Удалить все текущие алерты для устройств этого типа по заданным свойствам
      this.engine.removeAlertsForProps(type, props);
    });
  }
}

module.exports = Alertmate;
