/* eslint-disable */

const expect = require('expect');

const deepEqual = require('./deepEqual');

describe('utils/deepEqual', () => {
  describe('scalar', () => {
    it('equal numbers', () => {
      expect(deepEqual(42, 42)).toEqual(true);
    });
    it('NOT equal numbers', () => {
      expect(deepEqual(-2, 42)).toEqual(false);
    });
    it('NaN and NaN are equal', () => {
      expect(deepEqual(NaN, NaN)).toEqual(true);
    });
    it('null and null are equal', () => {
      expect(deepEqual(null, null)).toEqual(true);
    });
    it('Infinity and Infinity are equal', () => {
      expect(deepEqual(Infinity, Infinity)).toEqual(true);
    });
    it('0 and -0 are equal', () => {
      expect(deepEqual(0, -0)).toEqual(true);
    });

    it('0 and null are NOT equal', () => {
      expect(deepEqual(0, null)).toEqual(false);
    });

    it('undefined and null are NOT equal', () => {
      expect(deepEqual(undefined, null)).toEqual(false);
    });
    it('empty string and null are not equal', () => {
      expect(deepEqual('', null)).toEqual(false);
    });

    it('1 and true are not equal', () => {
      expect(deepEqual(1, true)).toEqual(false);
    });

    it('0 and false are not equal', () => {
      expect(deepEqual(1, true)).toEqual(false);
    });

    it('equal bool (true)', () => {
      expect(deepEqual(true, true)).toEqual(true);
    });
    it('equal bool (false)', () => {
      expect(deepEqual(false, false)).toEqual(true);
    });
    it('NOT equal bool', () => {
      expect(deepEqual(false, true)).toEqual(false);
    });
    it('equal strings', () => {
      expect(deepEqual('Test', 'Test')).toEqual(true);
    });
    it('NOT equal strings', () => {
      expect(deepEqual('Test', 'Test42')).toEqual(false);
    });

    it('number and array are NOT equal', () => {
      expect(deepEqual(1, [1])).toEqual(false);
    });
  });

  describe('objects', () => {
    it('empty objects are equal', () => {
      expect(deepEqual({}, {})).toEqual(true);
    });
    it('null and empty objects are NOT equal', () => {
      expect(deepEqual(null, {})).toEqual(false);
    });
    it('undefined and empty objects are NOT equal', () => {
      expect(deepEqual(undefined, {})).toEqual(false);
    });
    it('empty array and empty object are NOT equal', () => {
      expect(deepEqual({}, [])).toEqual(false);
    });
    it('equal objects (same properties "order")', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual(true);
    });
    it('equal objects (different properties "order")', () => {
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual(true);
    });

    it('NOT equal objects (different properties "value")', () => {
      expect(deepEqual({ a: 1, b: 42 }, { b: 2, a: 1 })).toEqual(false);
    });
    it('NOT equal objects (extra propertie)', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2, c: 3 })).toEqual(false);
    });

    it('equal objects (same sub-properties)', () => {
      expect(deepEqual({ a: [{ b: 'c' }] }, { a: [{ b: 'c' }] })).toEqual(true);
    });
    it('NOT equal objects (different sub-property value)', () => {
      expect(deepEqual({ a: [{ b: 'c' }] }, { a: [{ b: 'b' }] })).toEqual(false);
    });
    it('NOT equal objects (different sub-properties)', () => {
      expect(deepEqual({ a: [{ b: 'c' }] }, { a: [{ d: 'c' }] })).toEqual(false);
    });

    it(' object with same undefined properties are equal', () => {
      expect(deepEqual({ a: undefined }, { a: undefined })).toEqual(true);
    });

    it(' object with extra undefined properties are not equal', () => {
      expect(deepEqual({ a: undefined }, { b: undefined })).toEqual(false);
    });

    it('objects with `toString` functions returning same values are equal', () => {
      expect(deepEqual({ toString: () => 'Hello world!' }, { toString: () => 'Hello world!' })).toEqual(true);
    });
    it('objects with `toString` functions returning different values are NOT equal', () => {
      expect(deepEqual({ toString: () => 'Hello world!' }, { toString: () => 'Hi!' })).toEqual(false);
    });
  });

  describe('arrays', () => {
    it('two empty arrays are equal', () => {
      expect(deepEqual([], [])).toEqual(true);
    });
    it('two equal arrays are equal', () => {
      expect(deepEqual([1, 2], [1, 2])).toEqual(true);
    });
    it('NOT equal arrays (different item)', () => {
      expect(deepEqual([1, 2], [2, 2])).toEqual(false);
    });
    it('NOT equal arrays (different length)', () => {
      expect(deepEqual([1, 2], [1, 2, 2])).toEqual(false);
    });

    it('equal arrays of objects', () => {
      expect(deepEqual([{ a: 'a' }, { b: 'b' }], [{ a: 'a' }, { b: 'b' }])).toEqual(true);
    });
    it('NOT equal arrays of objects', () => {
      expect(deepEqual([{ a: 'a' }, { b: 'b' }], [{ a: 'a' }, { c: 'b' }])).toEqual(false);
    });
  });

  describe('date objects', () => {
    it('equal date objects', () => {
      expect(deepEqual(new Date(2019, 1, 2, 3), new Date(2019, 1, 2, 3))).toEqual(true);
    });
    it('NOT equal date objects', () => {
      expect(deepEqual(new Date(2019, 1, 2, 3), new Date(2019, 1, 2, 2))).toEqual(false);
    });
  });

  describe('functions', () => {
    it('same functions are equal', () => {
      expect(deepEqual(fun1, fun1)).toEqual(true);
    });
    it('different functions are NOT equal', () => {
      expect(deepEqual(fun1, fun2)).toEqual(false);
    });
  });

  describe('RegExp objects', () => {
    it('equal', () => {
      expect(deepEqual(/foo/, /foo/)).toEqual(true);
    });
    it('NOT equal', () => {
      expect(deepEqual(/foo/, /bar/)).toEqual(false);
    });
    it('NOT equal (different flags', () => {
      expect(deepEqual(/foo/, /foo/i)).toEqual(false);
    });
    it('RegExp and string are NOT equal', () => {
      expect(deepEqual('foo', /foo/i)).toEqual(false);
    });
  });


  describe('big objects', () => {
    it('big objects are equal', () => {
    const val1 = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
      prop4: {
        subProp1: 'sub value1',
        subProp2: {
          subSubProp1: 'sub sub value1',
          subSubProp2: [1, 2, { prop2: 1, prop: 2 }, 4, 5]
        }
      },
      prop5: 1000,
      prop6: new Date(2016, 2, 10)
    };
    const val2 =  {
      prop5: 1000,
      prop3: 'value3',
      prop1: 'value1',
      prop2: 'value2',
      prop6: new Date('2016/03/10'),
      prop4: {
        subProp2: {
          subSubProp1: 'sub sub value1',
          subSubProp2: [1, 2, {prop2: 1, prop: 2}, 4, 5]
        },
        subProp1: 'sub value1'
      }
    };
    
    expect(deepEqual(val1, val2)).toEqual(true);
    }); 
  });
});

function fun1() {}
function fun2() {}
