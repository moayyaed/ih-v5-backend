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
    devices: ['devicesByPlace', 'typesByGroup'],

    devicesByPlace: {
      branch: { table: 'place', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } },
      leaf: { table: 'device', propmap: { _id: 'id', name: 'title', place: 'parent', order: 'order' } },
      options: {
        tabs: [
          { id: 'DeviceCommon', title: 'Свойства', component: 'form' },
          { id: 'DeviceChannels', title: 'Каналы', component: 'form' },
          { id: 'DeviceDbProps', title: 'БД', component: 'form' }
        ],
        default: 'DeviceCommon'
      }
      // leaf: { table: 'device', propmap: { _id: 'id', name: 'title', place: 'parent', order: 'order'}, propext: { component: 'table' } }
    },
    typesByGroup: {
      branch: { table: 'typegroup', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } },
      leaf: { table: 'type', propmap: { _id: 'id', name: 'title', tgroup: 'parent' } },
      options: {
        tabs: [
          { id: 'typeCommon', title: 'Свойства типа', component: 'form' },
          { id: 'typeDefaults', title: 'Дефолтные значения', component: 'form' }
        ],
        default: ''
      }

      // leaf: { table: 'type', propmap: { _id: 'id', name: 'title', tgroup: 'parent' }, propext: { component: 'table' } }
    },

    visualization: {
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
