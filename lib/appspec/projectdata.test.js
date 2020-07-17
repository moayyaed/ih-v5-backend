/* eslint-disable */
const util = require('util');

const expect = require('expect');
const sinon = require('sinon');

const dm = require('../datamanager');
const hut = require('../utils/hut');
const deepEqual = require('../utils/deepEqual');

let dm_getCachedData;

// const hut = require('./hut');
// const deepEqual = require('./deepEqual');

const test = require('./projectdata');

describe('appspec/projectdata', () => {
  before(() => {
    sandbox = sinon.createSandbox();
    dm_getCachedData = sandbox.stub(dm, 'getCachedData');
  });
  after(() => {
    sandbox.restore();
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
            links: {
            },
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
            actions: {
            }
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
            links: {
            },
            templateId: 'vt023',
            actions: {
            }
          }
        }
      };
      const res = await test.removeVarsAndActionsFromContainer('vc001', 'vt023', ['state1','action_1']);

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
