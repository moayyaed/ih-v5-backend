/**
 * cdo.js
 *   Collection Description Object
 *   Каждый элемент описывает коллекцию db (nedb | MongoDB)
 *   Возможно, здесь будут схемы
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
  types: {
    folder: 'jbasepath'
  },
  users: {
    folder: 'privatepath'
  },
  tokens: {
    folder: 'privatepath'
  }
};
