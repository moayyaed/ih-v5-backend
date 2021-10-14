/**
 * accessmate.js
 *
 */

// const util = require('util');

class Accessmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {

    // Добавлена новая группа 
    this.dm.on('inserted:agroups', docs => {
      this.updateGroupRules(docs);
    });

    // Изменены правила группы
    this.dm.on('updated:agroups', docs => {
      this.updateGroupRules(docs)
    });

    // Удаление группы отрабатывается в beforeRemove - генерируется событие before_remove:agroup_tab 
    // this.dm.on('removed:agroups', docs => {
     

    /**
     * Правила группы для экранов
     *   collection: agroups
     *   table: agrouplayoutsTable
     *   doc: { _id: 'grp004', layouts:{ LMD4UKD7J:{layout:'l022'}, ...}}
     *   При любой операции генерируется событие updated, так как это строки в agroups.layouts
     *   Добавляем заново все правила для группы
     */
    this.dm.on('updated:agrouplayoutsTable', async docs => {
      this.updateGroupRules(docs);
    });

    /**
     * Правила группы для управления устройствами
     *   collection: agroups
     *   table: agroupdevctlTable
     *   doc: { _id: 'grp004', layouts:{..}, devctl:{ LMD4UKD7J:{place:'dg003', 'tag':'свет'}, ...}}
     */
    this.dm.on('updated:agroupdevctlTable', async docs => {
      this.updateGroupRules(docs);
    });

    /**
     * Вхождение пользователя в группу
     * Таблицы agroup_byuser, agroup_bygroup
     *   collection: agroup_tab   {_id, groupId, userId}
     */
    this.dm.on('inserted:agroup_byuser', docs => {
      docs.forEach(doc => this.engine.addUserGroup(doc));
    });

    this.dm.on('inserted:agroup_bygroup', docs => {
      docs.forEach(doc => this.engine.addUserGroup(doc));
    });

    // Изменено вхождение
    // Добавляем новое - старое вхождение уже удалено в before_update:agroup_tab
    this.dm.on('updated:agroup_byuser', docs => {
      docs.forEach(doc => this.engine.addUserGroup(doc));
    });

    this.dm.on('updated:agroup_bygroup', docs => {
      docs.forEach(doc => this.engine.addUserGroup(doc));
    });

    this.dm.on('before_update:agroup_tab', async docs => {
      this.removeUserGroups(docs);
    });

    this.dm.on('before_remove:agroup_tab', async docs => {
      this.removeUserGroups(docs);
    });
  }

  async removeUserGroups(docs) {
    for (const doc of docs) {
      const oldDoc = await this.dm.findRecordById('agroup_tab', doc._id);
      if (oldDoc) this.engine.removeUserGroup(oldDoc);
    }
  }

  async updateGroupRules(docs) {
    for (const doc of docs) {
      const updoc = await this.dm.findRecordById('agroups', doc._id);
      if (updoc) this.engine.addGroupRules(updoc);
    }
  }
}

module.exports = Accessmate;
