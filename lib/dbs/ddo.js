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
    types: {
      store: 'db',
      folder: 'jbase',
      collection: 'types'
    },
    users: {
      store: 'db',
      folder: 'jbase',
      collection: 'users'
    },
    tokens: {
      store: 'db',
      folder: 'jbase',
      collection: 'tokens'
    }
  },
  tree: {
    devices: ['devicesByLevel', 'typesByTgroup'],
    devicesByLevel: {
      b_table: 'level',
      l_table: 'device'
    },
    typesByTgroup: {
      b_table: 'tgroup',
      l_table: 'types'
    }
  }
};
