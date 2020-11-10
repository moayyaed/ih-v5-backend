/* eslint-disable */

const util = require('util');
const expect = require('expect');

const dbdatautil = require('./dbdatautil');

describe('utils/dbdatautil', () => {
  describe('insertToDataArray', () => {
  

    it('insert one item array into array', () => {
      const dataArr = [[1605013603557, 22, null], [1605013613601, 24, null], [1605013618718, 25, null] ];
      const data2 = ["DN2,value,1605013608579,23"];

      dbdatautil.insertToDataArray(dataArr, data2, 2);
      console.log(util.inspect(dataArr));
      expect(dataArr.length).toEqual(4);
      expect(dataArr[1][2]).toEqual(23);
    });

    it('insert one item array - to the end', () => {
      const dataArr = [[1605013603557, 22, null], [1605013608579,23, null], [1605013613601, 24, null]];
      const data2 = ["DN2,value,1605013618718, 25"];

      dbdatautil.insertToDataArray(dataArr, data2, 2);
      console.log(util.inspect(dataArr));
      expect(dataArr.length).toEqual(4);
      expect(dataArr[3][2]).toEqual(25);
     
    });

    it('insert one item array - to the start', () => {
      const dataArr = [ [1605013608579,23, null], [1605013613601, 24, null], [1605013618718, 25, null]];
      const data2 = ["DN2,value,1605013603557, 22"];

      dbdatautil.insertToDataArray(dataArr, data2, 2);
      console.log(util.inspect(dataArr));
      expect(dataArr.length).toEqual(4);
      expect(dataArr[0][2]).toEqual(22);
    });

    it('insert one item array - to 2-items array', () => {
      const dataArr = [ [1605013603557, 22, ], [1605013608579,23, null], [1605013613601, 24, null], [1605013618718, 25, null]];
      const data2 = ["DN2,value,1605013603557, 22"];

      dbdatautil.insertToDataArray(dataArr, data2, 2);
      console.log(util.inspect(dataArr));
      expect(dataArr.length).toEqual(4);
      expect(dataArr[0][2]).toEqual(22);
    });


  });
});