/**
 * cdo.js
 *   Collection Description Object
 *   Каждый элемент описывает коллекцию db (nedb | MongoDB)
 *   Возможно, здесь будут схемы и валидация
 */

module.exports = {
  lists: {
    folder: 'jbasepath',
    validator: {
      required: ['name', 'list', 'order'],
      properties: {
        name: {
          type: 'string',
          empty:false,
          description: 'must be not empty string'
        },
        list: {
          type: 'string',
          empty:false,
          description: 'must be not empty string'
        },
        order: {
          type: 'number',
          description: 'must be a number'
        }
      }
    }
  },

  devices: {
    folder: 'jbasepath'
  },
  deviceprops: {
    folder: 'jbasepath'
  },
  types: {
    folder: 'jbasepath'
  },
  typeprops: {
    folder: 'jbasepath'
  },
  layouts: {
    folder: 'jbasepath'
  },
  scripts: {
    folder: 'jbasepath'
  },
  users: {
    folder: 'privatepath'
  },
  tokens: {
    folder: 'privatepath'
  }
};
