/* eslint-disable */
const util = require('util');

const expect = require('expect');
const ut = require('./updateutil');

describe('utils/updateutils', () => {
  
  describe('compareSemVer', () => {
    it('New ver - patch', () => {
 
      let res = ut.compareSemVer('1.1.1','1.1.0');
      expect(res).toEqual(3);   
    });
    it('New ver - minor', () => {
 
      let res = ut.compareSemVer('1.2.1','1.1.0');
      expect(res).toEqual(2);   
    });
    it('New ver - major', () => {
 
      let res = ut.compareSemVer('1.2.1','0.1.0');
      expect(res).toEqual(1);   
    });
    it('New ver - patch 10', () => {
 
      let res = ut.compareSemVer('1.1.10','1.1.9');
      expect(res).toEqual(3);   
    });
    
    it('New ver - short ver', () => {
      let res = ut.compareSemVer('1.1','1.1.9');
      expect(res).toEqual(0);   

    });

    it('New ver - prev beta ver', () => {
      let res = ut.compareSemVer('5.1.1','5.1.0-beta');
      expect(res).toEqual(3);   

    });

    it('New ver - new beta ver', () => {
      let res = ut.compareSemVer('5.1.1-beta','5.1.0');
      expect(res).toEqual(3);   

    });
    
  });
});