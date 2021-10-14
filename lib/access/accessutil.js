/**
 * accessutil.js
 */

// const util = require('util');

const appconfig = require('../appconfig');
const liststore = require('../dbs/liststore');

/**  reviseUserGroups
 * Проверяет, что
 *  1. Есть хотя бы 1 группа с адм правами и хотя бы 1 пользователь входит в эту группу
 *     (актуально при старте нового проекта)
 *     По умолчанию создается group:'admgrp', user:'admin'
 *
 *  2. Пользователи с role включены в какую-то группу
 *   (role - работало до 5.5.105 - переходный этап)
 *
 * Добавляет пользователей в группы, при необходимости создает группы:
 *  admgrp - role=admin (эта группа должна быть, она requiredRecords для agroups)
 *  usrgrp - role=user, role=guest_admin - полный доступ к UI, нет доступа к PM
 *  gstgrp - role=guest_user - доступ к UI - только прросмотр, нет доступа к PM
 *
 * При необходимости создает записи в agroups, agroup_tab
 *
 */
async function reviseUserGroups(dm) {
  const groupSet = new Set(); // Список всех групп
  const adminSet = new Set(); // Группы с админскими правами

  (await dm.get('agroups')).forEach(doc => {
    groupSet.add(doc._id);
    if (doc.all_pmparts) adminSet.add(doc._id);
  });

  const userDocs = (await dm.get('user')).filter(doc => !doc.folder); // Пользователи

  // Группы, в которые входят пользователи
  const userGroups = {}; // {userId:new Set([grp001,grp003]) }
  (await dm.get('agroup_tab')).forEach(doc => {
    if (doc.userId && doc.groupId && groupSet.has(doc.groupId)) {
      addUserGroup(doc.userId, doc.groupId);
    }
  });

  const toAddAgroup = [];
  const toAddAgroup_tab = [];

  // 1. Убедиться, что есть ХОТЬ ОДИН пользователь с админскими правами
  if (!existsAtLeastOneAdmin()) {
    if (!adminSet.size) {
      if (!groupSet.has('admgrp')) {
        // Добавляем группу admgrp
        toAddAgroup.push(createNewGroupDoc('admgrp'));
        groupSet.add('admgrp');
      } else {
        // редактировать запись
        await dm.dbstore.update('agroups', { _id: 'admgrp' }, { $set: { all_pmparts: 2 } });
        console.log('WARN: Update access to PM for group:"admgrp" - FULL ACCESS.');
      }
      adminSet.add('admgrp');
    }

    // Добавить пользователя с админскими правами
    const userAdminId = 'admin';
    if (!userDocs.find(doc => doc._id == userAdminId)) {
      await dm.insertDocs('user', [createNewUserAsAdmin(userAdminId)]);
      console.log('WARN: Add user "' + userAdminId + '" with group "admgrp"');
    }

    // Добавляем его в группу, если не включен
    if (!userGroups[userAdminId] || !userGroups[userAdminId].has('admgrp')) {
      toAddAgroup_tab.push({ userId: userAdminId, groupId: 'admgrp' });
      addUserGroup(userAdminId, 'admgrp');
    }
  }

  // 2. Проверить, что пользователь входит хоть в какую-то группу
  // Если нет, то при наличии role - включить в группу на основе role
  for (const doc of userDocs) {
    if (userGroups[doc._id]) continue; // Пользователь включен в группу

    let mess = 'No group for user: ' + doc._id;
    if (doc.role) {
      const groupId = getGroupId(doc);
      if (groupId) {
        toAddAgroup_tab.push({ groupId, userId: doc._id });
        mess += '. Role: ' + doc.role + '. Included into group: ' + groupId;
      }
    }
    console.log('WARN: ' + mess);
  }

  if (toAddAgroup.length) {
    await dm.insertDocs('agroups', toAddAgroup);
  }

  if (toAddAgroup_tab.length) {
    await dm.insertDocs('agroup_tab', toAddAgroup_tab);
  }

  function addUserGroup(userId, groupId) {
    if (!userGroups[userId]) userGroups[userId] = new Set();
    userGroups[userId].add(groupId);
  }

  function existsAtLeastOneAdmin() {
    if (!adminSet.size) return; // Нет ни одной группы с админскими правами

    for (const doc of userDocs) {
      if (!userGroups[doc._id]) continue; // нет групп
      userGroups[doc._id].forEach(ugroup => {
        if (adminSet.has(ugroup)) return true;
      });
    }
  }

  function getGroupId(doc) {
    const groupId = getGrpForRole(doc.role);

    if (!groupSet.has(groupId)) {
      // Группы нет - нужно создать новую
      toAddAgroup.push(createNewGroupDoc(groupId));
    }
    return groupId;
  }
}

function createNewUserAsAdmin(_id) {
  return {
    _id,
    login: 'admin',
    name: 'Admin',
    parent: 'usergroup',
    pwd: '202020',
    order: 10
  };
}

function createNewGroupDoc(groupId) {
  const doc = {
    _id: groupId,
    parent: 'agroupsgroup',
    name: appconfig.getMessage(groupId),
    all_layouts: 1,
    all_devctl: 0,
    all_pmparts: 0,
    layouts: {},
    devctl: {},
    pmparts: {}
  };

  switch (groupId) {
    case 'ihadmgrp':
    case 'admgrp':
      doc.all_devctl = 1;
      doc.all_pmparts = 2;
      break;
    case 'usrgrp':
      doc.all_devctl = 1;
      doc.all_pmparts = 0;
      break;
    default:
  }
  return doc;
}

function getGrpForRole(role) {
  switch (role) {
    case 'admin':
      return 'admgrp';
    case 'guest_admin':
      return 'usrgrp';
    case 'user':
      return 'usrgrp';
    case 'guest_user':
      return 'gstgrp';
    default:
  }
}

/** checkAgroupTabRecord
 * Проверка при добавлении или изменении записи в таблицу agroup_tab
 *
 * @param {Object} indoc - {groupId, userId} || {$set:{groupId:'xxx'}, _id,userId,groupId  }
 * @param {Object} dm
 *
 * @throw  {message: <сообщение об ошибке>}
 * - не должно быть дублирования
 * - groupId, userId не должны быть пустые
 */
async function checkAgroupTabRecord(indoc, dm) {
  // console.log('checkAgroupTabRecord indoc=' + util.inspect(indoc));
  const { groupId, userId } = indoc;

  if (!indoc._id) {
    // Добавление
    checkNotEmpty(groupId, appconfig.getMessage('NoGroupSelected'));
    checkNotEmpty(userId, appconfig.getMessage('NoUserSelected'));
    await checkDup({ groupId, userId });
    return;
  }

  // Это изменение
  if (!indoc.$set) return;

  let filter;
  if (indoc.$set.groupId != undefined && indoc.$set.groupId != indoc.groupId) {
    // Проверить, что новое значение не пустое
    checkNotEmpty(indoc.$set.groupId, appconfig.getMessage('NoGroupSelected'));
    filter = { groupId: indoc.$set.groupId, userId: indoc.userId };
  } else if (indoc.$set.userId != undefined && indoc.$set.userId != indoc.userId) {
    checkNotEmpty(indoc.$set.userId, appconfig.getMessage('NoUserSelected'));
    filter = { groupId: indoc.groupId, userId: indoc.$set.userId };
  }
  // Проверить, что новое значение не дублирует
  if (filter) await checkDup(filter);

  function checkNotEmpty(xId, message) {
    // Может и так: userId: { id: '-', title: '-' }
    if (!xId || xId == '-' || typeof xId == 'object') throw { message };
  }

  async function checkDup(fObj) {
    const doc = await dm.findOne('agroup_tab', fObj, { fields: { _id: 1 } });
    if (doc) {
      const gStr = appconfig.getMessage('group') + ' ' + liststore.getTitleFromList('agroupList', groupId);
      const uStr = appconfig.getMessage('user') + ' ' + liststore.getTitleFromList('userList', userId);
      throw { message: appconfig.getMessage('RecordDup') + ': ' + gStr + ', ' + uStr };
    }
  }
}

module.exports = {
  reviseUserGroups,
  checkAgroupTabRecord,
  createNewGroupDoc
};
