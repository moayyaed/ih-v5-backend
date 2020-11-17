/* eslint-disable */
const util = require('util');

const expect = require('expect');
const hut = require('./translate');

describe('utils/translate', () => {
  
  describe('translateObj', () => {
    const dict = {down:'вниз', up:'вверх', hello:'Привет, мир!', luck:'Удачи :)'}

    it('one field, one level', () => {
      let tobj = {test:1, name:'$hello'};
      let res = hut.translateObj(tobj,dict);
      expect(tobj.name).toEqual(dict.hello);   
    });

    it('two fields, one level', () => {
      let tobj = {test:1, name:'$hello', vv:{v:'vv'}, header:'$luck', x:'yyy' };
      let res = hut.translateObj(tobj,dict);
      expect(tobj.name).toEqual(dict.hello);   
      expect(tobj.header).toEqual(dict.luck);   
    });

    it('two fields, two levels', () => {
      let tobj = {test:1, name:'$hello', part:{header:'$luck', x:'yyy' }};
      let res = hut.translateObj(tobj,dict);
      expect(tobj.name).toEqual(dict.hello);   
      expect(tobj.part.header).toEqual(dict.luck);   
    });

    it('two fields, two levels, name not string', () => {
      let tobj = {test:1, name:{header:'$luck', x:'yyy' }};
      let res = hut.translateObj(tobj,dict);
  
      expect(tobj.name.header).toEqual(dict.luck);   
    });

  });  

  describe('translateObj with second', () => {
    const dict = {down:'вниз', up:'вверх', hello:'Привет, мир!', luck:'Удачи :)'}
    const sec = {ver:'5.0', els:'778'}
    it('one field, one level, main+second ', () => {
      let tobj = {test:1, name:'$hello', version:'${ver}'};
      let res = hut.translateObj(tobj,dict,sec);
      expect(tobj.name).toEqual(dict.hello);   
      expect(tobj.version).toEqual(sec.ver);   
    });
  });

  describe('translateObj with two elements from second', () => {
    const dict = {down:'вниз', up:'вверх', hello:'Привет, мир!', luck:'Удачи :)'}
    const sec = {pluginspath:'/var/lib/plugins', project:'testproject'}
    it('one field from second, two elements', () => {
      let tobj = {test:1, path_dbproject:'${pluginspath}/akdb/${project}'};
      let res = hut.translateObj(tobj,dict,sec);
      console.log(util.inspect(res));
      expect(tobj.path_dbproject).toEqual('/var/lib/plugins/akdb/testproject');   
    
    });
  });

});  
  