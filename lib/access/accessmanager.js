/**
 *  accessmanager.js
 *
 *  Объект для реализации правил доступа, правила определяются для групп
 *  - Таблица agroups: список групп, правила (разрешения) для группы
 *  - Таблица agroup_tab: cвязка группа - пользователь 
 *            (пользователь может входить в несколько групп, правила объединяются)
 * 
 *  Методы:
 *  Доступ к UI:
 *   isLayoutAvailable(layId, userId) - доступен ли экран layId пользователю userId => true/false
 *   getUserDevctlRules(userId) - возвращает правила управления устройствами для пользователя
 *   
 * Доступ к PM:
 *   isPMAvailable(userId) - доступен ли PM в целом для userId => true/false
 *   getPMAccessLevel(userId) - уровень доступа к PM для userId => 0(нет доступа), 1(ограничен), 2(полный доступ)
 * 
 *  - в случае ограниченного доступа к PM:
 *   isPMQueryAllowed(query, userId) - доступен ли запрос query (/admin/...) для userId => true/false
 *   getUserPMParts(userId) - возвращает правила доступа: флаг, список разделов => { all_pmparts: 2, pmparts: Set['access','vis'] }
 *                            используется для формирования pmmenu
 *   hasUserPMWritePermission(userId) - может ли пользователь выполнять редактирование в PM => true/false
 */

const util = require('util');
const accessutil = require('./accessutil');

class Accessmanager {
  async start(dm) {
    // Проверяет, что пользователи с role включены в какую-то группу
    // Добавляет пользователей в группы, при необходимости создает группы 
    // role - работало до 5.5.105
    // Нужно в переходный период
    await accessutil.reviseUserGroups(dm);

    this.dm = dm;
    // Группы, в которые входит пользователь
    this.userGroups = {}; // {userId:new Set([grp001,grp003]) }
    (await dm.get('agroup_tab')).forEach(doc => this.addUserGroup(doc));

    // Правила для каждой группы
    this.groupRules = {}; // {groupId:{all_layouts: 1, all_devctl: 1,all_pmparts: 2, layouts: Set[], devctl: Set[]}
    (await dm.get('agroups')).forEach(doc => this.addGroupRules(doc));
    this.addDef();
   
  }

  // Пользователь - группа
  addUserGroup(doc) {
    const { groupId, userId } = doc;
    if (!groupId || !userId) return;

    if (!this.userGroups[userId]) this.userGroups[userId] = new Set();
    this.userGroups[userId].add(groupId);
  }

  removeUserGroup(doc) {
    const { groupId, userId } = doc;
    if (!groupId || !userId || !this.userGroups[userId]) return;
    this.userGroups[userId].delete(groupId);
  }

  // Правила группы
  addGroupRules(doc) {
    const id = doc._id;
    if (!id || doc.folder) return;

    this.groupRules[id] = {
      all_layouts: doc.all_layouts || 0,
      all_devctl: doc.all_devctl || 0,
      all_pmparts: doc.all_pmparts || 0,
      pm_readwrite: doc.pm_readwrite || 0,
      layouts: formSet(doc.layouts, 'layout'),
      devctl: formDevctlArray(doc.devctl),
      pmparts: formSet(doc.pmparts, 'part')
    };
  }

  addDef() {
    const defGrp = 'ihadmgrp';
    this.addGroupRules(accessutil.createNewGroupDoc(defGrp));
    this.userGroups.ihadmin = new Set([defGrp]);
  }

  /** isLayoutAvailable
   *
   * @param {String} layId - id экрана
   * @param {String} userId - id пользователя
   * @return {Boolean} =true, если доступ к экрану разрешен
   */
  isLayoutAvailable(layId, userId) {
    // Если пользователя нет в списке - значит, он не входит ни в одну группу
    if (!this.userGroups[userId]) return;

    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_layouts) return true;
        if (this.groupRules[group].layouts.has(layId)) return true;
      }
    }
  }

  getPMAccessLevel(userId) {
    // console.log('getPMAccessLevel userId='+userId+' this.userGroups='+util.inspect(this.userGroups))

    if (!this.userGroups[userId]) return 0;
    let res = 0;
    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_pmparts > res) res = this.groupRules[group].all_pmparts;
        if (res == 2) return 2;
      }
    }
    return res;
  }

  isPMAvailable(userId) {
    if (!this.userGroups[userId]) return;

    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_pmparts) return true;
      }
    }
  }

  isPMQueryAllowed(query, userId) {
    if (!this.userGroups[userId]) return;

    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_pmparts == 2) return true; // Полный доступ
        if (this.groupRules[group].all_pmparts == 1) {
          // Частичный доступ - проверка, что раздел доступен
          if (this.isPMPartAllowed(query, group)) return true;
        }
      }
    }
  }

  isPMPartAllowed(query, group) {
    if (query.type != 'tree') return true;

    const pmparts = this.groupRules[group].pmparts;
    // Проверить, какие узлы дерева доступны
    if (pmparts.has(query.id)) return true;
  }

  getUserPMParts(userId) {
    const level = this.getPMAccessLevel(userId);
    if (!level) return {}; // ничего
    if (level == 2) return { all_pmparts: 2 }; // все

    // Собрать все что есть в группах в общий set
    const pmparts = new Set();
    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_pmparts == 1 && this.groupRules[group].pmparts) {
          this.groupRules[group].pmparts.forEach(part => {
            pmparts.add(part);
          });
        }
      }
    }
    return { pmparts };
  }

  hasUserPMWritePermission(userId) {
    if (!this.userGroups[userId]) return;

    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_pmparts == 2) return true; // Полный доступ
        if (this.groupRules[group].all_pmparts == 1 && this.groupRules[group].pm_readwrite) return true;
      }
    }
  }

  /** getUserDevctlRules
   *
   * @param {*} userId
   * @return {Object} - возвращает правила управления устройствами для пользователя
   *                    {all_devctl:1} - разрешено управление всеми устр-вами
   *                    {all_devctl:0, devctl:[{place1,tag1},{place},{place2,tag2}]}
   *
   *                    если пользователь входит в несколько групп - массив содержит объединение
   */
  getUserDevctlRules(userId) {
    if (!this.userGroups[userId]) return {};

    // Найти полное разрешение
    const devctl = [];
    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_devctl) return { all_devctl: 1 };

        // Нужно идти по всем правилам
        this.groupRules[group].devctl.forEach(item => devctl.push(item));
      }
    }
    return devctl.length ? { devctl } : {};
  }
}

module.exports = new Accessmanager();

function formSet(inobj, idName) {
  const res = new Set();
  if (inobj && Object.keys(inobj).length) {
    Object.keys(inobj).forEach(key => {
      if (inobj[key] && inobj[key][idName]) res.add(inobj[key][idName]);
    });
  }
  return res;
}

function formDevctlArray(inobj) {
  const res = [];
  if (inobj && Object.keys(inobj).length) {
    Object.keys(inobj).forEach(key => {
      const place = inobj[key].place && inobj[key].place != '-' ? inobj[key].place : '';
      const tag = inobj[key].tag && inobj[key].tag != '-' ? inobj[key].tag : '';

      if (place || tag) res.push({ place, tag });
    });
  }
  return res;
}
