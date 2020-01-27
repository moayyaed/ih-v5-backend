/* eslint-disable */
const util = require('util');

const expect = require('expect');
const fs = require('fs');
const hut = require('./hut');

describe('utils/hut', () => {
  describe('String function: allTrim', () => {
    it('input is empty or undefined', () => {
      expect(hut.allTrim()).toEqual('');
      expect(hut.allTrim('')).toEqual('');
    });

    it('input is string', () => {
      let str,
        res = 'Hello, world!';

      str = ' Hello, world! ';
      expect(hut.allTrim(str)).toEqual(res);

      str = 'Hello, world!';
      expect(hut.allTrim(str)).toEqual(res);

      str = 'Hello, world!\n\t\r';
      expect(hut.allTrim(str)).toEqual(res);
    });

    it('input is Object', () => {
      expect(hut.allTrim({})).toEqual('');
      expect(hut.allTrim({ name: 'Ann', age: 22 })).toEqual('');
    });
  });

  describe('String function: firstToUpper', () => {
    it('input is empty or undefined or not string', () => {
      expect(hut.firstToUpper()).toEqual('');
      expect(hut.firstToUpper('')).toEqual('');
      expect(hut.firstToUpper({})).toEqual('');
      expect(hut.firstToUpper(42)).toEqual('');
    });
    it('input is string', () => {
      expect(hut.firstToUpper('proba pera')).toEqual('Proba pera');
      expect(hut.firstToUpper('1 - first')).toEqual('1 - first');
      expect(hut.firstToUpper('a')).toEqual('A');
      expect(hut.firstToUpper('тест')).toEqual('Тест');
    });
  });

  describe('String function: 	removeBorderQuotes', () => {
    it('input is empty or undefined or not string', () => {
      expect(hut.removeBorderQuotes()).toEqual('');
    });
    it('input is string', () => {
      expect(hut.removeBorderQuotes(' "proba pera" ')).toEqual('proba pera');
      expect(hut.removeBorderQuotes(' proba pera ')).toEqual('proba pera');
      expect(hut.removeBorderQuotes(' " proba pera " ')).toEqual(' proba pera ');
    });
  });

  describe('String function: 	getFirstWords', () => {
    it('input is empty or undefined or not string', () => {
      expect(hut.getFirstWords()).toEqual('');
      expect(hut.getFirstWords('', 5)).toEqual('');
    });

    it('input is string', () => {
      expect(hut.getFirstWords('proba  pera  12345  777: ++ Целую', 2)).toEqual('proba pera');
    });
  });

  describe('String function: 	getLastWord', () => {
    it('input is string', () => {
      expect(hut.getLastWord('proba  pera  12345  777: ++ Целую')).toEqual('Целую');
    });
  });

  describe('String function: 	isOper', () => {
    it('input is not oper char ', () => {
      expect(hut.isOper('<t')).toBeFalsy();
      expect(hut.isOper('x')).toBeFalsy();
      expect(hut.isOper('12345')).toBeFalsy();
      expect(hut.isOper({})).toBeFalsy();
    });
    it('input is oper char ', () => {
      expect(hut.isOper('<')).toEqual(true);
      expect(hut.isOper('>')).toEqual(true);
      expect(hut.isOper('=')).toEqual(true);
    });
  });

  describe('String function: 	intersection', () => {
    it('some list is empty', () => {
      expect(hut.intersection('<t')).toEqual('');
      expect(hut.intersection('', 't')).toEqual('');
    });
    it('should be result', () => {
      let res = hut.intersection('one,two', 'two,for');
      expect(res).toEqual('two');
      expect(hut.intersection('two', 'one,two,for')).toEqual('two');
      expect(hut.intersection('one,two,seven,eleven', 'one,seven,eleven,for')).toEqual('one,seven,eleven');
    });
  });

  describe('Object function: isObjIdle', () => {
    it('input is empty or undefined', () => {
      expect(hut.isObjIdle()).toEqual(true);
      expect(hut.isObjIdle('')).toEqual(true);
      expect(hut.isObjIdle({})).toEqual(true);
    });

    it('input is plain object', () => {
      expect(hut.isObjIdle({ num: 1, name: 'Ann' })).toBeFalsy();
    });

    it('input is not plain object', () => {
      expect(hut.isObjIdle({ num: 1, props: { name: 'Ann', age: 22 }, balls: [12, 15, 22] })).toBeFalsy();
    });
  });

  describe('isValSatisfyToFilter', () => {
    it('filter - Number', () => {
      expect(hut.isValSatisfyToFilter(1, 1)).toEqual(true);
      expect(hut.isValSatisfyToFilter('1', 1)).toEqual(true);
      expect(hut.isValSatisfyToFilter(1, 42)).toBeFalsy();
      expect(hut.isValSatisfyToFilter('test', 42)).toBeFalsy();
    });

    it('filter - String', () => {
      expect(hut.isValSatisfyToFilter(1, '1')).toEqual(true);
      expect(hut.isValSatisfyToFilter('two', 'two')).toEqual(true);
      expect(hut.isValSatisfyToFilter('two', 'twoTwo')).toBeFalsy();
    });

    it('filter - Comma String Values', () => {
      expect(hut.isValSatisfyToFilter(1, '1,2,3')).toEqual(true);
      expect(hut.isValSatisfyToFilter('two', '2,two,5,ok')).toEqual(true);
      expect(hut.isValSatisfyToFilter('two', '2,twotwo,5,ok')).toBeFalsy();
    });

    it('filter - Array', () => {
      expect(hut.isValSatisfyToFilter(1, [2, 3, 3, 5, 1])).toEqual(true);
      expect(hut.isValSatisfyToFilter('1', [2, 3, 3, 5, 1])).toEqual(true);
      expect(hut.isValSatisfyToFilter(1, ['2', '3', '5', '1'])).toEqual(true);
      expect(hut.isValSatisfyToFilter(7, ['2', '3', '5', '1'])).toBeFalsy();
      expect(hut.isValSatisfyToFilter('two', ['2', 'two', '5', 'ok'])).toEqual(true);
      expect(hut.isValSatisfyToFilter('two', ['2', 'twotwo', '5', 'ok'])).toBeFalsy();
    });
  });

  describe('isInFilter', () => {
    it('filter Empty - should be true', () => {
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, undefined)).toEqual(true);
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, {})).toEqual(true);
    });

    it('object Empty - should be false', () => {
      expect(hut.isInFilter('', '')).toBeFalsy();
      expect(hut.isInFilter('', {})).toBeFalsy();
      expect(hut.isInFilter({}, { num: 1, name: 'Ann' })).toBeFalsy();
      expect(hut.isInFilter(undefined, { num: 1, name: 'Ann' })).toBeFalsy();
    });

    it('filter - Number', () => {
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, { num: 1 })).toEqual(true);
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, { num: '1' })).toEqual(true);
      expect(hut.isInFilter({ num: '1', name: 'Ann' }, { num: '1' })).toEqual(true);
      expect(hut.isInFilter({ num: '1', name: 'Ann' }, { num: '2' })).toBeFalsy();
    });

    it('filter - String', () => {
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, { name: 'Ann' })).toEqual(true);
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, { name: 'Anna' })).toBeFalsy();
    });

    it('filter - Comma String Values', () => {
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, { name: 'John,Ann,Mary,Liza' })).toEqual(true);
      expect(hut.isInFilter({ num: 1, name: 'Ann' }, { name: 'John,AnnaMary,Liza' })).toBeFalsy();
    });

    it('filter - Array', () => {
      expect(hut.isInFilter({ num: '1', name: 'Ann' }, { num: [2, 1, 3] })).toEqual(true);
      expect(hut.isInFilter({ num: '1', name: 'Ann' }, { num: ['1', '2'] })).toEqual(true);
      expect(hut.isInFilter({ num: '1', name: 'Ann' }, { num: ['2'] })).toBeFalsy();
    });
  });

  describe('getFileExt', () => {
    it('getFileExt - scheme/place.sch', () => {
      let filename = 'scheme/places.sch';
      let ext = hut.getFileExt(filename);
      expect(ext).toEqual('sch');
    });

    it('getFileExt - scheme\place.sch', () => {
      let filename = 'scheme\places.sch';
      let ext = hut.getFileExt(filename);
      expect(ext).toEqual('sch');
    });
    it('getFileExt - place.sch', () => {
      let filename = 'places.sch';
      let ext = hut.getFileExt(filename);
      expect(ext).toEqual('sch');
    });

    it('getFileExt - place', () => {
      let filename = 'places';
      let ext = hut.getFileExt(filename);
      expect(ext).toEqual('');
    });
    it('getFileExt - empty string', () => {
      let filename = '';
      let ext = hut.getFileExt(filename);
      expect(ext).toEqual('');
    });
  });

  describe('getFileNameExtLess', () => {
    it('getFileNameExtLess - empty string', () => {
      let filename = '';
      let res = hut.getFileNameExtLess(filename);
      expect(res).toEqual('');
    });

    it('getFileNameExtLess 1- scheme/place.sch', () => {
      let filename = 'scheme/place.sch';
      let res = hut.getFileNameExtLess(filename);
      expect(res).toEqual('place');
    });

    it('getFileNameExtLess2 - place.sch', () => {
      let filename = 'place.sch';
      let res = hut.getFileNameExtLess(filename);
      expect(res).toEqual('place');
    });

    it('getFileNameExtLess3 - place.sch', () => {
      let filename = 'c:/MyDocuments/place.sch';
      let res = hut.getFileNameExtLess(filename);
      expect(res).toEqual('place');
    });
  });

  describe('arrayToDict', () => {
    it('simple ', () => {
      let data = [{ id: '1', name: 'one' }, { id: '2', name: 'two' }];
      let res = hut.arrayToDict(data, 'id', 'name');
      expect(typeof res).toEqual('object');
      expect(res['1']).toEqual('one');
    });

    it('empty ', () => {
      let data = [{ id: '1', name: 'one' }, { id: '2', name: 'two' }];
      let res = hut.arrayToDict(data, 'num', 'name');
      expect(typeof res).toEqual('object');
      expect(Object.keys(res).length).toEqual(0);
    });
  });

  describe('pad', () => {
    it('("",2) => 00 ', () => {
      let res = hut.pad("",2);
      expect(res).toEqual('00');
    });
    it('(9,2) => 09 ', () => {
      let res = hut.pad(9,2);
      expect(res).toEqual('09');
    });
    it('(99,2) => 99 ', () => {
      let res = hut.pad(99,2);
      expect(res).toEqual('99');
    });
    it('(99,5) => 00099 ', () => {
      let res = hut.pad(99,5);
      expect(res).toEqual('00099');
    });
  });

  describe('isIdValid', () => {
    it('LAMP102 - valid ', () => {
      let str = 'LAMP102';
      let res = hut.isIdValid(str);

      expect(res).toEqual(true);
    });

    it('ЛАМПА102 - not valid ', () => {
      let str = 'ЛАМПА102';
      let res = hut.isIdValid(str);

      expect(res).toEqual(false);
    });

    it('LAMP@#$%^102 - not valid ', () => {
      let str = 'LAMP@#$%^102';
      let res = hut.isIdValid(str);

      expect(res).toEqual(false);
    });

    it('LAMP 102 - not valid ', () => {
      let str = 'LAMP 102';
      let res = hut.isIdValid(str);

      expect(res).toEqual(false);
    });

    it('1LAMP - not valid ', () => {
      let str = '1LAMP';
      let res = hut.isIdValid(str);

      expect(res).toEqual(false);
    });
  });

  describe('formArrayReplay', () => {
    it('formArrayReplay simple ', () => {
      let data = [{ id: '1', name: 'one', comment: 'comment 1' }, { id: '2', name: 'two' }];
      let res = hut.formArrayReplay(data);
      expect(typeof res).toEqual('object');
      expect(res[0].name).toEqual('one');
      expect(res[0].comment).toEqual('comment 1');
    });

    it('formArrayReplay fieldlist ', () => {
      let data = [{ id: '1', name: 'one', comment: 'comment 1' }, { id: '2', name: 'two' }];
      let res = hut.formArrayReplay(data, '', 'id,name');
      expect(typeof res).toEqual('object');
      expect(res[0].name).toEqual('one');
      expect(res[0].comment).toEqual(undefined);
    });

    it('formArrayReplay filter ', () => {
      let data = [{ id: '1', name: 'one', comment: 'comment 1' }, { id: '2', name: 'two' }];
      let res = hut.formArrayReplay(data, { id: '2' }, 'id,name');
      expect(typeof res).toEqual('object');
      expect(res.length).toEqual(1);
      expect(res[0].id).toEqual('2');
    });

    it('formArrayReplay filter csv', () => {
      let data = [{ id: '1', name: 'one', comment: 'comment 1' }, { id: '2', name: 'two' }];
      let res = hut.formArrayReplay(data, { id: '1,2' }, 'id,name');
      expect(typeof res).toEqual('object');
      expect(res.length).toEqual(2);
      expect(res[0].id).toEqual('1');
    });
  });


 describe('isImgFile', () => {
    it('test.png is ImgFile  ', () => {
      expect(hut.isImgFile('test.png')).toEqual(true);
    });

    it('test.txt is NOT ImgFile  ', () => {
      expect(hut.isImgFile('test.txt')).toEqual(false);
    });

    it('c:\MyDocs\test.jpg is ImgFile  ', () => {
      expect(hut.isImgFile('c:\MyDocs\test.jpg')).toEqual(true);
    });

    it('c:\MyDocs\test.txt is NOT ImgFile  ', () => {
      expect(hut.isImgFile('c:\MyDocs\test.txt')).toEqual(false);
    });

    it('empty string is NOT ImgFile  ', () => {
      expect(hut.isImgFile('')).toEqual(false);
    });
    it('test is NOT ImgFile  ', () => {
      expect(hut.isImgFile('test')).toEqual(false);
    });
  });

  describe('test concat ES6', () => {
    it('concat from map ', () => {
      
      let xmap = new Map();
      xmap.set('1', [{ id: '1', name: 'one' }, { id: '11', name: 'oneone' }]);
      xmap.set('2', [{ id: '2', name: 'two' }, { id: '22', name: 'twotwo' }]);
      // let res =[].concat(...[array1, array2, ...]) 
      let res =[].concat(...xmap.values());

      expect(typeof res).toEqual('object');
      
    });

  });
 
 
  describe('revise', () => {
    it('revise - equal ', () => {
      let data = [{ id: '1', name: 'one' }, { id: '2', name: 'two' }];
      let xmap = new Map();
      xmap.set('1', { id: '1', name: 'one' });
      xmap.set('2', { id: '2', name: 'two' });
      let res = hut.revise(data, xmap);
      expect(res).toEqual(false);
    });
    it('revise - not equal - delete item ', () => {
      let data = [{ id: '1', name: 'one' }, { id: '2', name: 'two' }];
      let xmap = new Map();
      xmap.set('1', { id: '1', name: 'one' });
      let res = hut.revise(data, xmap);
      expect(data.length).toEqual(1);
      expect(res).toEqual(true);
    });

    it('revise - not equal - add item', () => {
      let data = [{ id: '1', name: 'one' }];
      let xmap = new Map();
      xmap.set('1', { id: '1', name: 'one' });
      xmap.set('2', { id: '2', name: 'two' });
      let res = hut.revise(data, xmap);
      expect(data.length).toEqual(2);
      expect(data[1].id).toEqual('2');
      expect(res).toEqual(true);
    });

    it('revise - not equal - replace item', () => {
      let data = [{ id: '1', name: 'one' }];

      let xmap = new Map();
      xmap.set('1', { id: '1', name: 'name1' });

      let res = hut.revise(data, xmap, 'id', 'id,name');

      expect(data.length).toEqual(1);
      expect(data[0].name).toEqual('name1');
      expect(res).toEqual(true);
    });

    it('revise - not equal - replace undefined prop', () => {
      let data = [{ id: '1' }];
      let xmap = new Map();
      xmap.set('1', { id: '1', name: 'name1' });
      xmap.set('2', { id: '2', name: 'two' });

      let res = hut.revise(data, xmap, 'id', 'id,name');
      expect(data.length).toEqual(2);
      expect(data[0].name).toEqual('name1');
      expect(data[1].id).toEqual('2');
      expect(res).toEqual(true);
    });
  });


  // removeLastNumFromStr
  describe('removeLastNumFromStr', () => {
    it('empty str', () => {
      let res = hut.removeLastNumFromStr('');
      expect(res).toEqual('');   
    });

    it('str does not end with num', () => {
      let res = hut.removeLastNumFromStr('wago');
      expect(res).toEqual('wago');   
    });

    it('str ends with num', () => {
      let res = hut.removeLastNumFromStr('wago1');
      expect(res).toEqual('wago');   
    });

    it('str ends with 3 num', () => {
      let res = hut.removeLastNumFromStr('wago123');
      expect(res).toEqual('wago');   
    });

    it('str ends with 3 num', () => {
      let res = hut.removeLastNumFromStr('w321ago123');
      expect(res).toEqual('w321ago');   
    });
  });
  

});
