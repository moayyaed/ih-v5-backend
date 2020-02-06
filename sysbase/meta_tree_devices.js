module.exports = {
  common: {
    popup: {
      main: [
        { id: '1', type: 'divider', title: 'Edit' },
        { id: '2', type: 'item', icon: 'cut', text: 'Cut', label: '⌘X' },
        { id: '3', type: 'item', icon: 'duplicate', text: 'Copy', label: '⌘C' },
        { id: '4', type: 'item', icon: 'clipboard', text: 'Paste', label: '⌘V', disabled: true },
        { id: '5', type: 'divider', title: 'Text' },
        { id: '6', type: 'items', childs: 'aligment', disabled: true, icon: 'align-left', text: 'Alignment' },
        { id: '7', type: 'items', childs: 'style', icon: 'style', text: 'Style' },
        { id: '8', type: 'items', childs: 'miscellaneous', icon: 'asterisk', text: 'Miscellaneous' }
      ],
      aligment: [
        { id: '9', type: 'item', icon: 'align-left', text: 'Left' },
        { id: '10', type: 'item', icon: 'align-center', text: 'Center' },
        { id: '11', type: 'item', icon: 'align-right', text: 'Right' },
        { id: '12', type: 'item', icon: 'align-justify', text: 'Justify' }
      ],
      style: [
        { id: '13', type: 'item', icon: 'bold', text: 'Bold' },
        { id: '14', type: 'item', icon: 'italic', text: 'Italic' },
        { id: '15', type: 'item', icon: 'underline', text: 'Underline' }
      ],
      miscellaneous: [
        { id: '16', type: 'item', icon: 'badge', text: 'Badge' },
        { id: '17', type: 'item', icon: 'book', text: 'Long items will truncate when they reach max-width' },
        { id: '18', type: 'items', childs: 'other', icon: 'more', text: 'Look in here for even more items' }
      ],
      other: [
        { id: '19', type: 'item', icon: 'briefcase', text: 'Briefcase' },
        { id: '20', type: 'item', icon: 'calculator', text: 'Calculator' },
        { id: '21', type: 'item', icon: 'dollar', text: 'Dollar' },
        { id: '22', type: 'items', childs: 'shapes', icon: 'dot', text: 'Shapes' }
      ],
      shapes: [{ id: '23', type: 'item', icon: 'full-circle', text: 'Full circle' }]
    }
  },
  devicesByPlace: {
    popup: {
      main: [
        { id: '1', type: 'divider', title: 'Add place' },
        { id: '2', type: 'item', title: 'Add device' },
        { id: '3', type: 'item', icon: 'duplicate', text: 'Duplicate', label: '⌘A' },
        { id: '4', type: 'item', icon: 'clipboard', text: 'Rename', label: '⌘R' },
        { id: '5', type: 'item', text: 'Move', label: '⌘M' },
        { id: '6', type: 'item', text: 'Delete', label: '⌘D' }
      ]
    }
  },

  typesByGroup: {
    popup: {
      main: [
        { id: '1', type: 'divider', title: 'Edit' },
        { id: '2', type: 'item', icon: 'cut', text: 'Cut', label: '⌘X' },
        { id: '3', type: 'item', icon: 'duplicate', text: 'Copy', label: '⌘C' },
        { id: '4', type: 'item', icon: 'clipboard', text: 'Paste', label: '⌘V', disabled: true }
      ]
    }
  }
};
