/**
 *  accessmanager.js
 *
 *  Объект для организации правил доступа
 *  Обеспечивает
 *
 */

const util = require('util');

class Accessmanager {
  async start(dm) {
    this.dm = dm;

    // Группы, в которые входит пользователь
    this.userGroups = {}; // {userId:new Set([grp001,grp003]) }
    (await dm.get('agroup_tab')).forEach(doc => this.addUserGroup(doc));

    // Правила для каждой группы
    this.groupRules = {}; // {groupId:{all_layouts: 1, all_devctl: 1,all_pmparts: 2, layouts: Set[], devctl: Set[]}
    (await dm.get('agroups')).forEach(doc => this.addGroupRules(doc));

    // Группы для устройств
  }

  // Пользователь - группа
  addUserGroup(doc) {
    const { groupId, userId } = doc;
    if (!groupId || !userId) return;

    if (!this.userGroups[userId]) this.userGroups[userId] = new Set();
    this.userGroups[userId].add(groupId);
    // console.log('After ADD: ' + util.inspect(this.userGroups));
  }

  removeUserGroup(doc) {
    const { groupId, userId } = doc;
    if (!groupId || !userId || !this.userGroups[userId]) return;

    this.userGroups[userId].delete(groupId);
    console.log('After REMOVE: ' + util.inspect(this.userGroups));
  }

  // Правила группы
  addGroupRules(doc) {
    console.log('ADD GroupRules: doc=' + util.inspect(doc));
    const id = doc._id;
    if (!id || doc.folder) return;

    this.groupRules[id] = {
      all_layouts: doc.all_layouts || 0,
      all_devctl: doc.all_devctl || 0,
      all_pmparts: doc.all_devctl || 0,
      layouts: formSet(doc.layouts, 'layout'),
      devctl: formDevctlArray(doc.devctl)
    };
    console.log('After ADD group: ' + util.inspect(this.groupRules, null, 4));
  }

  /** isLayoutAvailable
   * 
   * @param {String} layId - id экрана
   * @param {String} userId - id пользователя
   * @return {Boolean} =true, если доступ к экрану разрешен
   */
  isLayoutAvailable(layId, userId) {
    // return true;

    if (!this.userGroups[userId]) {
      // Если пользователя нет в списке - значит, он не входит ни в одну группу
      // console.log('ERROR: accessmanager: User '+userId)
      return;
    }

    for (const group of this.userGroups[userId]) {
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_layouts) return true;
        if (this.groupRules[group].layouts.has(layId)) return true;
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
    if (!this.userGroups[userId]) {
      // Если пользователя нет в списке - значит, он не входит ни в одну группу
      // console.log('ERROR: accessmanager: User '+userId)
      return {};
    }

    // Найти полное разрешение
    const devctl = [];
    for (const group of this.userGroups[userId]) {
      // console.log('group=' + group + ' this.layoutGroups[layId]=' + util.inspect(this.layoutGroups[layId]));
      if (this.groupRules[group]) {
        if (this.groupRules[group].all_devctl) return  {all_devctl:1};

         // Нужно идти по всем правилам
        this.groupRules[group].devctl.forEach(item => devctl.push(item));
      }
    }
    return devctl.length ? {devctl} : {};
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

      if (place || tag) res.push({place, tag});
    });
  }
  return res;
}
