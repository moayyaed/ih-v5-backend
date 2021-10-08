/**
 *  accessmanager.js
 *
 *  Объект для организации правил доступа
 *  Обеспечивает
 *      
 */

const util = require('util');

const hut = require('./utils/hut');
// const loadsys = require('./utils/loadsys');

// const appconfig = require('./appconfig');



class Accessmanager  {


  async start(dm) {
    this.dm = dm; 

    // строим структуры доступа
    this.userGroups = {}; // {userId:[grp001,..], ...}Группы, в которые входит пользователь
    this.userGroups.u0003 = ['admgrp', 'grp002'];
                          // перебираем, пока не находим разрешение
    this.layoutGroups = {}; // {layId: new Set(grp001,grp003)} 

    this.layoutGroups.l025 = new Set(['admgrp']);
    this.layoutGroups.l022 = new Set(['admgrp']);

    // слушаем изменения правил доступа

    // Изменены правила группы
    this.dm.on('updated:agroup', docs => {
      // for (const doc of docs) {
      //  this.engine.removeGlobal(doc);
      // }
    });

    // Удалены правила группы
    this.dm.on('removed:agroup', docs => {
      // for (const doc of docs) {
      //  this.engine.removeGlobal(doc);
      // }
    });

    // Добавлены правила группы для экранов

    // Добавлены правила группы для управления устройствами
    
    // Изменения вхождения пользователя в группу

  }

  isLayoutAllowed(layId, userId) {
    // return layId == 'l025';
    // if (this.layoutGroups[layId] && this.layoutGroups[layId].has()
 
    if (!this.layoutGroups[layId]) {
      console.log('Not found layId='+layId)
      return; // Если экрана нет в списке - Запрещено всем??
    }
    if (!this.userGroups[userId]) {
      console.log('Not found userId='+userId)
      return; // Если пользователя нет в списке
    }
    for (const group of this.userGroups[userId]) {
      console.log('group='+group+' this.layoutGroups[layId]='+util.inspect(this.layoutGroups[layId]))
      if (this.layoutGroups[layId].has(group)) return true;
    }

  }

}

module.exports = new Accessmanager();
