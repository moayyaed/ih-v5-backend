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
      filter: { list: 'place' },
      defRootTitle: 'Все'
    },
    device: {
      store: 'db',
      collection: 'devices'
    },

    typegroup: {
      store: 'db',
      collection: 'lists',
      filter: { list: 'typegroup' },
      defRootTitle: 'Типы'
    },
    type: {
      store: 'db',
      collection: 'types'
    },
    layoutgroup: {
      store: 'db',
      collection: 'lists',
      filter: { list: 'layoutgroup' },
      defRootTitle: 'Экраны'
    },
    layout: {
      store: 'db',
      collection: 'layouts'
    },
    scriptgroup: {
      store: 'db',
      collection: 'lists',
      filter: { list: 'scriptgroup' },
      defRootTitle: 'Сценарии'
    },
    script: {
      store: 'db',
      collection: 'scripts'
    },
    datasourcegroup: {
      store: 'db',
      collection: 'lists',
      filter: { list: 'datasourcegroup' }
    },
    datasource: {
      store: 'db',
      collection: 'datasources'
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
    dev: ['devices', 'types'],

    devices: {
      branch: { table: 'place', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } },
      leaf: { table: 'device', propmap: { _id: 'id', name: 'title', place: 'parent', order: 'order' } }

      // leaf: { table: 'device', propmap: { _id: 'id', name: 'title', place: 'parent', order: 'order'}, propext: { component: 'table' } }
    },
    types: {
      branch: { table: 'typegroup', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } },
      leaf: { table: 'type', propmap: { _id: 'id', name: 'title', tgroup: 'parent' } }

      // leaf: { table: 'type', propmap: { _id: 'id', name: 'title', tgroup: 'parent' }, propext: { component: 'table' } }
    },

    vis: {
      branch: { table: 'layoutgroup', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } },
      leaf: { table: 'layout', propmap: { _id: 'id', name: 'title', level: 'parent' }, propext: { component: 'table' } }
    },

    scripts: {
      branch: { table: 'scriptgroup', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } },
      leaf: { table: 'script', propmap: { _id: 'id', name: 'title', level: 'parent' }, propext: { component: 'table' } }
    },

    datasource: {
      branch: { table: 'datasourcegroup', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } },
      leaf: {
        table: 'datasource',
        propmap: { _id: 'id', name: 'title', level: 'parent' },
        propext: { component: 'table' }
      }
    }
  }
};
