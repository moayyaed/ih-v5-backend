/**
 * alertmate.js
 */

// const util = require('util');
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
      // Добавить в списки this.alertsByType
      this.engine.formAlertsByTypeFromTypeItem(type, props);

      // Пытаться генерировать тревоги без изменения значений для устройств этого типа?
      // Пока не делаю - сработает при изменении
    });

    this.dm.on('update:type:alerts', (type, prop) => {
      // Изменилось тело алерта для свойства prop
      // Перегенерировать - удалить, потом добавить
      // Пока ничего не делаю - в типе уже изменено
    });

    this.dm.on('remove:type:alerts', (type, props) => {
      // Удалить из списка this.alertsByType

      // Удалить все текущие алерты для устройств этого типа по заданным свойствам
      this.engine.removeAlertsForProps(type, props);
    });

     // При изменении оперативных журналов

     
  }
}

module.exports = Alertmate;
