/**
 * accessutil.js
 */

const util = require('util');

const appconfig = require('../appconfig');
const liststore = require('../dbs/liststore');

const USER_ADMIN_ID = 'admin';
const GROUP_ADMIN_ID = 'admgrp';

/**  reviseUserGroups
 * Запускается на старте
 *
 *  1. Если таблица user пуста, т е нет ни одного пользователя (на старте, удалена папка private)
 *    - создается пользователь admin в группе admgrp
 *  2. Если таблица agroup_tab пуста (переходный этап от role к agroup)
 *    - Пользователей с role (admin, user,guest_user) включить в их группу
 *      (создать группы admgrp, usrgrp, gstgrp, если их нет)
 *  3. Убедиться, что есть хотя бы 1 группа с адм правами и хотя бы 1 пользователь входит в эту группу
 *     (возможно при некорректной работе с группами,
 *      т е если нет возможности входа в PM, то выход - перезагрузить сервер и войти со стандартным админом)
 *
 *
 * При необходимости создает записи в user, agroups, agroup_tab
 *
 */
async function reviseUserGroups(dm) {
  try {
  await upsertAdminGroupDoc(dm); // Группа админская д б всегда

  // Пользователи
  const userDocs = (await dm.get('user')).filter(doc => !doc.folder);

  if (!userDocs.length) {
    // 1. Нет ни одного пользователя Первый запуск или сброс
    await insertUserAdminDoc(dm);
    await dm.dbstore.removeAll('agroup_tab'); // agroup_tab - очистить - на всякий случай?
    await includeUserToGroup({ userId: USER_ADMIN_ID, groupId: GROUP_ADMIN_ID }, dm);
    return;
  }

  const tabDocs = await dm.get('agroup_tab');
  if (!tabDocs.length) {
    // 2. Пользователи есть, но нет привязок к группам - переход от role
    await includeUsersToGroupByRole(userDocs, dm);
  }

  // 3. Должен быть хоть один админ
  return needAtLeastOneAdmin(userDocs, dm);
} catch (e) {
  console.log('ERROR: reviseUserGroups '+util.inspect(e))
}
}

async function needAtLeastOneAdmin(userDocs, dm) {
  // Группы
  const groupSet = new Set(); // Список всех групп
  const adminSet = new Set(); // Группы с админскими правами
  (await dm.get('agroups')).forEach(doc => {
    groupSet.add(doc._id);
    if (doc.all_pmparts) adminSet.add(doc._id);
  });

  // Группы, в которые входят пользователи
  const userGroups = {}; // {userId:new Set([grp001,grp003]) }
  (await dm.get('agroup_tab')).forEach(doc => {
    if (doc.userId && doc.groupId && groupSet.has(doc.groupId)) {
      addUserGroup(doc.userId, doc.groupId);
    }
  });

  if (!existsAtLeastOneAdmin()) {
    // 3. Нет ни одного пользователя с админскими правами
    if (!userDocs.find(doc => doc._id == USER_ADMIN_ID)) {
      await dm.insertDocs('user', [createNewUserAsAdmin(USER_ADMIN_ID)]);
      console.log('WARN: Add user "' + USER_ADMIN_ID + '" with group "admgrp"');
    }

    // Добавляем его в группу, если не включен
    if (!userGroups[USER_ADMIN_ID] || !userGroups[USER_ADMIN_ID].has(GROUP_ADMIN_ID)) {
      includeUserToGroup({ userId: USER_ADMIN_ID, groupId: GROUP_ADMIN_ID }, dm);
    }
  }

  function addUserGroup(userId, groupId) {
    if (!userGroups[userId]) userGroups[userId] = new Set();
    userGroups[userId].add(groupId);
  }

  function existsAtLeastOneAdmin() {
    if (!adminSet.size) return; // Нет ни одной группы с админскими правами - ТАКОГО БЫТЬ НЕ ДОЛЖНО!!

    for (const doc of userDocs) {
      if (!userGroups[doc._id]) continue; // нет групп
      userGroups[doc._id].forEach(ugroup => {
        if (adminSet.has(ugroup)) return true;
      });
    }
  }
}

async function includeUsersToGroupByRole(userDocs, dm) {
  // 2. Пользователи есть, связок с группами нет - переход от role
  const toAddAgroup = [];
  const toAddAgroup_tab = [];

  // Группы
  const groupSet = new Set();
  (await dm.get('agroups')).forEach(doc => groupSet.add(doc._id));

  for (const doc of userDocs) {
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

  function getGroupId(doc) {
    const groupId = getGrpForRole(doc.role);

    if (!groupSet.has(groupId)) {
      toAddAgroup.push(createNewGroupDoc(groupId));
    }
    return groupId;
  }
}

/** upsertAdminGroupDoc
 * Если нет группы админов - создать, иначе убедиться, что есть полный доступ
 * @param {*} dm
 */
async function upsertAdminGroupDoc(dm) {
  let adminGroupDoc = await dm.findOne('agroups', { _id: GROUP_ADMIN_ID });
  console.log('upsertAdminGroupDoc adminGroupDoc='+util.inspect(adminGroupDoc))
  if (!adminGroupDoc) {
    await dm.insertDocs('agroups', [createNewGroupDoc(GROUP_ADMIN_ID)]);
  } else if (adminGroupDoc.all_pmparts != 2) {
    await dm.dbstore.update('agroups', { _id: GROUP_ADMIN_ID }, { $set: { all_pmparts: 2 } });
    console.log('WARN: Update access to PM for group:"' + GROUP_ADMIN_ID + '" - FULL ACCESS.');
  }
}

async function insertUserAdminDoc(dm) {
  await dm.insertDocs('user', [createNewUserAsAdmin(USER_ADMIN_ID)]);
}

async function includeUserToGroup({ userId, groupId }, dm) {
  await dm.insertDocs('agroup_tab', [{ userId, groupId }]);
}

function createNewUserAsAdmin(_id) {
  return {
    _id,
    login: 'admin',
    name: 'Admin',
    parent: 'usergroup',
    expert: 1,
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
