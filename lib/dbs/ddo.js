/**
 * Data Description Object
 * For dyndata
 */

module.exports = {
  menu: {
    pmmenu: {
      store: 'system',
      folder: 'sysbase',
      file: 'pmmenu'
    }
  },
  table: {
    level: {
      store: 'db',
      folder: 'jbase',
      collection: 'lists',
      filter: { list: 'level' }
    },
    device: {
      store: 'db',
      folder: 'jbase',
      collection: 'devices'
    },

    tgroup: {
      store: 'db',
      folder: 'jbase',
      collection: 'lists',
      filter: { list: 'tgroup' }
    },
    type: {
      store: 'db',
      folder: 'jbase',
      collection: 'types'
    },
    user: {
      store: 'db',
      folder: 'jbase',
      collection: 'users'
    },
    token: {
      store: 'db',
      folder: 'jbase',
      collection: 'tokens'
    }
  },
  tree: {
    devices: ['devicesByLevel', 'typesByTgroup'],
    devicesByLevel: {
      branch: { table: 'level', propmap: { _id: 'id', name: 'title', parent: 'parent' } },
      leaf: { table: 'device', propmap: { _id: 'id', name: 'title', level: 'parent' }, propext: { component: 'table' } }
    },
    typesByTgroup: {
      branch: { table: 'tgroup', propmap: { _id: 'id', name: 'title', parent: 'parent' } },
      leaf: { table: 'type', propmap: { _id: 'id', name: 'title', tgroup: 'parent' }, propext: { component: 'table' } }
    }
  }
};
