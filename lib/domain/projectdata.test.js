/* eslint-disable */
const util = require('util');

const expect = require('expect');
const sinon = require('sinon');

const dm = require('../datamanager');
const hut = require('../utils/hut');
const deepEqual = require('../utils/deepEqual');

let dm_getCachedData;
let dm_findRecordById;

// const hut = require('./hut');
// const deepEqual = require('./deepEqual');

const test = require('./projectdata');

describe('domain/projectdata', () => {
  before(() => {
    sandbox = sinon.createSandbox();
    dm_getCachedData = sandbox.stub(dm, 'getCachedData');
    dm_findRecordById = sandbox.stub(dm, 'findRecordById');
  });
  after(() => {
    sandbox.restore();
  });

  describe('getUpObj', () => {
    it('input has template with links', async () => {
      dm_getCachedData.resolves({
        data: {
          list: ['image_1', 'text_1', 'template_1', 'template_2', 'template_3', 'template_4', 'button_1'],
          elements: {
            template_2: {
              animation: {},

              type: 'template',
              templateId: 'vt002',
              title: 'Светильник',

              links: {
                state1: {
                  did: 'd0006',
                  prop: 'state',
                  title: 'H102 ▪︎ Светильник ▪︎ state',
                  value: {
                    did: 'd0006',
                    prop: 'state'
                  }
                },
                state3: {
                  did: 'd0006',
                  prop: 'auto',
                  title: 'H102 ▪︎ Светильник ▪︎ auto',
                  value: {
                    did: 'd0006',
                    prop: 'auto'
                  }
                }
              }
            }
          }
        }
      });

      const res = await test.getUpPobj('container', 'vc001');
      console.log('res=' + util.inspect(res, null, 4));
      // {d0006: {state: [ { el: 'template_2', varname: 'state1' } ], auto: [ { el: 'template_2', varname: 'state3' } ]}
      expect(typeof res).toEqual('object');
      expect(typeof res.d0006).toEqual('object');
      expect(typeof res.d0006.state).toEqual('object');
      expect(typeof res.d0006.auto).toEqual('object');
    });

    it('input has template with two dev links and actions (command=device - not taken)', async () => {
      dm_getCachedData.resolves({
        data: {
          list: ['image_1', 'text_1', 'template_1', 'template_2', 'template_3', 'template_4', 'button_1'],
          elements: {
            template_2: {
              animation: {},

              type: 'template',
              templateId: 'vt002',
              title: 'Светильник',

              actions: {
                type: 'multi',
                action_1: {
                  right: [],
                  left: [
                    {
                      action: 'singleClickLeft',
                      value: {},
                      prop: 'toggle',
                      command: 'device',
                      did: 'd0006',
                      title: 'H102 ▪︎ Светильник ▪︎ toggle'
                    },
                    {
                      action: 'longClickLeft',
                      value: {}
                    }
                  ]
                }
              },
              links: {
                state1: {
                  did: 'd0006',
                  prop: 'state',
                  title: 'H102 ▪︎ Светильник ▪︎ state',
                  value: {
                    did: 'd0006',
                    prop: 'state'
                  }
                },
                state3: {
                  did: 'd0003',
                  prop: 'auto',
                  title: 'H103 ▪︎ Светильник ▪︎ auto',
                  value: {
                    did: 'd0003',
                    prop: 'auto'
                  }
                }
              }
            }
          }
        }
      });

      const res = await test.getUpPobj('container', 'vc001');
      console.log('res=' + util.inspect(res, null, 4));
      // {d0006: {state: [ { el: 'template_2', varname: 'state1' } ]},
      // d0003: { auto: [ { el: 'template_2', varname: 'state3' } ] }
      expect(typeof res).toEqual('object');
      expect(typeof res.d0003).toEqual('object');
      expect(typeof res.d0006).toEqual('object');
      expect(typeof res.d0006.state).toEqual('object');
      expect(typeof res.d0003.auto).toEqual('object');
    });

    it('input has template with dev links and actions (command=setval)', async () => {
      dm_getCachedData.resolves({
        data: {
          list: ['image_1', 'text_1', 'template_1', 'template_2', 'template_3', 'template_4', 'button_1'],
          elements: {
            template_2: {
              animation: {},

              type: 'template',
              templateId: 'vt002',
              title: 'Светильник',

              actions: {
                type: 'multi',
                action_1: {
                  right: [],
                  left: [
                    {
                      action: 'singleClickLeft',
                      func: 'return !!inData;',
                      prop: 'auto',
                      command: 'setval',
                      did: 'd0003',
                      title: 'H102 ▪︎ Светильник ▪︎ auto'
                    },
                    {
                      action: 'longClickLeft',
                      value: {}
                    }
                  ]
                }
              },
              links: {
                state1: {
                  did: 'd0006',
                  prop: 'state',
                  title: 'H102 ▪︎ Светильник ▪︎ state',
                  value: {
                    did: 'd0006',
                    prop: 'state'
                  }
                }
              }
            }
          }
        }
      });

      const res = await test.getUpPobj('container', 'vc001');
      console.log('res=' + util.inspect(res, null, 4));
      // {d0006: {state: [ { el: 'template_2', varname: 'state1' } ]},
      // d0003: { auto: [ { el: 'singleClickLeft' } ] }
      expect(typeof res).toEqual('object');
      expect(typeof res.d0003).toEqual('object');
      expect(typeof res.d0006).toEqual('object');
      expect(typeof res.d0006.state).toEqual('object');
      expect(typeof res.d0003.auto).toEqual('object');
    });

    /*
    it('input has charts with one realtime', async () => {
      dm_getCachedData.resolves({
        data: {
          list: ['chart_1', 'chart_2'],
          elements: {
            chart_1: {
              widget: true,
              widgetlinks: {
                link: {
                  id: 'c006',
                  title: 'Тестовый график DN002',
                  value: {}
                }
              },
              data: {},
              interval: {
                value: {
                  id: 'day',
                  title: 'Day'
                }
              },
              buttonsColor: {
                value: 'rgba(64, 81, 181, 1)'
              },
              type: 'chart',
              realtime: {
                value: true
              }
            },
            chart_2: {
              borderSize: {
                value: 1
              },
              borderRadius: {
                value: 0
              },
              borderStyle: {
                value: {
                  id: 'solid',
                  title: 'Solid'
                }
              },
              borderColor: {
                value: 'rgba(0,0,0,1)'
              },

              widget: true,
              widgetlinks: {
                link: {
                  id: 'c006',
                  title: 'Тестовый график DN002',
                  value: {}
                }
              },
              type: 'chart',
              realtime: {
                value: false
              }
            }
          }
        }
      });

      dm_findRecordById.resolves({
        _id: 'c004',
        chart_type: 'line',
        props: {
          '9nILZNEcK': { legend: 'Напряжение 1', dn_prop: 'AD001.value' },
          '2Y-nDCKLJ': { legend: 'Напряжение 2', linecolor: '', dn_prop: 'AD002.value' }
        }
      });

      const res = await test.getUpPobj('container', 'vc001');
      console.log('res=' + util.inspect(res, null, 4));

      expect(typeof res).toEqual('object');
      expect(typeof res.charts).toEqual('object');
      expect(typeof res.charts['AD001.value']).toEqual('object');
      expect(res.charts['AD001.value'][0]).toEqual('c006');
      expect(res.charts['AD002.value'][0]).toEqual('c006');
    });
    

    it('input has charts with all realtime', async () => {
      dm_getCachedData.resolves({
        data: {
          list: ['chart_1', 'chart_2'],
          elements: {
            chart_1: {
              widget: true,
              widgetlinks: {
                link: {
                  id: 'c006',
                  title: 'Тестовый график DN002',
                  value: {}
                }
              },
              data: {},
              interval: {
                value: {
                  id: 'day',
                  title: 'Day'
                }
              },
              buttonsColor: {
                value: 'rgba(64, 81, 181, 1)'
              },
              type: 'chart',
              realtime: {
                value: true
              }
            },
            chart_2: {
              borderSize: {
                value: 1
              },
              borderRadius: {
                value: 0
              },
              borderStyle: {
                value: {
                  id: 'solid',
                  title: 'Solid'
                }
              },
              borderColor: {
                value: 'rgba(0,0,0,1)'
              },

              widget: true,
              widgetlinks: {
                link: {
                  id: 'c016',
                  title: 'Тестовый график DN002',
                  value: {}
                }
              },
              type: 'chart',
              realtime: {
                value: true
              }
            }
          }
        }
      });

      dm_findRecordById.resolves({
        _id: 'c006',
        chart_type: 'line',
        props: {
          '9nILZNEcK': { legend: 'Напряжение 1', dn_prop: 'AD001.value' },
          '2Y-nDCKLJ': { legend: 'Напряжение 2', linecolor: '', dn_prop: 'AD002.value' }
        }
      });

      const res = await test.getUpPobj('container', 'vc001');
      console.log('res=' + util.inspect(res, null, 4));

      expect(typeof res).toEqual('object');
      expect(typeof res.charts).toEqual('object');
      expect(typeof res.charts['AD001.value']).toEqual('object');
      expect(res.charts['AD001.value'][0]).toEqual('c006');
      expect(res.charts['AD002.value'][0]).toEqual('c006');
    });
    */

  });

  describe('findRemovedVarsAndActionsForTemplate', () => {
    it('input is  undefined', () => {
      const res = test.findRemovedVarsAndActionsForTemplate();
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(0);
    });

    it('input is not a object', () => {
      const res = test.findRemovedVarsAndActionsForTemplate('x', 4);
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(0);
    });

    it('true input, no deleted, only added', () => {
      const prevObj = {
        listState: ['state1', 'state2', 'state3'],
        selectContainer: null,
        list: ['image_1', 'text_1', 'text_2', 'text_3', 'text_4'],
        elements: {
          text_3: {
            type: 'text'
          },
          image_1: {
            type: 'image'
          },
          state: {
            state1: {}
          }
        }
      };
      const newObj = {
        listState: ['state1', 'state2', 'state4', 'state3'],
        selectContainer: null,
        list: ['image_1', 'text_1', 'text_2', 'text_3', 'text_4'],
        elements: {
          text_3: {
            type: 'text'
          },
          image_1: {
            type: 'image'
          },
          state: {
            state1: {}
          }
        }
      };

      const res = test.findRemovedVarsAndActionsForTemplate(prevObj, newObj);
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(0);
    });

    it('true input, state1 is deleted', () => {
      const prevObj = {
        listState: ['state1', 'state2', 'state3'],
        selectContainer: null,
        list: ['image_1', 'text_1', 'text_2', 'text_3', 'text_4'],
        elements: {
          text_3: {
            type: 'text'
          },
          image_1: {
            type: 'image'
          },
          state: {
            state1: {}
          }
        }
      };
      const newObj = {
        listState: ['state4', 'state2', 'state3'],
        selectContainer: null,
        list: ['image_1', 'text_1', 'text_2', 'text_3', 'text_4'],
        elements: {
          text_3: {
            type: 'text'
          },
          image_1: {
            type: 'image'
          },
          state: {
            state1: {}
          }
        }
      };

      const res = test.findRemovedVarsAndActionsForTemplate(prevObj, newObj);
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(1);
      expect(res[0]).toEqual('state1');
    });

    it('true input, state3, action_1 is deleted', () => {
      const prevObj = {
        listState: ['state1', 'state2', 'state3'],
        selectContainer: null,
        list: ['image_1', 'text_1', 'text_2', 'text_3', 'action_1', 'text_4'],
        elements: {
          text_3: {
            type: 'text'
          },
          image_1: {
            type: 'image'
          },
          state: {
            state1: {}
          }
        }
      };
      const newObj = {
        listState: ['state1', 'state2', 'state4'],
        selectContainer: null,
        list: ['image_1', 'text_1', 'text_2', 'text_3', 'text_4'],
        elements: {
          text_3: {
            type: 'text'
          },
          image_1: {
            type: 'image'
          },
          state: {
            state1: {}
          }
        }
      };

      const res = test.findRemovedVarsAndActionsForTemplate(prevObj, newObj);
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(2);
      expect(res[0]).toEqual('state3');
      expect(res[1]).toEqual('action_1');
    });
  });

  describe('removeVarsAndActionsFromContainer', () => {
    it('input is  undefined', async () => {
      dm_getCachedData.resolves();
      const res = await test.removeVarsAndActionsFromContainer('vc001', 'template1');
      expect(res).toEqual('');
    });

    it('removed is empty', async () => {
      dm_getCachedData.resolves();
      const res = await test.removeVarsAndActionsFromContainer('vc001', 'template1', []);
      expect(res).toEqual('');
    });

    it('state1 removed ', async () => {
      // Из кэша идет внутри data
      dm_getCachedData.resolves({
        data: {
          list: ['template_1'],
          elements: {
            template_1: {
              type: 'template',
              links: {
                state1: {
                  did: 'd0002',
                  dn: 'AI001',
                  value: { did: 'd0002', prop: 'value' }
                }
              },
              templateId: 'vt023',
              actions: {
                action_1_singleClickLeft: {
                  value: { did: 'd0005', prop: 'toggle' }
                }
              }
            }
          }
        }
      });

      const expected = {
        list: ['template_1'],
        elements: {
          template_1: {
            type: 'template',
            links: {},
            templateId: 'vt023',
            actions: {
              action_1_singleClickLeft: {
                value: { did: 'd0005', prop: 'toggle' }
              }
            }
          }
        }
      };
      const res = await test.removeVarsAndActionsFromContainer('vc001', 'vt023', ['state1']);

      expect(typeof res).toEqual('object');

      expect(deepEqual(res, expected)).toEqual(true);
    });

    it('action_1 removed ', async () => {
      // Из кэша идет внутри data
      dm_getCachedData.resolves({
        data: {
          list: ['template_1'],
          elements: {
            template_1: {
              type: 'template',
              links: {
                state1: {
                  did: 'd0002',
                  dn: 'AI001',
                  value: { did: 'd0002', prop: 'value' }
                }
              },
              templateId: 'vt023',
              actions: {
                action_1_singleClickLeft: {
                  value: { did: 'd0005', prop: 'toggle' }
                }
              }
            }
          }
        }
      });

      const expected = {
        list: ['template_1'],
        elements: {
          template_1: {
            type: 'template',
            links: {
              state1: {
                did: 'd0002',
                dn: 'AI001',
                value: { did: 'd0002', prop: 'value' }
              }
            },
            templateId: 'vt023',
            actions: {}
          }
        }
      };
      const res = await test.removeVarsAndActionsFromContainer('vc001', 'vt023', ['action_1']);

      expect(typeof res).toEqual('object');

      expect(deepEqual(res, expected)).toEqual(true);
    });

    it('state1, action_1 removed ', async () => {
      // Из кэша идет внутри data
      dm_getCachedData.resolves({
        data: {
          list: ['template_1'],
          elements: {
            template_1: {
              type: 'template',
              links: {
                state1: {
                  did: 'd0002',
                  dn: 'AI001',
                  value: { did: 'd0002', prop: 'value' }
                }
              },
              templateId: 'vt023',
              actions: {
                action_1_singleClickLeft: {
                  value: { did: 'd0005', prop: 'toggle' }
                }
              }
            }
          }
        }
      });

      const expected = {
        list: ['template_1'],
        elements: {
          template_1: {
            type: 'template',
            links: {},
            templateId: 'vt023',
            actions: {}
          }
        }
      };
      const res = await test.removeVarsAndActionsFromContainer('vc001', 'vt023', ['state1', 'action_1']);

      expect(typeof res).toEqual('object');

      expect(deepEqual(res, expected)).toEqual(true);
    });
  });
  /** {
          list: ['template_1'],
          elements: {
            template_1: {
              type: 'template',
              links: {
                state1: {
                  did: 'd0002',
                  dn: 'AI001',
                  name: 'Датчик аналоговый тест поступления данных',
                  prop: 'value',
                  title: 'AI001 ▪︎ Датчик аналоговый тест поступления данных ▪︎ value',
                  value: { did: 'd0002', prop: 'value' }
                }
              },
              templateId: 'vt023',
              actions: {
                action_1_singleClickLeft: {
                  did: 'd0005',
                  dn: 'AD002',
                  name: 'Актуатор дискретный',
                  prop: 'toggle',
                  title: 'AD002 ▪︎ Актуатор дискретный ▪︎ toggle',
                  value: { did: 'd0005', prop: 'toggle' }
                }
              }
            }
          }
        }
*/
});
