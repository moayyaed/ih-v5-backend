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
    place: {
      store: 'db',
      collection: 'lists',
      filter: { list: 'place' }
    },
    device: {
      store: 'db',
      collection: 'devices'
    },

    tgroup: {
      store: 'db',
      collection: 'tgroup',
      filter: { list: 'tgroup' }
    },
    type: {
      store: 'db',
      collection: 'types'
    },
    user: {
      store: 'db',
      collection: 'users'
    },
    token: {
      store: 'db',
      collection: 'tokens'
    }
  },
  tree: {
    devices: ['devicesByPlace', 'typesByGroup'],
    devicesByPlace: {
      branch: { table: 'place', propmap: { _id: 'id', name: 'title', parent: 'parent', order:'order', slug:'slug' } },
      leaf: { table: 'device', propmap: { _id: 'id', name: 'title', level: 'parent' }, propext: { component: 'table' } }
    },
    typesByTgroup: {
      branch: { table: 'typegroup', propmap: { _id: 'id', name: 'title', parent: 'parent' } },
      leaf: { table: 'type', propmap: { _id: 'id', name: 'title', tgroup: 'parent' }, propext: { component: 'table' } }
    }
  }
};
