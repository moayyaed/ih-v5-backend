/* eslint-disable */
const util = require('util');
const expect = require('expect');

const Subscriber = require('./subscriber');
const deepEqual = require('./deepEqual');

describe('utils/subscriber', () => {
  describe('addSub', () => {
  

    it('add Sub', () => {
      const subsman = new Subscriber();
      subsman.addSub('tableupdate', 'emul1', '1');
   
      const result = subsman.hasClientSubs('tableupdate', 'emul1');
      expect(result).toEqual(true);
    });

    it('add Sub and unsub', () => {
      const subsman = new Subscriber();
      subsman.addSub('tableupdate', 'emul1', '1');
      
      const result = subsman.hasClientSubs('tableupdate', 'emul1');
      expect(result).toEqual(true);

      subsman.addSub('tableupdate', 'emul1', '2', {tablename:'devhard'});

      subsman.removeAllSubs('emul1');

      const result2 = subsman.hasClientSubs('tableupdate', 'emul1');
      expect(result2).toEqual(false);

    });

    it('add subs for two clients', () => {
      const subsman = new Subscriber();
      subsman.addSub('tableupdate', 'emul1', '1xxx', {tablename:'channels', unit:'emul1'});
      subsman.addSub('tableupdate', 'emul2', '2xxx', {tablename:'channels', unit:'emul2'});
      subsman.addSub('tableupdate', 'emul2', '21xx', {tablename:'params', unit:'emul2'});

      const result = subsman.getClientSubs('tableupdate', 'emul2');
      console.log(util.inspect(result));
      expect(result.length).toEqual(2);

      const result2 = subsman.getSubs('tableupdate', {tablename:'channels'});
      console.log(util.inspect(result2));
      expect(result2.length).toEqual(2);

      const result3 = subsman.getSubs('tableupdate', {tablename:'channels', unit:'emul1'});
      console.log(util.inspect(result3));
      expect(result3.length).toEqual(1);
    });

  });
});